const ModelMetric = require("../models/ModelMetric");
const analyticsService = require("../services/analyticsService");

async function metrics(req, res) {
  const items = await ModelMetric.find()
    .sort({ trainedAt: -1 })
    .lean();
  return res.json({ success: true, message: "Model metrics retrieved.", items });
}

async function featureImportance(req, res) {
  const result = await analyticsService.getFeatureImportance();
  return res.json({ success: true, message: "Feature importance retrieved.", ...result });
}

module.exports = { featureImportance, metrics };
