const Transaction = require("../models/Transaction");
const Investigation = require("../models/Investigation");
const { AppError } = require("../middleware/errors");

function dateValue(value, includeWholeDay) {
  const date = new Date(value);
  if (includeWholeDay && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    date.setUTCHours(23, 59, 59, 999);
  }
  return date;
}

function makeFilters(query) {
  const filter = {};
  if (query.model) filter.modelUsed = query.model;
  if (query.predictedLabel !== undefined) {
    filter.predictedLabel = Number(query.predictedLabel);
  } else if (query.predictedFraud !== undefined) {
    filter.predictedLabel = query.predictedFraud === "true" ? 1 : 0;
  }

  const riskMin = query.riskScoreMin ?? query.minProbability;
  const riskMax = query.riskScoreMax ?? query.maxProbability;
  if (riskMin !== undefined && riskMax !== undefined && riskMin > riskMax) {
    throw new AppError(400, "riskScoreMin must be less than or equal to riskScoreMax.");
  }
  if (riskMin !== undefined || riskMax !== undefined) {
    filter.riskScore = {};
    if (riskMin !== undefined) filter.riskScore.$gte = Number(riskMin);
    if (riskMax !== undefined) filter.riskScore.$lte = Number(riskMax);
  }
  if (
    query.amountMin !== undefined &&
    query.amountMax !== undefined &&
    query.amountMin > query.amountMax
  ) {
    throw new AppError(400, "amountMin must be less than or equal to amountMax.");
  }
  if (query.amountMin !== undefined || query.amountMax !== undefined) {
    filter.Amount = {};
    if (query.amountMin !== undefined) filter.Amount.$gte = Number(query.amountMin);
    if (query.amountMax !== undefined) filter.Amount.$lte = Number(query.amountMax);
  }
  if (query.startDate || query.endDate) {
    const startDate = query.startDate ? dateValue(query.startDate, false) : null;
    const endDate = query.endDate ? dateValue(query.endDate, true) : null;
    if (startDate && endDate && startDate > endDate) {
      throw new AppError(400, "startDate must be earlier than or equal to endDate.");
    }
    filter.createdAt = {};
    if (startDate) filter.createdAt.$gte = startDate;
    if (endDate) filter.createdAt.$lte = endDate;
  }
  if (query.search) {
    const safeSearch = query.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.transactionId = { $regex: safeSearch, $options: "i" };
  }
  return filter;
}

async function listTransactions(query) {
  const page = Number(query.page || 1);
  const limit = Number(query.limit || 25);
  const filter = makeFilters(query);
  const sortFields = {
    riskScore: "riskScore",
    createdAt: "createdAt",
    amount: "Amount",
  };
  const sortField = sortFields[query.sortBy] || "riskScore";
  const direction = query.sortOrder === "asc" ? 1 : -1;
  const [items, total] = await Promise.all([
    Transaction.find(filter)
      .sort({ [sortField]: direction, sourceRow: 1, _id: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Transaction.countDocuments(filter),
  ]);
  return { items, page, limit, total, pages: Math.ceil(total / limit) };
}

async function getTransaction(id) {
  const transaction = await Transaction.findById(id).lean();
  if (!transaction) throw new AppError(404, "Transaction not found.");
  const investigation = await Investigation.findOne({ transactionId: transaction._id })
    .populate("assignedTo", "name email")
    .populate("notes.author", "name email")
    .lean();
  return { transaction, investigation };
}

module.exports = { getTransaction, listTransactions };
