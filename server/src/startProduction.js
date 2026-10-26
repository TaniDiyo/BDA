process.env.NODE_ENV = "production";

const startServer = require("./server");

startServer()
  .then((server) => startServer.registerShutdownHandlers(server))
  .catch((error) => {
    console.error("Unable to start FraudLens API:", error.message);
    process.exitCode = 1;
  });
