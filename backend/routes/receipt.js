import { Router } from "express";
import multer from "multer";
import Tesseract from "tesseract.js";
import { pdf } from "pdf-to-img";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
});

function detectCategory(text) {
  const t = text.toLowerCase();
  if (t.match(/restaurant|cafe|coffee|tea|pizza|burger|biryani|food|hotel/)) return "food";
  if (t.match(/medical|pharmacy|clinic|hospital|tablet|medicine|apollo/)) return "medical";
  if (t.match(/uber|ola|travel|bus|train|flight|metro|fuel|petrol|diesel/)) return "travel";
  if (t.match(/grocery|groceries|supermarket|mart|fresh|vegetable|dmart|reliance/)) return "groceries";
  if (t.match(/shirt|pant|jeans|dress|clothing|footwear|shoes/)) return "clothing";
  if (t.match(/amazon|flipkart|myntra|shopping|store|mall/)) return "shopping";
  return "other";
}

function normalizeDigits(text) {
  // turns "1 2 4 9 . 0 0" into "1249.00"
  return text
    .replace(/(\d)\s+(?=\d)/g, "$1")       // remove spaces between digits
    .replace(/(\d)\s*[.,]\s*(\d)/g, "$1.$2") // normalize decimal separators
    .replace(/,/g, "");
}

function extractAmount(text) {
  const normalized = normalizeDigits(text.toLowerCase());
  const lines = normalized
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  // Search on the same line and also the NEXT line (many receipts put amount on next line)
  const keys = [
    "net payable",
    "net amount",
    "amount payable",
    "grand total",
    "total",
    "gross amt",
    "gross amount",
  ];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    for (const k of keys) {
      if (line.includes(k)) {
        const window = [line, lines[i + 1] || "", lines[i + 2] || ""].join(" ");
        const nums = window.match(/(\d+\.\d{2}|\d{3,6})/g);
        if (nums?.length) {
          const val = Number(nums[nums.length - 1]);
          if (!Number.isNaN(val) && val > 0) return val;
        }
      }
    }
  }

  // fallback: pick biggest reasonable number
  const allNums = (normalized.match(/(\d+\.\d{2}|\d{3,6})/g) || [])
    .map(Number)
    .filter((n) => !Number.isNaN(n) && n > 50 && n < 1000000);

  if (!allNums.length) return null;
  return Math.max(...allNums);
}



function extractName(text) {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  return lines.find(l => l.length > 5 && !l.match(/\d/)) || "Expense";
}


/**
 * Extract a date from receipt text.
 * Supports formats like:
 *  - 12/01/2026
 *  - 12-01-2026
 *  - 12 Jan 2026
 *  - 2026-01-12
 */
function extractDate(text) {
  const t = text.replace(/\s+/g, " ");

  // yyyy-mm-dd
  let m = t.match(/\b(20\d{2})[-\/](0?\d|1[0-2])[-\/]([0-2]?\d|3[01])\b/);
  if (m) {
    const [_, yyyy, mm, dd] = m;
    return new Date(`${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}T00:00:00.000Z`).toISOString();
  }

  // dd-mm-yyyy or dd/mm/yyyy
  m = t.match(/\b([0-2]?\d|3[01])[-\/](0?\d|1[0-2])[-\/](20\d{2})\b/);
  if (m) {
    const [_, dd, mm, yyyy] = m;
    return new Date(`${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}T00:00:00.000Z`).toISOString();
  }

  // dd Mon yyyy
  m = t.match(/\b([0-2]?\d|3[01])\s(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s(20\d{2})\b/i);
  if (m) {
    const [_, dd, mon, yyyy] = m;
    const map = {
      jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
      jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
    };
    const mm = map[mon.toLowerCase().slice(0, 3)];
    return new Date(`${yyyy}-${mm}-${String(dd).padStart(2, "0")}T00:00:00.000Z`).toISOString();
  }

  return null;
}

async function ocrBuffer(buffer) {
  const ocr = await Tesseract.recognize(buffer, "eng");
  return (ocr?.data?.text || "").trim();
}

router.post("/scan", upload.single("receipt"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: "No file uploaded" });

    const mime = req.file.mimetype;

    // ✅ IMAGE CASE
    if (mime.startsWith("image/")) {
      const rawText = await ocrBuffer(req.file.buffer);

      const data = {
        name: extractName(rawText),
        amount: extractAmount(rawText),
        category: detectCategory(rawText),
        date: extractDate(rawText), // ✅ date extracted for image
        rawText,
      };

      return res.json({ success: true, type: "image", data });
    }

    // ✅ PDF CASE (extract each page as image, OCR, collect dates)
    if (mime === "application/pdf") {
      const pages = await pdf(req.file.buffer, { scale: 2 }); // scale improves OCR
      const extracted = [];

      for await (const page of pages) {
        const rawText = await ocrBuffer(page);
        const item = {
          name: extractName(rawText),
          amount: extractAmount(rawText),
          category: detectCategory(rawText),
          date: extractDate(rawText),
          rawText,
        };
        // only keep if it looks meaningful
        if (item.amount || item.date) extracted.push(item);
      }

      return res.json({
        success: true,
        type: "pdf",
        data: extracted, // array of entries (per page)
      });
    }

    return res.status(400).json({ success: false, message: "Unsupported file type" });
  } catch (err) {
    console.log("receipt scan error:", err);
    return res.status(500).json({ success: false, message: err?.message || "Scan failed" });
  }
});

export default router;
