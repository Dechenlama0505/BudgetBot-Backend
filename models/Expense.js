const mongoose = require("mongoose");

const expenseSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User is required"],
      index: true,
    },
    amount: {
      type: Number,
      required: [true, "Amount is required"],
      min: [0, "Amount cannot be negative"],
    },
    category: {
      type: String,
      required: [true, "Category is required"],
      trim: true,
      // Supports food, education, bills, custom categories (future budget % will use same categories)
    },
    date: {
      type: Date,
      default: Date.now,
      required: true,
    },
  },
  { timestamps: true }
);

// Compound index for efficient "expenses for user in month" queries
expenseSchema.index({ user: 1, date: -1 });

module.exports = mongoose.model("Expense", expenseSchema);
