const mongoose = require("mongoose");

const modelMetricSchema = new mongoose.Schema(
  {
    modelName: {
      type: String,
      enum: ["logistic_regression", "random_forest"],
      required: true,
    },
    precision: { type: Number, required: true, min: 0, max: 1 },
    recall: { type: Number, required: true, min: 0, max: 1 },
    f1: { type: Number, required: true, min: 0, max: 1 },
    rocAuc: { type: Number, required: true, min: 0, max: 1 },
    prAuc: { type: Number, required: true, min: 0, max: 1 },
    confusionMatrix: { type: mongoose.Schema.Types.Mixed, required: true },
    featureImportance: [
      {
        feature: { type: String, required: true },
        importance: { type: Number, required: true, min: 0 },
        _id: false,
      },
    ],
    trainedAt: { type: Date, required: true },

    // Legacy aliases are retained for the existing analytics API.
    model: {
      type: String,
      enum: ["logistic_regression", "random_forest"],
      required: true,
    },
    displayName: { type: String, required: true },
    runMetadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    evaluatedAt: { type: Date, required: true },
  },
  { timestamps: true }
);

// Keep one latest evaluation per model; the seed script upserts by modelName.
modelMetricSchema.index({ modelName: 1 }, { unique: true });
// The comparison page reads the most recently trained models first.
modelMetricSchema.index({ trainedAt: -1 });

module.exports = mongoose.model("ModelMetric", modelMetricSchema);
