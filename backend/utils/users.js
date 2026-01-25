// backend/utils/users.js
import User from "../models/User.js";

// Fetch all users
export async function getAllUsers() {
  return await User.find().lean();
}

// Update income (NOT salary)
export async function saveIncome(email, income) {
  return await User.findOneAndUpdate(
    { email },
    { $set: { income } },
    { new: true }
  );
}
