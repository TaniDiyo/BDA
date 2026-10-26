const mongoose = require("mongoose");

const datasetFields = Object.fromEntries(
  [
    "Time",
    ...Array.from({ length: 28 }, (_, index) => `V${index + 1}`),
    "Amount",
    "Class",
  ].map((field) => [field, { type: Number }])
);

const transactionSchema = new mongoose.Schema(
  {
    ...datasetFields,
    transactionId: { type: String, required: true },
    sourceRow: { type: Number, required: true },
    modelUsed: {
      type: String,
      enum: ["logistic_regression", "random_forest"],
      required: true,
    },
    riskScore: { type: Number, required: true, min: 0, max: 1 },
    predictedLabel: { type: Number, required: true, enum: [0, 1] },
    actualLabel: { type: Number, required: true, enum: [0, 1] },
    features: { type: Map, of: Number, default: {} },

    // These aliases keep the existing API and dashboard contract stable.
    model: { type: String, enum: ["logistic_regression", "random_forest"], required: true },
    time: Number,
    amount: Number,
    fraudProbability: { type: Number, required: true, min: 0, max: 1 },
    predictedFraud: { type: Boolean, required: true },
    actualFraud: { type: Boolean, required: true },
  },
  { timestamps: true }
);

// The seed script uses this pair as the idempotent key for each model's scored rows.
transactionSchema.index({ modelUsed: 1, sourceRow: 1 }, { unique: true });
// Dashboard filters and sorts flagged transactions by their model score.
transactionSchema.index({ predictedLabel: 1, riskScore: -1 });
// Model comparison and review pages rank records within a selected model.
transactionSchema.index({ modelUsed: 1, riskScore: -1 });
// Supports date-based transaction browsing and aggregation.
transactionSchema.index({ createdAt: -1 });

module.exports = mongoose.model("Transaction", transactionSchema);
