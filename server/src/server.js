require("dotenv").config();
const dns = require('node:dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);

const mongoose = require("mongoose");
const createApp = require("./app");
const connectDatabase = require("./config/db");

async function startServer() {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    throw new Error("Set JWT_SECRET to a random value at least 32 characters long.");
  }
  if (!process.env.CLIENT_ORIGIN) {
    throw new Error("Set CLIENT_ORIGIN to the exact browser origin for the React app.");
  }
  await connectDatabase();
  const port = Number(process.env.PORT || 4000);
  const server = createApp().listen(port, () => {
    console.log(`FraudLens API listening on port ${port}`);
  });
  return server;
}

function registerShutdownHandlers(server) {
  let isShuttingDown = false;

  async function shutdown(signal) {
    if (isShuttingDown) return;
    isShuttingDown = true;
    console.log(`Received ${signal}; closing HTTP server and MongoDB connection.`);

    const timeout = setTimeout(() => {
      console.error("Graceful shutdown timed out; closing remaining HTTP connections.");
      if (typeof server.closeAllConnections === "function") {
        server.closeAllConnections();
      }
      process.exitCode = 1;
    }, 10000);
    timeout.unref();

    server.close(async (error) => {
      clearTimeout(timeout);
      if (error) {
        console.error("Unable to close the HTTP server cleanly:", error.message);
        process.exitCode = 1;
      }
      try {
        await mongoose.disconnect();
      } catch (disconnectError) {
        console.error("Unable to close the MongoDB connection cleanly:", disconnectError.message);
        process.exitCode = 1;
      }
    });
  }

  const onInterrupt = () => shutdown("SIGINT");
  const onTerminate = () => shutdown("SIGTERM");
  process.once("SIGINT", onInterrupt);
  process.once("SIGTERM", onTerminate);
  return () => {
    process.removeListener("SIGINT", onInterrupt);
    process.removeListener("SIGTERM", onTerminate);
  };
}

if (require.main === module) {
  startServer().catch((error) => {
    console.error("Unable to start FraudLens API:", error.message);
    process.exitCode = 1;
  }).then((server) => {
    if (server) registerShutdownHandlers(server);
  });
}

module.exports = startServer;
module.exports.registerShutdownHandlers = registerShutdownHandlers;
