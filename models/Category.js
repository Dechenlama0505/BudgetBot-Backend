const mongoose = require("mongoose");

const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Category name is required"],
      unique: true,
      trim: true,
    },
    color: {
      type: String,
      required: [true, "Category color is required"],
      trim: true,
    },
    icon: {
      type: String,
      default: null,
    },
    order: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Category", categorySchema);
