// backend/routes/receipt.js
import dotenv from "dotenv";
import { Router } from "express";
import multer from "multer";
import Tesseract from "tesseract.js";
import { pdf } from "pdf-to-img";
import OpenAI from "openai";

dotenv.config();
const router = Router();

/* ----------------------------
   ✅ OpenAI lazy client (won't crash server)
---------------------------- */
let openai = null;
function getOpenAIClient() {
  if (!process.env.OPENAI_API_KEY) return null;
  if (!openai) openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return openai;
}

/* ----------------------------
   Upload
---------------------------- */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
});

const uploadAnyReceiptField = (req, res, next) => {
  const handler = upload.fields([
    { name: "receipt", maxCount: 1 },
    { name: "file", maxCount: 1 },
  ]);

  handler(req, res, (err) => {
    if (err) {
      console.log("multer upload error:", err);
      return res.status(400).json({
        success: false,
        message: err.message || "Upload error",
      });
    }

    req.file = req.files?.receipt?.[0] || req.files?.file?.[0] || req.file;
    next();
  });
};

/* ----------------------------
   Helpers
---------------------------- */
function detectCategory(text) {
  const t = (text || "").toLowerCase();

  if (t.match(/hotel|restaurant|cafe|coffee|tea|pizza|burger|biryani|food|dine|meal/))
    return "food";
  if (t.match(/medical|pharmacy|clinic|hospital|tablet|medicine|apollo/)) return "medical";
  if (t.match(/uber|ola|travel|bus|train|flight|metro|fuel|petrol|diesel|parking|toll/))
    return "travel";
  if (t.match(/grocery|groceries|supermarket|mart|vegetable|dmart|reliance|store/))
    return "groceries";
  if (t.match(/shirt|pant|jeans|dress|clothing|footwear|shoes|apparel/)) return "clothing";
  if (t.match(/amazon|flipkart|myntra|shopping|order id|invoice/)) return "shopping";

  return "other";
}

function normalizeDigits(text) {
  return String(text || "")
    .replace(/(\d)\s+(?=\d)/g, "$1")
    .replace(/(\d)\s*[.,]\s*(\d)/g, "$1.$2")
    .replace(/,/g, "");
}

function extractAmount(text) {
  const normalized = normalizeDigits(String(text || "").toLowerCase());
  const cleaned = normalized.replace(/\b\d{10,}\b/g, " ");

  const lines = cleaned
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const keys = [
    "net payable",
    "amount payable",
    "grand total",
    "total amount",
    "total",
    "balance due",
    "amount due",
    "payable",
    "subtotal",
    "sub total",
  ];

  const pickLastMoney = (s) => {
    const matches = s.match(/(?:₹\s*)?\d{1,3}(?:,\d{3})*(?:\.\d{2})?/g);
    if (!matches?.length) return null;

    const nums = matches
      .map((m) => Number(m.replace(/[₹,\s]/g, "")))
      .filter((n) => !Number.isNaN(n) && n > 0 && n < 1000000);

    if (!nums.length) return null;
    return nums[nums.length - 1];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].toLowerCase();
    for (const k of keys) {
      if (line.includes(k)) {
        const window = [lines[i], lines[i + 1] || "", lines[i + 2] || ""].join(" ");
        const val = pickLastMoney(window);
        if (val != null) return val;
      }
    }
  }

  const allMoney = cleaned.match(/(?:₹\s*)?\d{1,3}(?:,\d{3})*(?:\.\d{2})?/g) || [];
  const nums = allMoney
    .map((m) => Number(m.replace(/[₹,\s]/g, "")))
    .filter((n) => !Number.isNaN(n) && n >= 10 && n < 1000000);

  if (!nums.length) return null;
  return Math.max(...nums);
}

function extractName(text) {
  const lines = String(text || "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const reject = [
    "tax invoice",
    "invoice",
    "cash memo",
    "bill",
    "gstin",
    "phone",
    "mobile",
    "total",
    "subtotal",
    "amount",
    "date",
  ];

  for (const l of lines.slice(0, 12)) {
    const low = l.toLowerCase();
    if (reject.some((r) => low.includes(r))) continue;

    const letters = (l.match(/[a-zA-Z]/g) || []).length;
    const digits = (l.match(/\d/g) || []).length;

    if (letters >= 4 && digits <= 3 && l.length >= 4) return l;
  }

  return "Expense";
}

function extractDate(text) {
  const t = String(text || "").replace(/\s+/g, " ");

  let m = t.match(/\b(20\d{2})[-\/](0?\d|1[0-2])[-\/]([0-2]?\d|3[01])\b/);
  if (m) {
    const [_, yyyy, mm, dd] = m;
    return new Date(
      `${yyyy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}T00:00:00.000Z`
    ).toISOString();
  }

  m = t.match(/\b([0-2]?\d|3[01])[-\/](0?\d|1[0-2])[-\/](20\d{2})\b/);
  if (m) {
    const [_, dd, mm, yyyy] = m;
    return new Date(
      `${yyyy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}T00:00:00.000Z`
    ).toISOString();
  }

  return null;
}

async function ocrBuffer(buffer) {
  const ocr = await Tesseract.recognize(buffer, "eng", {
    tessedit_pageseg_mode: 6,
    preserve_interword_spaces: 1,
  });
  return (ocr?.data?.text || "").trim();
}

// ✅ Used to detect credits when OCR loses the credit column
const CREDIT_HINTS = [
  "salary",
  "credit",
  "cr",
  "refund",
  "reversal",
  "cashback",
  "interest",
  "received",
  "deposit",
  "freelance",
  "payment received",
];

/* ----------------------------
   ✅ IMAGE RECEIPT AI PARSER
   - Extract: merchant/name, amount, date, category
   - Returns { name, amount, date, category }
---------------------------- */
async function parseReceiptAI(rawText) {
  const client = getOpenAIClient();
  if (!client) throw new Error("OPENAI_API_KEY not set");

  const text = String(rawText || "").slice(0, 12000);

  const jsonSchema = {
    name: "receipt_extract",
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        name: { type: "string", description: "Merchant or expense name" },
        amount: { type: ["number", "null"], description: "Total amount paid" },
        date: {
          type: ["string", "null"],
          description: "Purchase date in YYYY-MM-DD if found, else null",
        },
        category: {
          type: "string",
          enum: ["food", "shopping", "clothing", "groceries", "travel", "medical", "other"],
        },
      },
      required: ["name", "amount", "date", "category"],
    },
  };

  const resp = await client.responses.create({
    model: "gpt-4o-mini",
    input: [
      {
        role: "system",
        content:
          "Extract structured data from a receipt OCR.\n" +
          "Rules:\n" +
          "- name: best merchant/store name or short description\n" +
          "- amount: FINAL total paid (not GST, not subtotal)\n" +
          "- date: YYYY-MM-DD if present else null\n" +
          "- category: choose best from enum\n" +
          "Return JSON only.",
      },
      { role: "user", content: `OCR TEXT:\n${text}` },
    ],
    response_format: { type: "json_schema", json_schema: jsonSchema },
  });

  const data = JSON.parse(resp.output_text || "{}");

  const name = String(data?.name || "Expense").trim() || "Expense";
  const amount =
    data?.amount == null ? null : Number.isFinite(Number(data.amount)) ? Number(data.amount) : null;
  const date =
    data?.date && /^\d{4}-\d{2}-\d{2}$/.test(String(data.date))
      ? new Date(`${data.date}T00:00:00.000Z`).toISOString()
      : null;

  const category = String(data?.category || detectCategory(name));

  return {
    name,
    amount: amount != null ? Math.round(amount) : null,
    date,
    category,
  };
}

/* ----------------------------
   Fallback Parser (PDF row-regex)
   ✅ FIXED: single amount rows can be CREDIT (salary/freelance/etc.)
---------------------------- */
function parseStatementTransactionsFallback(rawText) {
  if (!rawText) return [];

  let text = String(rawText || "");
  const footerIdx = text.toLowerCase().indexOf("this is a system generated");
  if (footerIdx !== -1) text = text.slice(0, footerIdx);

  text = text
    .replace(/\u00A0/g, " ")
    .replace(/[|]+/g, " ")
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{2,}/g, "\n")
    .trim();

  // ensure date starts new line
  text = text.replace(
    /([^\n])\s*((?:[0-3]?\d)[\/\-](?:[0-1]?\d)[\/\-](?:20)?\d{2})/g,
    "$1\n$2"
  );

  const toNum = (s) => {
    if (!s) return null;
    const n = Number(String(s).replace(/[₹,\s]/g, ""));
    return Number.isFinite(n) ? n : null;
  };

  const rowRe =
    /^(?<dd>[0-3]?\d)[\/\-](?<mm>[0-1]?\d)[\/\-](?<yy>(?:20)?\d{2})\s+(?<desc>.+?)\s+(?:(?<debit>\d{1,3}(?:,\d{3})*|\d+)\s+)?(?:(?<credit>\d{1,3}(?:,\d{3})*|\d+)\s+)?(?<bal>\d{1,3}(?:,\d{3})*|\d+)$/;

  const out = [];
  const seen = new Set();

  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  for (const line of lines) {
    const low = line.toLowerCase();

    if (
      low.includes("sample bank") ||
      low.includes("account holder") ||
      low.includes("account number") ||
      low.includes("statement date") ||
      (low.includes("date") && low.includes("description") && low.includes("debit")) ||
      (low.includes("debit") && low.includes("credit") && low.includes("balance"))
    ) {
      continue;
    }
    if (low.includes("opening balance")) continue;

    const m = line.match(rowRe);
    if (!m || !m.groups) continue;

    let { dd, mm, yy, desc, debit, credit, bal } = m.groups;

    if (yy.length === 2) yy = "20" + yy;
    dd = String(dd).padStart(2, "0");
    mm = String(mm).padStart(2, "0");

    const debitN = toNum(debit);
    const creditN = toNum(credit);
    const balN = toNum(bal);

    const descLow = String(desc || "").toLowerCase();
    const isCreditHint = CREDIT_HINTS.some((k) => descLow.includes(k));

    let type = null;
    let amount = null;

    if (debitN != null && creditN == null) {
      type = isCreditHint ? "credit" : "debit";
      amount = debitN;
    } else if (creditN != null && debitN == null) {
      type = "credit";
      amount = creditN;
    } else if (debitN != null && creditN != null) {
      type = isCreditHint ? "credit" : "debit";
      amount = isCreditHint ? creditN : debitN;
    } else {
      continue;
    }

    if (!Number.isFinite(amount) || amount <= 0) continue;
    if (balN != null && amount === balN) continue;

    const isoDate = new Date(`${yy}-${mm}-${dd}T00:00:00.000Z`).toISOString();

    const item = {
      name: (desc || "Transaction").trim(),
      type,
      amount: Math.round(amount),
      date: isoDate,
      category: detectCategory(desc),
    };

    const key = `${item.date}__${item.type}__${item.amount}__${item.name}`;
    if (seen.has(key)) continue;
    seen.add(key);

    out.push(item);
  }

  return out;
}

/* ----------------------------
   ✅ AI Parser (PDF table rows)
---------------------------- */
async function parseStatementTransactionsAI(rawText) {
  const client = getOpenAIClient();
  if (!client) throw new Error("OPENAI_API_KEY not set");

  const text = String(rawText || "").slice(0, 20000);

  const jsonSchema = {
    name: "bank_statement_rows",
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        transactions: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              date: { type: "string", description: "YYYY-MM-DD" },
              name: { type: "string" },
              debit: { type: ["number", "null"] },
              credit: { type: ["number", "null"] },
            },
            required: ["date", "name", "debit", "credit"],
          },
        },
      },
      required: ["transactions"],
    },
  };

  const resp = await client.responses.create({
    model: "gpt-4o-mini",
    input: [
      {
        role: "system",
        content:
          "You are a strict bank statement table parser. Extract rows from OCR text.\n" +
          "- Ignore headers and 'Opening Balance'\n" +
          "- For each row return: date(YYYY-MM-DD), name(description), debit(amount or null), credit(amount or null)\n" +
          "- Amounts must NOT be balance.\n" +
          "Return JSON only.",
      },
      { role: "user", content: `OCR TEXT:\n${text}` },
    ],
    response_format: { type: "json_schema", json_schema: jsonSchema },
  });

  const data = JSON.parse(resp.output_text || "{}");
  const tx = Array.isArray(data.transactions) ? data.transactions : [];

  const out = tx
    .map((t) => {
      const name = String(t?.name || "Transaction").trim();
      const dateStr = String(t?.date || "").trim();

      const debit = t?.debit == null ? null : Number(t.debit);
      const credit = t?.credit == null ? null : Number(t.credit);

      let type = null;
      let amount = null;

      if (Number.isFinite(debit) && debit > 0) {
        type = "debit";
        amount = debit;
      } else if (Number.isFinite(credit) && credit > 0) {
        type = "credit";
        amount = credit;
      } else {
        return null;
      }

      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;

      return {
        name,
        type,
        amount: Math.round(amount),
        date: new Date(`${dateStr}T00:00:00.000Z`).toISOString(),
        category: detectCategory(name),
      };
    })
    .filter(Boolean);

  const seen = new Set();
  return out.filter((t) => {
    const key = `${t.date}__${t.type}__${t.amount}__${t.name}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/* ----------------------------
   Route: OCR Scan (IMAGE + PDF)
   ✅ Now uses OpenAI for IMAGE receipts too
---------------------------- */
router.post("/scan", uploadAnyReceiptField, async (req, res) => {
  try {
    console.log("✅ /receipt/scan HIT");

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded. Use field name 'receipt' (recommended) or 'file'.",
      });
    }

    const mime = req.file.mimetype || "";
    const size = req.file.size || 0;

    if (size <= 0) {
      return res.status(400).json({ success: false, message: "Empty file uploaded" });
    }

    /* ---------- IMAGE RECEIPT (upload OR camera scan) ---------- */
    if (mime.startsWith("image/")) {
      const rawText = await ocrBuffer(req.file.buffer);

      // ✅ Use AI first, fallback if AI fails
      let data;
      try {
        console.log("👉 Trying AI receipt parser...");
        data = await parseReceiptAI(rawText);
        console.log("✅ AI receipt parser success:", data);
      } catch (e) {
        console.log("⚠️ AI receipt parser skipped/failed:", e?.message || e);
        data = {
          name: extractName(rawText),
          amount: extractAmount(rawText),
          category: detectCategory(rawText),
          date: extractDate(rawText),
        };
      }

      // final safety
      if (!data.category) data.category = detectCategory(data.name || "");
      if (!data.name) data.name = "Expense";

      return res.json({ success: true, type: "image", data });
    }

    /* ------------------- PDF STATEMENT ------------------- */
    if (mime === "application/pdf") {
      let pages;
      try {
        pages = await pdf(req.file.buffer, { scale: 2 });
      } catch (e) {
        return res.status(500).json({
          success: false,
          message: "PDF processing failed on server. Try uploading an image (JPG/PNG) instead.",
          error: e?.message || String(e),
        });
      }

      let combinedText = "";
      for await (const page of pages) {
        const rawText = await ocrBuffer(page);
        if (rawText) combinedText += "\n" + rawText;
      }

      let parsed = [];
      try {
        console.log("👉 Trying AI statement parser...");
        parsed = await parseStatementTransactionsAI(combinedText);
        console.log("✅ AI statement parser success. Count:", parsed.length);
      } catch (e) {
        console.log("⚠️ AI statement parser skipped/failed:", e?.message || e);
        parsed = parseStatementTransactionsFallback(combinedText);
        console.log("✅ Fallback parser count:", parsed.length);
      }

      // ✅ Only debit rows in picker
      const debitOnly = parsed.filter((t) => t && t.type === "debit");

      return res.json({ success: true, type: "pdf", data: debitOnly });
    }

    return res.status(400).json({ success: false, message: "Unsupported file type" });
  } catch (err) {
    console.log("receipt scan error:", err);
    return res.status(500).json({
      success: false,
      message: err?.message || "Scan failed",
    });
  }
});

export default router;
