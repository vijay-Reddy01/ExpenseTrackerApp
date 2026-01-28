// backend/routes/auth.js
import { Router } from "express";
import bcrypt from "bcryptjs";
import User from "../models/User.js";

const router = Router();

// SIGNUP (MongoDB)
router.post("/signup", async (req, res) => {
  try {
    const { username, email, password, mobile } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ success: false, message: "Missing fields" });
    }

    const cleanEmail = String(email).toLowerCase().trim();

    const existing = await User.findOne({ email: cleanEmail });
    if (existing) {
      return res.status(409).json({ success: false, message: "User already exists" });
    }

    const hashed = await bcrypt.hash(password, 10);

    const user = await User.create({
      username: String(username).trim(),
      email: cleanEmail,
      password: hashed,
      mobile: mobile || "",
      income: 0, // ✅ FIX: Corrected typo from "income" to "income"
    });

    // PUT /api/user/profile
router.put("/user/profile", async (req, res) => {
  try {
    const { email, income, username } = req.body;
    if (!email) return res.status(400).json({ success: false, message: "Email is required" });

    const update = {};
    if (income !== undefined) update.income = Number(income);
    if (username) update.username = username;

    const updatedUser = await User.findOneAndUpdate(
      { email },
      { $set: update },
      { new: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    res.json({ success: true, user: updatedUser, message: "Profile updated" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});




    // Return minimal user (do NOT return password)
    return res.json({
      success: true,
      user: { email: user.email, username: user.username },
    });
  } catch (err) {
    return res.status(400).json({ success: false, message: "Signup failed", error: err.message });
  }
});

// LOGIN (MongoDB)
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: "Email and password required" });
    }

    const cleanEmail = String(email).toLowerCase().trim();

    const user = await User.findOne({ email: cleanEmail });
    if (!user) return res.status(401).json({ success: false, message: "Invalid credentials" });

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ success: false, message: "Invalid credentials" });

    return res.json({
      success: true,
      user: { email: user.email, username: user.username },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Login failed", error: err.message });
  }
});

export default router;
