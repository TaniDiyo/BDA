const transactionService = require("../services/transactionService");

async function list(req, res) {
  const result = await transactionService.listTransactions(req.query);
  return res.json({ success: true, message: "Transactions retrieved.", ...result });
}

async function getById(req, res) {
  const result = await transactionService.getTransaction(req.params.id);
  return res.json({ success: true, message: "Transaction retrieved.", ...result });
}

module.exports = { getById, list };
