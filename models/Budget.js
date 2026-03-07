const mongoose = require("mongoose");

const budgetSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User is required"],
      index: true,
    },
    month: {
      type: String,
      required: [true, "Month is required"],
      match: [/^\d{4}-\d{2}$/, "Month must be YYYY-MM"],
      index: true,
    },
    totalAmount: {
      type: Number,
      required: [true, "Total budget amount is required"],
      min: [0, "Budget cannot be negative"],
    },
    allocations: {
      type: Map,
      of: Number,
      default: {},
      // categoryName -> percentage (0-100), e.g. "Food & Drinks": 10
    },
  },
  { timestamps: true }
);

budgetSchema.index({ user: 1, month: 1 }, { unique: true });

module.exports = mongoose.model("Budget", budgetSchema);
