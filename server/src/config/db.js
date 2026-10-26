const mongoose = require("mongoose");
const dns = require('node:dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);

async function connectDatabase(uri = process.env.MONGODB_URI) {
  if (!uri) {
    throw new Error("MONGODB_URI is required to connect to MongoDB.");
  }
  try {
    await mongoose.connect(uri);
    return mongoose.connection;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(
      `MongoDB connection failed: ${detail}. Check MONGODB_URI, Atlas network access, and database-user permissions.`
    );
  }
}

module.exports = connectDatabase;
