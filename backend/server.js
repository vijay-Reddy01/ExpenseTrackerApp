
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const { spawn } = require("child_process");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());

// --- MongoDB Connection ---
const MONGO_URI = "YOUR_MONGODB_CONNECTION_STRING"; 
mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("✅ MongoDB connected successfully"))
  .catch(err => console.error("MongoDB connection error:", err));

// --- Schemas ---
const userSchema = new mongoose.Schema({ username: { type: String, required: true }, email: { type: String, required: true, unique: true, lowercase: true, trim: true }, password: { type: String, required: true }, income: { type: Number, default: 0 } });
const User = mongoose.model("User", userSchema);

const expenseSchema = new mongoose.Schema({ userEmail: { type: String, required: true, lowercase: true, trim: true, index: true }, name: { type: String, required: true, trim: true }, amount: { type: Number, required: true, min: 0 }, category: { type: String, required: true, enum: ["food", "transport", "shopping", "bills", "housing", "travel", "other"] }, description: { type: String, trim: true }, date: { type: Date, default: Date.now }, }, { timestamps: true });
const Expense = mongoose.model("Expense", expenseSchema);

// --- API Routes ---

// AUTH
app.post("/api/signup", async (req, res) => {
  try {
    const { username, email, password } = req.body;
    const cleanEmail = String(email).toLowerCase().trim();
    if (!username || !cleanEmail || !password) return res.status(400).json({ success: false, message: "All fields are required." });
    if (await User.findOne({ email: cleanEmail })) return res.status(400).json({ success: false, message: "User already exists." });
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ username, email: cleanEmail, password: hashedPassword });
    await newUser.save();
    res.status(201).json({ success: true, user: { email: newUser.email, username: newUser.username } });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error during signup." });
  }
});

app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email: String(email).toLowerCase().trim() });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(400).json({ success: false, message: "Invalid credentials." });
    }
    res.json({ success: true, user: { email: user.email, username: user.username } });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error during login." });
  }
});

// USER & EXPENSE DATA
app.get("/api/user/data", async (req, res) => {
  try {
    const { email } = req.query;
    const cleanEmail = String(email).toLowerCase().trim();
    const user = await User.findOne({ email: cleanEmail }).select("-password");
    if (!user) return res.status(404).json({ success: false, message: "User not found." });
    const expenses = await Expense.find({ userEmail: cleanEmail }).sort({ date: -1 });
    res.json({ success: true, data: { ...user.toObject(), transactions: expenses } });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error fetching data." });
  }
});

app.post("/api/user/profile", async (req, res) => {
    try {
        const { email, username, income } = req.body;
        const updatedUser = await User.findOneAndUpdate(
            { email: String(email).toLowerCase().trim() },
            { username, income: parseFloat(income) },
            { new: true, runValidators: true, select: "-password" }
        );
        if (!updatedUser) return res.status(404).json({ success: false, message: "User not found." });
        res.json({ success: true, user: updatedUser });
    } catch (error) {
        res.status(500).json({ success: false, message: "Server error updating profile." });
    }
});

app.post("/api/expenses", async (req, res) => {
  try {
    const { email, name, amount, category, date, description } = req.body;
    const cleanEmail = String(email).toLowerCase().trim();
    if (!cleanEmail || !name || amount === undefined || !category) return res.status(400).json({ success: false, message: "Required fields missing." });
    const expense = await Expense.create({ userEmail: cleanEmail, name, amount, category, date, description });
    res.status(201).json({ success: true, message: "Expense added.", expense });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error adding expense." });
  }
});

// ✅ NEW: DELETE EXPENSE ROUTE
// server.js
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



// --- Server Initialization ---
const PORT = process.env.PORT || 4000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Backend server is running on port ${PORT}`);
});
