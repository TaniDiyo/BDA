const authService = require("../services/authService");

async function login(req, res) {
  const result = await authService.login(req.body.email, req.body.password);
  return res.json({ success: true, message: "Login successful.", ...result });
}

async function signup(req, res) {
  await authService.createAnalyst(req.body);
  const result = await authService.login(req.body.email, req.body.password);
  return res.status(201).json({ success: true, message: "Account created.", ...result });
}

async function me(req, res) {
  const user = await authService.getCurrentUser(req.user.sub);
  return res.json({ success: true, message: "Current user.", user });
}

async function createAnalyst(req, res) {
  const user = await authService.createAnalyst(req.body);
  return res.status(201).json({ success: true, message: "Analyst created.", user });
}

async function listUsers(req, res) {
  const items = await authService.listUsers();
  return res.json({ success: true, message: "Users retrieved.", items });
}

async function listAnalysts(req, res) {
  const items = await authService.listAnalysts();
  return res.json({ success: true, message: "Analysts retrieved.", items });
}

module.exports = { createAnalyst, listAnalysts, listUsers, login, me, signup };
