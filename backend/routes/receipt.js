import { Router } from "express";
import multer from "multer";
import Tesseract from "tesseract.js";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
});

// simple keyword category detection
function detectCategory(text) {
  const t = text.toLowerCase();

  if (t.match(/restaurant|cafe|coffee|tea|pizza|burger|food|hotel/)) return "food";
  if (t.match(/medical|pharmacy|apollo|clinic|hospital|tablet|medicine/)) return "medical";
  if (t.match(/travel|uber|ola|bus|train|flight|metro/)) return "travel";
  if (t.match(/grocery|supermarket|mart|fresh|vegetable/)) return "groceries";
  if (t.match(/shirt|pant|jeans|dress|clothing/)) return "clothing";
  if (t.match(/mall|amazon|flipkart|shopping/)) return "shopping";

  return "other";
}

// find biggest amount (usually total)
function extractAmount(text) {
  const matches = text.match(/(\d+[.,]\d{2}|\d+)/g) || [];
  const nums = matches
    .map((n) => Number(n.replace(",", "")))
    .filter((n) => !isNaN(n) && n > 0 && n < 100000);

  if (!nums.length) return null;

  return Math.max(...nums);
}

// merchant guess = first readable line
function extractName(text) {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 3);

  return lines[0]?.slice(0, 40) || "Expense";
}

router.post("/scan", upload.single("receipt"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No file" });
    }

    const ocr = await Tesseract.recognize(req.file.buffer, "eng");
    const rawText = (ocr.data.text || "").trim();

    if (!rawText) {
      return res.json({
        success: true,
        data: { name: "", amount: null, category: "other", rawText: "" },
      });
    }

    const amount = extractAmount(rawText);
    const name = extractName(rawText);
    const category = detectCategory(rawText);

    return res.json({
      success: true,
      data: {
        name,
        amount,
        category,
        rawText,
      },
    });
  } catch (err) {
    console.log("FREE OCR error:", err);
    res.status(500).json({ success: false, message: "OCR failed" });
  }
});

export default router;
