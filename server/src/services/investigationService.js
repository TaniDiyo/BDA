const mongoose = require("mongoose");
const Investigation = require("../models/Investigation");
const Transaction = require("../models/Transaction");
const User = require("../models/User");
const { AppError } = require("../middleware/errors");

const STATUSES = ["open", "under_review", "confirmed_fraud", "false_positive"];

async function openInvestigation(transactionId, userId, initialNote) {
  const transaction = await Transaction.findById(transactionId).select(
    "predictedLabel predictedFraud"
  );
  if (!transaction) throw new AppError(404, "Transaction not found.");
  const isFlagged = transaction.predictedLabel === 1 || transaction.predictedFraud === true;
  if (!isFlagged) throw new AppError(400, "Investigations can only be opened for flagged transactions.");
  const existing = await Investigation.findOne({ transactionId: transaction._id });
  if (existing) throw new AppError(409, "An investigation already exists for this transaction.");
  return Investigation.create({
    transactionId: transaction._id,
    notes: initialNote ? [{ text: initialNote, author: userId }] : [],
  });
}

async function listInvestigations({ status, assignedTo }) {
  const filter = {};
  if (status) filter.status = status;
  if (assignedTo) filter.assignedTo = assignedTo;
  return Investigation.find(filter)
    .populate("transactionId")
    .populate("assignedTo", "name email")
    .populate("notes.author", "name email")
    .sort({ updatedAt: -1 })
    .limit(100)
    .lean();
}

async function updateInvestigation(id, { status, assignedTo }) {
  const investigation = await Investigation.findById(id);
  if (!investigation) throw new AppError(404, "Investigation not found.");
  if (status !== undefined) investigation.status = status;
  if (assignedTo !== undefined) {
    if (assignedTo === null) {
      investigation.assignedTo = null;
    } else {
      if (!mongoose.isValidObjectId(assignedTo)) {
        throw new AppError(400, "assignedTo must be a valid user ID.");
      }
      const analyst = await User.findOne({ _id: assignedTo, role: "analyst", active: true });
      if (!analyst) throw new AppError(400, "assignedTo must identify an active analyst.");
      investigation.assignedTo = analyst._id;
    }
  }
  await investigation.save();
  return investigation;
}

async function addNote(id, text, authorId) {
  const investigation = await Investigation.findById(id);
  if (!investigation) throw new AppError(404, "Investigation not found.");
  investigation.notes.push({ text, author: authorId });
  await investigation.save();
  return investigation;
}

module.exports = { STATUSES, addNote, listInvestigations, openInvestigation, updateInvestigation };
