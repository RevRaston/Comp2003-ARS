import express from "express";
import multer from "multer";
import Tesseract from "tesseract.js";
import crypto from "crypto";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

function cleanItemName(name) {
  return String(name || "")
    .replace(/\s+/g, " ")
    .replace(/[£$]/g, "")
    .trim();
}

function shouldSkipLine(name, cost) {
  const lowered = name.toLowerCase();

  const skipWords = [
    "total",
    "subtotal",
    "sub total",
    "vat",
    "tax",
    "change",
    "cash",
    "card",
    "visa",
    "mastercard",
    "balance",
    "amount due",
    "service",
    "receipt",
    "table",
    "server",
    "thank you",
    "auth code",
    "approved",
  ];

  if (!name || name.length < 2) return true;
  if (Number.isNaN(cost) || cost <= 0) return true;
  if (skipWords.some((word) => lowered.includes(word))) return true;

  return false;
}

router.post("/scan-receipt", upload.single("receipt"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No receipt uploaded" });
    }

    const imageBuffer = req.file.buffer;

    const result = await Tesseract.recognize(imageBuffer, "eng", {
      logger: () => {},
    });

    const text = result?.data?.text || "";
    console.log("🧾 OCR RAW TEXT:\n", text);

    const lines = text
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    const items = [];

    for (const line of lines) {
      const cleaned = line.replace(/\s+/g, " ").trim();

      const match = cleaned.match(/^(.*?)(?:\s+|£)?(\d+\.\d{2})$/);
      if (!match) continue;

      const rawName = cleanItemName(match[1]);
      const cost = parseFloat(match[2]);

      if (shouldSkipLine(rawName, cost)) continue;

      items.push({
        id: crypto.randomUUID(),
        name: rawName,
        cost,
      });
    }

    const deduped = [];
    const seen = new Set();

    for (const item of items) {
      const key = `${item.name.toLowerCase()}__${Number(item.cost).toFixed(2)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(item);
    }

    if (deduped.length === 0) {
      return res.json({
        items: [],
        warning: "No items detected. Try a clearer image or better lighting.",
      });
    }

    return res.json({
      items: deduped,
    });
  } catch (err) {
    console.error("Receipt scan failed:", err);
    return res.status(500).json({
      error: "Failed to scan receipt",
    });
  }
});

export default router;