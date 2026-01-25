import mongoose from "mongoose";

const expenseSchema = new mongoose.Schema({
  email: String,
  period: String,
  date: Date,
  amount: Number,
  category: String,
  description: String,
});

export default mongoose.model("Expense", expenseSchema);
