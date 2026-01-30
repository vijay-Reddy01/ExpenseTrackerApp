// backend/server.js
import dotenv from "dotenv";
dotenv.config();
import userRouter from "./routes/user.js";

import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import bcrypt from "bcryptjs";

import receiptRouter from "./routes/receipt.js";

const app = express();

/* =======================
   MIDDLEWARE
======================= */
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "5mb" })); // ✅ allow base64 photo payloads
app.use("/api/receipt", receiptRouter);
app.use("/api/user", userRouter);

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

    // ✅ store profile image (base64 data url)
    // Example: "data:image/jpeg;base64,....."
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
   USER DATA (Dashboard source)
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
   UPDATE PROFILE (name/income/photoUrl)
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

    // ✅ optional safety: reject very large base64 strings (Render payload limit)
    if (photoUrl.length > 2_000_000) {
      return res.status(400).json({
        success: false,
        message: "Photo too large. Choose a smaller image.",
      });
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
   DELETE EXPENSE (SECURE)
   /api/expenses/:id?email=...
======================= */
// ✅ DELETE expense (must send email as query param)
app.delete("/api/expenses/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const email = String(req.query.email || "").toLowerCase().trim();

    if (!email) {
      return res.status(400).json({ success: false, message: "Email required" });
    }

    const deleted = await Expense.findOneAndDelete({ _id: id, userEmail: email });

    if (!deleted) {
      return res.status(404).json({ success: false, message: "Expense not found" });
    }

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
