const analyticsService = require("../services/analyticsService");

async function summary(req, res) {
  const result = await analyticsService.getSummary();
  return res.json({ success: true, message: "Analytics summary retrieved.", ...result });
}

async function fraudOverTime(req, res) {
  const items = await analyticsService.getFraudOverTime(req.query.interval || "hour");
  return res.json({
    success: true,
    message: "Fraud-over-time data retrieved.",
    interval: req.query.interval || "hour",
    items,
  });
}

async function riskDistribution(req, res) {
  const items = await analyticsService.getRiskDistribution();
  return res.json({ success: true, message: "Risk distribution retrieved.", items });
}

async function topRisky(req, res) {
  const items = await analyticsService.getTopRisky(Number(req.query.limit || 10));
  return res.json({ success: true, message: "Highest-risk transactions retrieved.", items });
}

module.exports = { fraudOverTime, riskDistribution, summary, topRisky };
