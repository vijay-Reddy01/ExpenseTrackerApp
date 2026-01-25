// backend/models/User.js
import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  username: String,
  email: { type: String, unique: true },
  password: String,
  mobile: String,
  income: { type: Number, default: 0 }, // ✅ single source of truth
});


// Use existing model if already compiled
const User = mongoose.models.User || mongoose.model("User", userSchema);

export default User;
