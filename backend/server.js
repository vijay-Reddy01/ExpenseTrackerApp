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

const app = express();

/* =======================
   MIDDLEWARE
======================= */
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

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
    if (exists) {
      return res.status(409).json({ success: false, message: "User already exists." });
    }

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
    if (!user) {
      return res.status(401).json({ success: false, message: "Invalid credentials." });
    }

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
      return res.status(401).json({ success: false, message: "Invalid credentials." });
    }

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
      data: {
        ...user,
        transactions: expenses,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || "Failed to load data." });
  }
});

/* =======================
   ✅ UPDATE PROFILE (username + income)
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

/* =======================
   INSIGHTS ✅
======================= */
function mapPeriod(period) {
  return period === "weekly" ? "week" : "month";
}

function sinceDate(period) {
  const days = period === "weekly" ? 7 : 30;
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

function runAI({ email, period, salary, expenses }) {
  return new Promise((resolve, reject) => {
    const pythonScriptPath = path.join(__dirname, "..", "ai", "analyze_expenses.py");
    const PYTHON_BIN = process.env.PYTHON_BIN || "python"; // Windows: set PYTHON_BIN=py if needed

    const py = spawn(PYTHON_BIN, [
      pythonScriptPath,
      "--email",
      email,
      "--period",
      mapPeriod(period),
      "--salary",
      String(salary || 0),
    ]);

    let out = "";
    let err = "";

    py.stdout.on("data", (chunk) => (out += chunk.toString()));
    py.stderr.on("data", (chunk) => (err += chunk.toString()));

    py.on("close", (code) => {
      if (code !== 0) return reject(new Error(err || "AI script failed."));
      try {
        const parsed = JSON.parse(out.trim() || "{}");
        if (parsed?.error) return reject(new Error(parsed.error));
        resolve(parsed);
      } catch {
        reject(new Error(`Failed to parse AI response. Raw output: ${out}`));
      }
    });

    py.stdin.write(JSON.stringify(expenses || []));
    py.stdin.end();
  });
}

app.get("/api/insights", async (req, res) => {
  try {
    const email = String(req.query.email || "").toLowerCase().trim();
    const period = String(req.query.period || "monthly");

    if (!email) return res.status(400).json({ success: false, message: "Email required." });

    const user = await User.findOne({ email }).lean();
    const salary = Number(user?.income || 0);

    const from = sinceDate(period);

    // ✅ filter by date OR createdAt (safe)
    const expenses = await Expense.find({
      userEmail: email,
      $or: [{ date: { $gte: from } }, { createdAt: { $gte: from } }],
    }).lean();

    if (!expenses || expenses.length === 0) {
      return res.json({ success: true, insight: null });
    }

    const insight = await runAI({ email, period, salary, expenses });
    return res.json({ success: true, insight });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || "AI analysis failed." });
  }
});

/* =======================
   SEND INSIGHTS EMAIL ✅
======================= */
app.post("/api/insights/email", async (req, res) => {
  try {
    const email = String(req.body.email || "").toLowerCase().trim();
    const period = req.body.period || "monthly";

    if (!email) {
      return res.status(400).json({ success: false, message: "Email required" });
    }

    // 1️⃣ Fetch user
    const user = await User.findOne({ email }).lean();
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // 2️⃣ Fetch expenses
    const expenses = await Expense.find({ userEmail: email }).lean();
    if (!expenses.length) {
      return res.status(400).json({
        success: false,
        message: "No expenses found to send summary",
      });
    }

    // 3️⃣ Build SIMPLE summary (no AI dependency)
    const total = expenses.reduce((sum, e) => sum + e.amount, 0);

    const text = `
Expense Summary (${period.toUpperCase()})

Total Expenses: ₹${total}

Income: ₹${user.income}

Transactions:
${expenses.map(e => `• ${e.name} - ₹${e.amount}`).join("\n")}
`;

    // 4️⃣ Send email
    await sendMail({
      to: email,
      subject: "Your Expense Summary",
      html: `<pre>${text}</pre>`,
    });

    return res.json({
      success: true,
      message: "Expense summary email sent successfully",
    });
  } catch (err) {
    console.error("EMAIL ERROR:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to send email",
    });
  }
});

function buildEmailText({ periodLabel, insight, salary }) {
  const formatGroup = (title, items) => {
    if (!items?.length) return `${title}: None\n\n`;
    return (
      `${title}:\n` +
      items
        .map((x) => {
          const pct = x.pctOfIncome != null ? ` (${x.pctOfIncome}%)` : "";
          return `• ${String(x.category).toUpperCase()}: ₹${Number(x.spend).toFixed(2)}${pct}`;
        })
        .join("\n") +
      "\n\n"
    );
  };

  const tips = [
    "1) Set a monthly cap for Shopping/Travel and track weekly.",
    "2) Use the 50/30/20 rule: Needs/Wants/Savings.",
    "3) Cut 1 recurring expense (subscriptions/food delivery).",
    "4) Avoid small daily spends adding up (snacks/coffee).",
    "5) Keep 10% buffer for emergencies.",
  ].join("\n");

  return (
    `Expense Insights (${periodLabel})\n\n` +
    `Total Spend: ₹${Number(insight.totalSpend || 0).toFixed(2)}\n` +
    `Salary: ₹${Number(insight.income || 0).toFixed(2)}\n` +
    `Remaining: ₹${Number(insight.remaining || 0).toFixed(2)}\n\n` +
    formatGroup("LOW (≤10% per category)", insight.grouped?.low) +
    formatGroup("MEDIUM (10–25% per category)", insight.grouped?.medium) +
    formatGroup("HIGH (>25% per category)", insight.grouped?.high) +
    `AI Suggestions:\n${insight.suggestion || "No suggestion available."}\n\n` +
    `Tips to manage expenses effectively:\n${tips}\n`
  );
}

async function sendInsightsForPeriodToUser(user, period) {
  const email = String(user.email || "").toLowerCase().trim();
  if (!email) return;

  const salary = Number(user.income || 0);
  const from = sinceDate(period);

  const expenses = await Expense.find({
    userEmail: email,
    $or: [{ date: { $gte: from } }, { createdAt: { $gte: from } }],
  }).lean();

  // If no expenses, skip auto email (avoid spamming empty emails)
  if (!expenses?.length) return;

  const insight = await runAI({ email, period, salary, expenses });

  const periodLabel = period === "weekly" ? "Weekly Summary (Last 7 days)" : "Monthly Summary (Last 30 days)";
  const text = buildEmailText({ periodLabel, insight, salary });

  await sendMail({
    to: email,
    subject: `AI Expense Tracker • ${periodLabel}`,
    html: `<pre style="font-family: Arial, sans-serif; white-space: pre-wrap;">${text}</pre>`,
  });
}

async function sendInsightsToAllUsers(period) {
  const users = await User.find().lean();
  console.log(`📩 Auto Email Job Started: ${period} • Users: ${users.length}`);

  let sent = 0;
  let failed = 0;

  for (const user of users) {
    try {
      await sendInsightsForPeriodToUser(user, period);
      sent++;
    } catch (err) {
      failed++;
      console.error(`❌ Failed for ${user?.email}:`, err?.message || err);
    }
  }

  console.log(`✅ Auto Email Job Finished: ${period} • Sent: ${sent} • Failed: ${failed}`);
}

function isLastDayOfMonth(date = new Date()) {
  const tomorrow = new Date(date);
  tomorrow.setDate(date.getDate() + 1);
  return tomorrow.getDate() === 1;
}


/* =======================
   SERVER START
======================= */
const PORT = process.env.PORT || 4000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Backend server is running on port ${PORT}`);

  // ============================
  // ✅ WEEKLY AUTO EMAIL
  // Every Sunday at 9:00 PM
  // ============================
  cron.schedule(
    "0 21 * * 0",
    async () => {
      try {
        await sendInsightsToAllUsers("weekly");
      } catch (err) {
        console.error("❌ Weekly cron failed:", err?.message || err);
      }
    },
    { timezone: "Asia/Kolkata" }
  );

  // ============================
  // ✅ MONTHLY AUTO EMAIL
  // Runs daily at 9:00 PM,
  // but sends ONLY if it's last day of month.
  // ============================
  cron.schedule(
    "0 21 * * *",
    async () => {
      try {
        if (!isLastDayOfMonth(new Date())) return;
        await sendInsightsToAllUsers("monthly");
      } catch (err) {
        console.error("❌ Monthly cron failed:", err?.message || err);
      }
    },
    { timezone: "Asia/Kolkata" }
  );

  console.log("⏰ Cron jobs scheduled: Weekly (Sun 9PM), Monthly (Last day 9PM) [Asia/Kolkata]");
});

