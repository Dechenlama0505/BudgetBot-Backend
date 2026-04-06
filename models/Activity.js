const mongoose = require("mongoose");

const activitySchema = new mongoose.Schema(
  {
    type: {
      type: String,
      required: true,
      trim: true,
    },
    action: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    targetUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    targetRole: {
      type: String,
      enum: ["user", "admin", "superadmin"],
      default: "user",
    },
  },
  {
    timestamps: true,
  }
);

activitySchema.index({ createdAt: -1 });
activitySchema.index({ targetRole: 1, createdAt: -1 });

module.exports = mongoose.model("Activity", activitySchema);
