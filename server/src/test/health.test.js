const request = require("supertest");
const mongoose = require("mongoose");
const createApp = require("../app");
const { errorHandler } = require("../middleware/errors");
const { registerShutdownHandlers } = require("../server");

describe("health endpoint", () => {
  it("reports API readiness without requiring a database connection", async () => {
    const response = await request(createApp()).get("/api/health");
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ success: true, status: "ok" });
  });

  it("protects transaction data from unauthenticated requests", async () => {
    const response = await request(createApp()).get("/api/transactions");
    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({
      success: false,
      message: expect.stringMatching(/authentication required/i),
      errors: [],
    });
  });

  it("does not expose internal exception details in production errors", () => {
    const previousEnvironment = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    const response = {
      headersSent: false,
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    try {
      errorHandler(new Error("private database connection details"), {}, response, jest.fn());
      expect(response.status).toHaveBeenCalledWith(500);
      expect(response.json).toHaveBeenCalledWith({
        success: false,
        message: "Internal server error.",
        errors: [],
      });
    } finally {
      if (previousEnvironment === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = previousEnvironment;
    }
  });

  it("closes HTTP and MongoDB connections on a termination signal", async () => {
    const disconnect = jest.spyOn(mongoose, "disconnect").mockResolvedValue();
    const server = {
      close: jest.fn((callback) => callback()),
      closeAllConnections: jest.fn(),
    };
    const removeHandlers = registerShutdownHandlers(server);

    try {
      process.emit("SIGTERM");
      await new Promise((resolve) => setImmediate(resolve));
      expect(server.close).toHaveBeenCalledTimes(1);
      expect(disconnect).toHaveBeenCalledTimes(1);
    } finally {
      removeHandlers();
      disconnect.mockRestore();
    }
  });
});
