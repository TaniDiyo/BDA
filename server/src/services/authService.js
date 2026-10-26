const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { AppError } = require("../middleware/errors");

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  };
}

async function login(email, password) {
  const user = await User.findOne({ email: email.toLowerCase() }).select("+passwordHash");
  if (!user || !user.active || !(await bcrypt.compare(password, user.passwordHash))) {
    throw new AppError(401, "Email or password is incorrect.");
  }
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    throw new Error("JWT_SECRET must be set to at least 32 characters.");
  }
  const token = jwt.sign(
    { sub: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "8h" }
  );
  return { token, user: publicUser(user) };
}

async function getCurrentUser(userId) {
  const user = await User.findById(userId).select("name email role active");
  if (!user || !user.active) throw new AppError(401, "Account is no longer active.");
  return publicUser(user);
}

async function createAnalyst({ name, email, password }) {
  const existing = await User.exists({ email: email.toLowerCase() });
  if (existing) throw new AppError(409, "A user with that email already exists.");
  const user = await User.create({
    name,
    email: email.toLowerCase(),
    passwordHash: await bcrypt.hash(password, 12),
    role: "analyst",
  });
  return publicUser(user);
}

async function listUsers() {
  const users = await User.find()
    .select("name email role active createdAt")
    .sort({ createdAt: 1 })
    .lean();
  return users;
}

async function listAnalysts() {
  return User.find({ role: "analyst", active: true })
    .select("name email role")
    .sort({ name: 1 })
    .lean();
}

module.exports = { createAnalyst, getCurrentUser, listAnalysts, listUsers, login };
