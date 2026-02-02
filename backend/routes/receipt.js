// backend/routes/receipt.js
import { Router } from "express";
import multer from "multer";
import Tesseract from "tesseract.js";
import { pdf } from "pdf-to-img";

const router = Router();

// ✅ memory storage is best for Render
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
});

/* ----------------------------
   Helpers
---------------------------- */
function detectCategory(text) {
  const t = (text || "").toLowerCase();

  if (t.match(/hotel|restaurant|cafe|coffee|tea|pizza|burger|biryani|food|dine|meal/))
    return "food";

  if (t.match(/medical|pharmacy|clinic|hospital|tablet|medicine|apollo/))
    return "medical";

  if (t.match(/uber|ola|travel|bus|train|flight|metro|fuel|petrol|diesel|parking|toll/))
    return "travel";

  if (t.match(/grocery|groceries|supermarket|mart|vegetable|dmart|reliance|store/))
    return "groceries";

  if (t.match(/shirt|pant|jeans|dress|clothing|footwear|shoes|apparel/))
    return "clothing";

  if (t.match(/amazon|flipkart|myntra|shopping|order id|invoice/))
    return "shopping";

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

  // Remove common non-amount long numbers that confuse OCR (GSTIN, phone etc.)
  const cleaned = normalized.replace(/\b\d{10,}\b/g, " ");

  const lines = cleaned
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  // More keywords used on Indian receipts
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

  // Helper: extract last plausible money number from a string
  const pickLastMoney = (s) => {
    // Matches: 123, 123.45, 1,234.50, ₹123.00
    const matches = s.match(/(?:₹\s*)?\d{1,3}(?:,\d{3})*(?:\.\d{2})?/g);
    if (!matches?.length) return null;

    // Convert to numbers
    const nums = matches
      .map((m) => Number(m.replace(/[₹,\s]/g, "")))
      .filter((n) => !Number.isNaN(n) && n > 0 && n < 1000000);

    if (!nums.length) return null;
    return nums[nums.length - 1];
  };

  // 1) Prefer numbers near total keywords
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    for (const k of keys) {
      if (line.includes(k)) {
        const window = [line, lines[i + 1] || "", lines[i + 2] || ""].join(" ");
        const val = pickLastMoney(window);
        if (val != null) return val;
      }
    }
  }

  // 2) Fallback: choose the largest MONEY-like number (but ignore tiny values)
  const allMoney = cleaned.match(/(?:₹\s*)?\d{1,3}(?:,\d{3})*(?:\.\d{2})?/g) || [];
  const nums = allMoney
    .map((m) => Number(m.replace(/[₹,\s]/g, "")))
    .filter((n) => !Number.isNaN(n) && n >= 10 && n < 1000000);

  if (!nums.length) return null;

  // prefer values with decimals if present (usually totals)
  const decimals = nums.filter((n) => Number.isInteger(n) === false);
  return decimals.length ? Math.max(...decimals) : Math.max(...nums);
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

  // Choose first meaningful line (letters, not mostly numbers)
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

  const keyWindow =
    t.match(/(bill date|invoice date|date)\s*[:\-]?\s*([0-3]?\d[\/\-][0-1]?\d[\/\-]20\d{2})/i) ||
    [];
  if (keyWindow[2]) {
    const s = keyWindow[2];
    const m = s.match(/([0-3]?\d)[\/\-]([0-1]?\d)[\/\-](20\d{2})/);
    if (m) {
      const dd = String(m[1]).padStart(2, "0");
      const mm = String(m[2]).padStart(2, "0");
      const yyyy = m[3];
      return new Date(`${yyyy}-${mm}-${dd}T00:00:00.000Z`).toISOString();
    }
  }

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

  m = t.match(
    /\b([0-2]?\d|3[01])\s(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s(20\d{2})\b/i
  );
  if (m) {
    const [_, dd, mon, yyyy] = m;
    const map = {
      jan: "01",
      feb: "02",
      mar: "03",
      apr: "04",
      may: "05",
      jun: "06",
      jul: "07",
      aug: "08",
      sep: "09",
      oct: "10",
      nov: "11",
      dec: "12",
    };
    const mm = map[mon.toLowerCase().slice(0, 3)];
    return new Date(`${yyyy}-${mm}-${String(dd).padStart(2, "0")}T00:00:00.000Z`).toISOString();
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

/* ----------------------------
   Upload Middleware
   ✅ accept BOTH "receipt" and "file"
---------------------------- */
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
   Route: OCR Scan
---------------------------- */
router.post("/scan", uploadAnyReceiptField, async (req, res) => {
  try {
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

    // ✅ IMAGE CASE
    if (mime.startsWith("image/")) {
      const rawText = await ocrBuffer(req.file.buffer);

      const data = {
        name: extractName(rawText),
        amount: extractAmount(rawText),
        category: detectCategory(rawText),
        date: extractDate(rawText),
      };

      return res.json({ success: true, type: "image", data });
    }

    // ✅ PDF CASE
// ✅ PDF CASE
    // ✅ PDF CASE
    if (mime === "application/pdf") {
      let pages;
      try {
        pages = await pdf(req.file.buffer, { scale: 2 });
      } catch (e) {
        return res.status(500).json({
          success: false,
          message:
            "PDF processing failed on server. Try uploading an image (JPG/PNG) instead.",
          error: e?.message || String(e),
        });
      }

      // --- helper: parse date from a single line ---
      const lineDateISO = (line) => {
        const iso = extractDate(line);
        if (iso) return iso;

        let m = line.match(/\b([0-3]?\d)[\/\-]([0-1]?\d)[\/\-](20\d{2})\b/);
        if (m) {
          const dd = String(m[1]).padStart(2, "0");
          const mm = String(m[2]).padStart(2, "0");
          const yyyy = m[3];
          return new Date(`${yyyy}-${mm}-${dd}T00:00:00.000Z`).toISOString();
        }

        m = line.match(
          /\b(20\d{2})[\/\-](0?\d|1[0-2])[\/\-]([0-2]?\d|3[01])\b/
        );
        if (m) {
          const yyyy = m[1];
          const mm = String(m[2]).padStart(2, "0");
          const dd = String(m[3]).padStart(2, "0");
          return new Date(`${yyyy}-${mm}-${dd}T00:00:00.000Z`).toISOString();
        }

        return null;
      };

      // --- helper: parse statement text into multiple debit transactions ---
      const parseDebitTransactionsFromText = (rawText) => {
        if (!rawText) return [];

        const text = normalizeDigits(String(rawText || ""))
          .replace(/\u00A0/g, " ")
          .replace(/[|]+/g, " ")
          .replace(/\t+/g, " ")
          .replace(/ +/g, " ");

        const lines = text
          .split(/\r?\n/)
          .map((l) => l.trim())
          .filter(Boolean);

        const tx = [];
        const seen = new Set();

        const moneyRegex =
          /(?:₹\s*)?\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|\b\d+(?:\.\d{1,2})?\b/g;

        const toNumber = (s) => {
          const n = Number(String(s).replace(/[₹,\s]/g, ""));
          return Number.isFinite(n) ? n : NaN;
        };

        const isDebitLine = (lineLower) => {
          if (lineLower.includes(" dr ") || lineLower.endsWith(" dr")) return true;
          if (lineLower.includes("debit")) return true;
          if (lineLower.includes("withdrawal") || lineLower.includes("wdl")) return true;
          if (lineLower.includes("atm")) return true;
          if (lineLower.includes("pos")) return true;
          if (lineLower.includes("upi")) return true;
          if (lineLower.includes("imps")) return true;
          if (lineLower.includes("neft")) return true;
          if (lineLower.includes("card")) return true;
          if (lineLower.includes("purchase")) return true;
          if (lineLower.includes("spent")) return true;
          if (lineLower.match(/-\s*\d/)) return true;
          return false;
        };

        for (const line of lines) {
          const low = line.toLowerCase();

          const isoDate = lineDateISO(line);
          if (!isoDate) continue;

          const matches = line.match(moneyRegex) || [];
          if (!matches.length) continue;

          let amount = NaN;

          const drIndex = low.indexOf("dr");
          if (drIndex !== -1) {
            const near = line.slice(
              Math.max(0, drIndex - 25),
              Math.min(line.length, drIndex + 25)
            );
            const nearMatches = near.match(moneyRegex) || [];
            if (nearMatches.length) amount = toNumber(nearMatches[nearMatches.length - 1]);
          }

          if (!Number.isFinite(amount)) {
            amount = toNumber(matches[matches.length - 1]);
          }

          if (!Number.isFinite(amount) || amount <= 0) continue;

          if (!isDebitLine(low)) continue;

          let desc = line;

          desc = desc.replace(/\b([0-3]?\d)[\/\-]([0-1]?\d)[\/\-](20\d{2})\b/, " ");
          desc = desc.replace(/\b(20\d{2})[\/\-](0?\d|1[0-2])[\/\-]([0-2]?\d|3[01])\b/, " ");

          desc = desc
            .replace(/\b(CR|DR|Cr|Dr)\b/g, " ")
            .replace(/\b(debit|credit)\b/gi, " ")
            .replace(/\b(INR|Rs\.?|₹)\b/gi, " ");

          desc = desc.replace(moneyRegex, " ");
          desc = desc.replace(/ +/g, " ").trim();
          if (!desc) desc = "Expense";

          const item = {
            name: desc,
            amount: Number(amount),
            date: isoDate,
            category: detectCategory(desc),
          };

          const key = `${item.date}__${item.amount}__${item.name}`;
          if (seen.has(key)) continue;
          seen.add(key);

          tx.push(item);
        }

        return tx;
      };

      // ✅ OCR all pages and combine text
      let combinedText = "";
      for await (const page of pages) {
        const rawText = await ocrBuffer(page);
        if (rawText) combinedText += "\n" + rawText;
      }

      // ✅ Extract MULTIPLE debit transactions
      const transactions = parseDebitTransactionsFromText(combinedText);

      if (!transactions.length) {
        const fallback = [];
        const text = normalizeDigits(String(combinedText || ""));
        const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

        for (const line of lines) {
          const isoDate = lineDateISO(line);
          if (!isoDate) continue;

          const matches = line.match(moneyRegex) || [];
          if (!matches.length) continue;

          const amt = Number(String(matches[matches.length - 1]).replace(/[₹,\s]/g, ""));
          if (!Number.isFinite(amt) || amt <= 0) continue;

          let desc = line.replace(matches[matches.length - 1], "").trim();
          desc = desc.replace(/ +/g, " ").trim();
          if (!desc) desc = "Expense";

          fallback.push({
            name: desc,
            amount: amt,
            date: isoDate,
            category: detectCategory(desc),
          });
        }

        return res.json({ success: true, type: "pdf", data: fallback });
      }

      return res.json({ success: true, type: "pdf", data: transactions });
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
