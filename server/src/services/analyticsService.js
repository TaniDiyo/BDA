const Transaction = require("../models/Transaction");
const { AppError } = require("../middleware/errors");

async function getSummary() {
  const [summary] = await Transaction.aggregate([
    // Group all scored records once to calculate the headline dashboard values.
    {
      $group: {
        _id: null,
        totalTransactions: { $sum: 1 },
        flaggedCount: { $sum: { $cond: [{ $eq: ["$predictedLabel", 1] }, 1, 0] } },
        actualFraudCount: { $sum: { $cond: [{ $eq: ["$actualLabel", 1] }, 1, 0] } },
        totalFlaggedAmount: {
          $sum: {
            $cond: [
              { $eq: ["$predictedLabel", 1] },
              { $ifNull: ["$Amount", 0] },
              0,
            ],
          },
        },
        averageRisk: { $avg: "$riskScore" },
      },
    },
    // Derive the observed label rate safely for an empty or populated collection.
    {
      $project: {
        _id: 0,
        totalTransactions: 1,
        flaggedCount: 1,
        actualFraudCount: 1,
        totalFlaggedAmount: 1,
        averageRisk: 1,
        fraudRate: {
          $cond: [
            { $gt: ["$totalTransactions", 0] },
            { $divide: ["$actualFraudCount", "$totalTransactions"] },
            0,
          ],
        },
      },
    },
  ]);

  const byModel = await Transaction.aggregate([
    // Group scored records by the model used for dashboard comparisons.
    {
      $group: {
        _id: "$modelUsed",
        total: { $sum: 1 },
        predictedFraud: { $sum: { $cond: [{ $eq: ["$predictedLabel", 1] }, 1, 0] } },
        actualFraud: { $sum: { $cond: [{ $eq: ["$actualLabel", 1] }, 1, 0] } },
        averageRisk: { $avg: "$riskScore" },
      },
    },
    // Keep the model series deterministic for chart rendering.
    { $sort: { _id: 1 } },
  ]);

  const result = summary || {
    totalTransactions: 0,
    flaggedCount: 0,
    actualFraudCount: 0,
    totalFlaggedAmount: 0,
    averageRisk: 0,
    fraudRate: 0,
  };
  return {
    ...result,
    overall: {
      total: result.totalTransactions,
      predictedFraud: result.flaggedCount,
      actualFraud: result.actualFraudCount,
      averageRisk: result.averageRisk,
    },
    byModel: byModel || [],
  };
}

async function getFraudOverTime(interval) {
  const divisor = interval === "day" ? 86400 : 3600;
  return Transaction.aggregate([
    // Exclude rows without the dataset's elapsed-seconds time field.
    { $match: { Time: { $type: "number" } } },
    // Convert elapsed seconds from the dataset origin to a relative day/hour bucket.
    {
      $group: {
        _id: {
          $floor: { $divide: ["$Time", divisor] },
        },
        fraudCount: { $sum: { $cond: [{ $eq: ["$actualLabel", 1] }, 1, 0] } },
        transactionCount: { $sum: 1 },
      },
    },
    // Return chart-friendly relative bucket identifiers in ascending order.
    { $project: { _id: 0, bucket: "$_id", fraudCount: 1, transactionCount: 1 } },
    { $sort: { bucket: 1 } },
  ]);
}

async function getRiskDistribution() {
  return Transaction.aggregate([
    // Clamp scores to the supported interval and select one of ten equal-width bins.
    {
      $project: {
        bucket: {
          $min: [
            9,
            {
              $floor: {
                $multiply: [{ $max: [0, { $min: [1, "$riskScore"] }] }, 10],
              },
            },
          ],
        },
      },
    },
    // Count scored transactions in each risk bucket.
    { $group: { _id: "$bucket", count: { $sum: 1 } } },
    // Return a stable lower-edge value for charting.
    { $project: { _id: 0, bucket: "$_id", lowerBound: { $divide: ["$_id", 10] }, count: 1 } },
    { $sort: { bucket: 1 } },
  ]);
}

async function getTopRisky(limit) {
  return Transaction.find()
    .sort({ riskScore: -1, sourceRow: 1 })
    .limit(limit)
    .lean();
}

async function getFeatureImportance() {
  const ModelMetric = require("../models/ModelMetric");
  const metric = await ModelMetric.findOne({ modelName: "random_forest" })
    .select("modelName featureImportance trainedAt")
    .lean();
  if (!metric) throw new AppError(404, "Random Forest feature importance is not available.");
  return metric;
}

module.exports = {
  getFeatureImportance,
  getFraudOverTime,
  getRiskDistribution,
  getSummary,
  getTopRisky,
};
