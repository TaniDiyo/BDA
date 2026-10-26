const investigationService = require("../services/investigationService");

function investigationResponse(item) {
  const notes = item.notes || [];
  return {
    ...item,
    transaction: item.transactionId,
    notes: notes.map((note) => note.text).join("\n"),
    notesHistory: notes,
  };
}

async function create(req, res) {
  const item = await investigationService.openInvestigation(
    req.body.transactionId,
    req.user.sub,
    req.body.notes
  );
  return res.status(201).json({
    success: true,
    message: "Investigation opened.",
    item: investigationResponse(item.toObject()),
  });
}

async function list(req, res) {
  const items = await investigationService.listInvestigations(req.query);
  return res.json({
    success: true,
    message: "Investigations retrieved.",
    items: items.map(investigationResponse),
  });
}

async function update(req, res) {
  const item = await investigationService.updateInvestigation(req.params.id, req.body);
  return res.json({
    success: true,
    message: "Investigation updated.",
    item: investigationResponse(item.toObject()),
  });
}

async function addNote(req, res) {
  const item = await investigationService.addNote(
    req.params.id,
    req.body.text,
    req.user.sub
  );
  return res.status(201).json({
    success: true,
    message: "Investigation note added.",
    item: investigationResponse(item.toObject()),
  });
}

module.exports = { addNote, create, list, update };
