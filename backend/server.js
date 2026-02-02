// backend/server.js
import dotenv from "dotenv";
dotenv.config();

import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import bcrypt from "bcryptjs";

import receiptRouter from "./routes/receipt.js";
import { sendMail } from "./utils/mailer.js";

const app = express();

/* =======================
   MIDDLEWARE
======================= */
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "10mb" }));
app.use("/api/receipt", receiptRouter); // ✅ receipt routes only

/* =======================
   DATABASE
======================= */
const MONGO_URI =
  process.env.MONGO_URI || "mongodb://127.0.0.1:27017/ExpenseTrackerApp";

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
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    password: { type: String, required: true },
    income: { type: Number, default: 0 },
    photoUrl: { type: String, default: "" },
  },
  { timestamps: true }
);
const User = mongoose.models.User || mongoose.model("User", userSchema);

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
const Expense = mongoose.models.Expense || mongoose.model("Expense", expenseSchema);

/* =======================
   HEALTH
======================= */
app.get("/api/health", (req, res) => {
  res.json({ success: true, message: "API working ✅" });
});

/* =======================
   AUTH
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
      photoUrl: "",
    });

    return res.status(201).json({
      success: true,
      user: { email: newUser.email, username: newUser.username },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err?.message || "Signup failed." });
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

    return res.json({
      success: true,
      user: { email: user.email, username: user.username },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err?.message || "Login failed." });
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
  } catch (err) {
    return res.status(500).json({ success: false, message: err?.message || "Failed to load data." });
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
    const photoUrl = String(req.body?.photoUrl || "");

    if (!email) return res.status(400).json({ success: false, message: "Email is required." });
    if (!username) return res.status(400).json({ success: false, message: "Username is required." });
    if (Number.isNaN(incomeNum) || incomeNum < 0) {
      return res.status(400).json({ success: false, message: "Income must be a valid number." });
    }
    if (photoUrl.length > 2_000_000) {
      return res.status(400).json({ success: false, message: "Photo too large." });
    }

    const updated = await User.findOneAndUpdate(
      { email },
      { $set: { username, income: incomeNum, photoUrl } },
      { new: true }
    )
      .select("-password")
      .lean();

    if (!updated) return res.status(404).json({ success: false, message: "User not found." });

    return res.json({ success: true, message: "Profile updated.", user: updated });
  } catch (err) {
    return res.status(500).json({ success: false, message: err?.message || "Profile update failed." });
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
  } catch (err) {
    return res.status(500).json({ success: false, message: err?.message || "Adding expense failed." });
  }
});

/* =======================
   ✅ SAVE SCANNED RECEIPT
======================= */
app.post("/api/receipt/save", async (req, res) => {
  try {
    const { email, name, amount, category, date, description } = req.body;

    const cleanEmail = String(email || "").toLowerCase().trim();
    if (!cleanEmail) return res.status(400).json({ success: false, message: "Email required." });

    if (!name || amount === undefined || !category) {
      return res.status(400).json({ success: false, message: "Missing fields." });
    }

    const expense = await Expense.create({
      userEmail: cleanEmail,
      name: String(name).trim(),
      amount: Number(amount),
      category,
      date: date ? new Date(date) : new Date(),
      description: String(description || "Scanned receipt").trim(),
    });

    return res.status(201).json({ success: true, message: "Saved scanned expense.", expense });
  } catch (e) {
    return res.status(500).json({ success: false, message: e?.message || "Save failed." });
  }
});

/* =======================
   ✅ SEND INSIGHTS EMAIL
======================= */
app.post("/api/insights/email", async (req, res) => {
  try {
    const email = String(req.body?.email || "").toLowerCase().trim();
    const period = String(req.body?.period || "monthly");

    if (!email) return res.status(400).json({ success: false, message: "Email required." });

    const user = await User.findOne({ email }).lean();
    if (!user) return res.status(404).json({ success: false, message: "User not found." });

    const tx = await Expense.find({ userEmail: email }).lean();

    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();

    const thisMonth = tx.filter((t) => {
      const d = new Date(t?.date);
      return !Number.isNaN(d.getTime()) && d.getMonth() === month && d.getFullYear() === year;
    });

    const income = Number(user?.income || 0);
    const spent = thisMonth.reduce((sum, t) => sum + Number(t?.amount || 0), 0);
    const ratio = income > 0 ? (spent / income) * 100 : 0;
    const savings = income > 0 ? Math.max(0, income - spent) : 0;

    const totals = {};
    for (const t of thisMonth) {
      const c = String(t?.category || "other");
      totals[c] = (totals[c] || 0) + Number(t?.amount || 0);
    }
    const topCats = Object.entries(totals).sort((a, b) => b[1] - a[1]).slice(0, 3);

    let status = "No Income Set";
    let tip = "Set your income in Profile to get personalized insights.";
    if (income > 0) {
      if (ratio >= 100) {
        status = "Overspent";
        tip = "You spent more than your income. Reduce high-cost categories and set limits.";
      } else if (ratio > 70) {
        status = "High";
        tip = "Spending is high. Reduce non-essential shopping/travel this week.";
      } else if (ratio > 50) {
        status = "Moderate";
        tip = "Spending is moderate. Try saving 30% by controlling medium/high items.";
      } else {
        status = "Excellent";
        tip = "Great control. Keep a savings goal and maintain the habit!";
      }
    }

    const html = `
      <div style="font-family:Arial,sans-serif;line-height:1.5">
        <h2>Monthly Insights Summary</h2>
        <p><b>User:</b> ${user.username || "User"} (${email})</p>
        <p><b>Period:</b> ${period}</p>
        <hr/>
        <h3>Income vs Expenses</h3>
        <ul>
          <li><b>Income:</b> ₹${income.toFixed(2)}</li>
          <li><b>Spent (this month):</b> ₹${spent.toFixed(2)}</li>
          <li><b>Usage:</b> ${ratio.toFixed(1)}%</li>
          <li><b>Savings left:</b> ₹${savings.toFixed(2)}</li>
          <li><b>Status:</b> ${status}</li>
        </ul>
        <h3>Top Categories</h3>
        ${
          topCats.length
            ? `<ul>${topCats
                .map(([c, v]) => `<li><b>${c}</b>: ₹${Number(v).toFixed(2)}</li>`)
                .join("")}</ul>`
            : `<p>No expenses logged this month.</p>`
        }
        <h3>Suggestion</h3>
        <p>${tip}</p>
        <p style="color:#666;font-size:12px;margin-top:20px">Sent from AI Expense Tracker</p>
      </div>
    `;

    await sendMail({
      to: email,
      subject: "Your Monthly Expense Insights",
      html,
      text: `Income: ${income} | Spent: ${spent} | Usage: ${ratio.toFixed(1)}% | Savings: ${savings}`,
    });

    return res.json({ success: true, message: "Insights email sent successfully ✅" });
  } catch (e) {
    console.log("insights email error:", e);
    return res.status(500).json({ success: false, message: e?.message || "Email failed." });
  }
});

/* =======================
   DELETE EXPENSE
======================= */
app.delete("/api/expenses/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const email = String(req.query.email || "").toLowerCase().trim();
    if (!email) return res.status(400).json({ success: false, message: "Email required" });

    const deleted = await Expense.findOneAndDelete({ _id: id, userEmail: email });
    if (!deleted) return res.status(404).json({ success: false, message: "Expense not found" });

    return res.json({ success: true, message: "Deleted", deletedId: id });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
});

/* =======================
   SERVER START
======================= */
const PORT = process.env.PORT || 4000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Backend server running on port ${PORT}`);
});
