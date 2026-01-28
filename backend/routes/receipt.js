import { Router } from "express";
import multer from "multer";
import Tesseract from "tesseract.js";
import OpenAI from "openai";

const router = Router();

// Multer in-memory upload (no need to store on disk)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 }, // 8MB
});

// OpenAI client
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Allowed categories in your app
const ALLOWED = ["food", "shopping", "clothing", "groceries", "travel", "medical", "other"];

function sanitizeCategory(cat) {
  const c = String(cat || "").toLowerCase().trim();
  return ALLOWED.includes(c) ? c : "other";
}

// Extract the best "total amount" guess from text as fallback
function fallbackTotal(text) {
  const t = text.toLowerCase();
  // common receipt keywords
  const lines = t.split("\n").map((l) => l.trim()).filter(Boolean);

  // Try to find a line containing total/grand total/amount due
  const keys = ["grand total", "total", "amount due", "net total", "balance due", "payable"];
  for (const key of keys) {
    const line = lines.find((l) => l.includes(key));
    if (line) {
      const m = line.match(/(\d+[.,]\d{2}|\d+)/g);
      if (m?.length) return Number(String(m[m.length - 1]).replace(",", ""));
    }
  }

  // otherwise pick the largest number that looks like money
  const nums = (t.match(/(\d+[.,]\d{2}|\d+)/g) || [])
    .map((x) => Number(String(x).replace(",", "")))
    .filter((n) => !Number.isNaN(n) && n > 0 && n < 10000000);

  if (!nums.length) return null;
  return Math.max(...nums);
}

router.post("/scan", upload.single("receipt"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No receipt file uploaded" });
    }

    // OCR
    const ocr = await Tesseract.recognize(req.file.buffer, "eng");
    const text = (ocr?.data?.text || "").trim();

    if (!text) {
      return res.status(200).json({
        success: true,
        data: { name: "", amount: null, category: "other", rawText: "" },
        message: "No text detected",
      });
    }

    // OpenAI parse (JSON only)
    const prompt = `
You are extracting structured expense data from a receipt OCR text.

Return STRICT JSON ONLY with keys:
- name: short string (merchant or main item)
- amount: number (total amount paid)
- category: one of ["food","shopping","clothing","groceries","travel","medical","other"]

Rules:
- Prefer the final total paid (grand total/total/amount due).
- If currency symbols exist (₹, Rs, INR, etc.), ignore them and output number only.
- Keep name short (2-5 words) and useful.
- If unsure, set category = "other".
OCR TEXT:
"""${text}"""
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.2,
    });

    let parsed = {};
    try {
      parsed = JSON.parse(completion.choices?.[0]?.message?.content || "{}");
    } catch {
      parsed = {};
    }

    // Normalize results
    const name = String(parsed.name || "").trim().slice(0, 60);

    // amount normalization + fallback
    let amount = parsed.amount;
    if (typeof amount === "string") amount = Number(amount.replace(",", ""));
    if (typeof amount !== "number" || Number.isNaN(amount) || amount <= 0) {
      amount = fallbackTotal(text);
    }

    const category = sanitizeCategory(parsed.category);

    return res.json({
      success: true,
      data: {
        name: name || "",
        amount: amount ?? null,
        category,
        // helpful for debugging (you can remove later)
        rawText: text,
      },
    });
  } catch (err) {
    console.log("receipt scan error:", err);
    return res.status(500).json({
      success: false,
      message: err?.message || "Receipt scan failed",
    });
  }
});

export default router;
