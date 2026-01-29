// backend/server.js
import dotenv from "dotenv";
dotenv.config();

import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import bcrypt from "bcryptjs";
import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import { sendMail } from "./utils/mailer.js";
import cron from "node-cron";
//import OpenAI from "openai";
import receiptRouter from "./routes/receipt.js";
import Expense from "./models/Expense.js";

const app = express();

/*const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});*/

/* =======================
   MIDDLEWARE
======================= */
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use("/api/receipt", receiptRouter);

/* =======================
   __dirname FIX (ESM)
======================= */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* =======================
   DATABASE
======================= */
const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/ExpenseTrackerApp";

mongoose
  .connect(MONGO_URI)
  .then(() => console.log("✅ MongoDB connected successfully"))
  .catch((err) => console.error("❌ MongoDB connection error:", err.message));

/* =======================
   SCHEMAS
======================= */
const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    income: { type: Number, default: 0 },
  },
  { timestamps: true }
);
const User = mongoose.model("User", userSchema);

const expenseSchema = new mongoose.Schema(
  {
    userEmail: { type: String, required: true, lowercase: true, trim: true, index: true },
    name: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 0 },
    category: {
      type: String,
      required: true,
      enum: ["food", "shopping", "clothing", "groceries", "travel", "medical", "other"],
      default: "other",
    },
    description: { type: String, trim: true },
    date: { type: Date, default: Date.now },
  },
  { timestamps: true }
);
const Expense = mongoose.model("Expense", expenseSchema);

/* =======================
   HELPERS
======================= */
function mapPeriod(period) {
  return period === "weekly" ? "week" : "month";
}

function sinceDate(period) {
  const days = period === "weekly" ? 7 : 30;
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

async function getSpendingSuggestions({ period, income, expenses }) {
  const totals = expenses.reduce((acc, e) => {
    const c = (e.category || "other").toLowerCase();
    acc[c] = (acc[c] || 0) + Number(e.amount || 0);
    return acc;
  }, {});

  const payload = {
    period,
    income,
    total: expenses.reduce((s, e) => s + Number(e.amount || 0), 0),
    categories: totals,
  };

  const completion = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    messages: [
      {
        role: "system",
        content:
          "You are a personal finance assistant. Give short, practical advice. Return exactly 6 bullet points.",
      },
      {
        role: "user",
        content: `Analyze this spending JSON and suggest where to reduce expenses:\n${JSON.stringify(
          payload
        )}`,
      },
    ],
    temperature: 0.4,
  });

  return completion.choices[0].message.content;
}


function isLastDayOfMonth(date = new Date()) {
  const tomorrow = new Date(date);
  tomorrow.setDate(date.getDate() + 1);
  return tomorrow.getDate() === 1;
}

/* =======================
   HEALTH CHECK
======================= */
app.get("/api/health", (req, res) => {
  res.json({ success: true, message: "API is working ✅" });
});

/* =======================
   AUTH ROUTES
======================= */
app.post("/api/signup", async (req, res) => {
  try {
    const { username, email, password } = req.body;

    const cleanEmail = String(email || "").toLowerCase().trim();
    const cleanUsername = String(username || "").trim();

    if (!cleanUsername || !cleanEmail || !password) {
      return res.status(400).json({ success: false, message: "All fields are required." });
    }

    const exists = await User.findOne({ email: cleanEmail });
    if (exists) return res.status(409).json({ success: false, message: "User already exists." });

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await User.create({
      username: cleanUsername,
      email: cleanEmail,
      password: hashedPassword,
      income: 0,
    });

    return res.status(201).json({
      success: true,
      user: { email: newUser.email, username: newUser.username },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || "Signup failed." });
  }
});

app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const cleanEmail = String(email || "").toLowerCase().trim();
    if (!cleanEmail || !password) {
      return res.status(400).json({ success: false, message: "Email and password required." });
    }

    const user = await User.findOne({ email: cleanEmail });
    if (!user) return res.status(401).json({ success: false, message: "Invalid credentials." });

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ success: false, message: "Invalid credentials." });

    return res.json({ success: true, user: { email: user.email, username: user.username } });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || "Login failed." });
  }
});

/* =======================
   USER DATA
======================= */
app.get("/api/user/data", async (req, res) => {
  try {
    const email = String(req.query.email || "").toLowerCase().trim();
    if (!email) return res.status(400).json({ success: false, message: "Email required." });

    const user = await User.findOne({ email }).select("-password").lean();
    if (!user) return res.status(404).json({ success: false, message: "User not found." });

    const expenses = await Expense.find({ userEmail: email }).sort({ date: -1 }).lean();

    return res.json({
      success: true,
      data: { ...user, transactions: expenses },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || "Failed to load data." });
  }
});

/* =======================
   UPDATE PROFILE
======================= */
app.post("/api/user/profile", async (req, res) => {
  try {
    const email = String(req.body?.email || "").toLowerCase().trim();
    const username = String(req.body?.username || "").trim();
    const incomeNum = Number(req.body?.income);

    if (!email) return res.status(400).json({ success: false, message: "Email is required." });
    if (!username) return res.status(400).json({ success: false, message: "Username is required." });
    if (Number.isNaN(incomeNum) || incomeNum < 0) {
      return res.status(400).json({ success: false, message: "Income must be a valid number." });
    }

    const updated = await User.findOneAndUpdate(
      { email },
      { $set: { username, income: incomeNum } },
      { new: true }
    )
      .select("-password")
      .lean();

    if (!updated) return res.status(404).json({ success: false, message: "User not found." });

    return res.json({ success: true, message: "Profile updated.", user: updated });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || "Profile update failed." });
  }
});

/* =======================
   ADD EXPENSE
======================= */
app.post("/api/expenses", async (req, res) => {
  try {
    const { email, name, amount, category, date, description } = req.body;
    const cleanEmail = String(email || "").toLowerCase().trim();

    if (!cleanEmail || !name || amount === undefined || !category) {
      return res.status(400).json({ success: false, message: "Required fields missing." });
    }

    const expense = await Expense.create({
      userEmail: cleanEmail,
      name: String(name).trim(),
      amount: Number(amount),
      category,
      date: date ? new Date(date) : new Date(),
      description: String(description || "").trim(),
    });

    return res.status(201).json({ success: true, message: "Expense added.", expense });
  } catch (error) {
    console.error("❌ Add expense error:", error);
    return res.status(500).json({ success: false, message: error.message || "Adding expense failed." });
  }
});
/*============================
  Delete Expense
============================*/
app.delete("/api/expenses/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const deleted = await Expense.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: "Expense not found" });
    }

    return res.json({ success: true, message: "Expense deleted" });
  } catch (e) {
    console.log("delete expense error:", e);
    return res.status(500).json({ success: false, message: "Failed to delete expense" });
  }
});
/* =======================
   SEND INSIGHTS EMAIL ✅ (Filtered by period)
======================= */
app.post("/api/insights/email", async (req, res) => {
  try {
    const email = String(req.body.email || "").toLowerCase().trim();
    const period = String(req.body.period || "monthly");

    if (!email) return res.status(400).json({ success: false, message: "Email required" });

    const user = await User.findOne({ email }).lean();
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    // ✅ Fetch expenses ONLY for requested period
    const from = sinceDate(period);
    const expenses = await Expense.find({
      userEmail: email,
      $or: [{ date: { $gte: from } }, { createdAt: { $gte: from } }],
    })
      .sort({ date: -1 })
      .lean();

    if (!expenses.length) {
      return res.status(400).json({ success: false, message: "No expenses found for this period" });
    }

    const total = expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);

    let aiTips = "";
try {
  aiTips = await getSpendingSuggestions({
    period,
    income: user.income,
    expenses,
  });
} catch (e) {
  console.error("AI failed:", e.message);
}


   const text = `
Expense Summary (${period.toUpperCase()})

Total Expenses: ₹${total}
Income: ₹${user.income}

AI Suggestions:
${aiTips || "No suggestions available"}

Transactions:
${expenses.map(e => `• ${e.name} - ₹${e.amount} (${e.category})`).join("\n")}
`;


    await sendMail({
      to: email,
      subject: `Your Expense Summary (${period.toUpperCase()})`,
      html: `<pre style="white-space: pre-wrap; font-family: Arial, sans-serif;">${text}</pre>`,
      text,
    });

    return res.json({ success: true, message: "Expense summary email sent successfully" });
  } catch (err) {
    console.error("EMAIL ERROR:", err);
    return res.status(500).json({ success: false, message: err?.message || "Failed to send email" });
  }
});

/* =======================
   ✅ TEST MAIL ROUTE (ONLY ONCE)
======================= */
app.get("/api/test-mail", async (req, res) => {
  try {
    const to = String(req.query.to || "").trim();
    if (!to) return res.status(400).json({ success: false, message: "to=email is required" });

    await sendMail({
      to,
      subject: "Test Email from Render",
      html: "<h3>If you received this, email sending is working ✅</h3>",
      text: "If you received this, email sending is working ✅",
    });

    return res.json({ success: true, message: "Test mail sent" });
  } catch (err) {
    console.error("TEST MAIL ERROR:", err);
    return res.status(500).json({
      success: false,
      message: err?.message || "Test mail failed",
      code: err?.code || null,
      response: err?.response || null,
    });
  }
});

/* =======================
   SERVER START
======================= */
const PORT = process.env.PORT || 4000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Backend server is running on port ${PORT}`);

  cron.schedule(
    "0 21 * * 0",
    async () => {
      try {
        // keep if you want, but better to move to Render cron job later
        // await sendInsightsToAllUsers("weekly");
      } catch (err) {
        console.error("❌ Weekly cron failed:", err?.message || err);
      }
    },
    { timezone: "Asia/Kolkata" }
  );

  cron.schedule(
    "0 21 * * *",
    async () => {
      try {
        if (!isLastDayOfMonth(new Date())) return;
        // await sendInsightsToAllUsers("monthly");
      } catch (err) {
        console.error("❌ Monthly cron failed:", err?.message || err);
      }
    },
    { timezone: "Asia/Kolkata" }
  );

  console.log("⏰ Cron jobs scheduled (note: for production use Render Cron Jobs).");
});
