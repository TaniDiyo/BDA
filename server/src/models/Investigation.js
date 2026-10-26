const mongoose = require("mongoose");

const noteSchema = new mongoose.Schema(
  {
    text: { type: String, required: true, trim: true, maxlength: 2000 },
    author: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    timestamp: { type: Date, required: true, default: Date.now },
  },
  { _id: false }
);

const investigationSchema = new mongoose.Schema(
  {
    transactionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Transaction",
      required: true,
    },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    status: {
      type: String,
      enum: ["open", "under_review", "confirmed_fraud", "false_positive"],
      default: "open",
      required: true,
    },
    notes: { type: [noteSchema], default: [] },
  },
  { timestamps: true }
);

// A transaction should have at most one investigation, and transaction details are frequently loaded with it.
investigationSchema.index({ transactionId: 1 }, { unique: true });
// Analysts filter cases by status and review the most recently changed first.
investigationSchema.index({ status: 1, updatedAt: -1 });
// Supports an analyst's assigned-case queue.
investigationSchema.index({ assignedTo: 1, status: 1 });

module.exports = mongoose.model("Investigation", investigationSchema);
