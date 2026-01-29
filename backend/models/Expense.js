import mongoose from "mongoose";

const expenseSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, index: true },
    name: { type: String, required: true },
    category: { type: String, default: "other" },
    amount: { type: Number, required: true },
    date: { type: Date, required: true },
  },
  { timestamps: true }
);

const Expense = mongoose.models.Expense || mongoose.model("Expense", expenseSchema);
export default Expense;
