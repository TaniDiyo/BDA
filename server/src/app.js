const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const mongoSanitize = require("express-mongo-sanitize");
const { AppError, notFound, errorHandler } = require("./middleware/errors");
const authRoutes = require("./routes/auth");
const transactionRoutes = require("./routes/transactions");
const analyticsRoutes = require("./routes/analytics");
const investigationRoutes = require("./routes/investigations");
const adminRoutes = require("./routes/admin");
const modelRoutes = require("./routes/models");
const userRoutes = require("./routes/users");

function createApp() {
  const app = express();
  const allowedOrigin = process.env.CLIENT_ORIGIN;

  app.disable("x-powered-by");
  app.use(helmet());
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || origin === allowedOrigin) return callback(null, true);
        return callback(new AppError(403, "This origin is not allowed by CORS."));
      },
    })
  );
  app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));
  app.use(express.json({ limit: "100kb" }));
  // Prevent client-controlled Mongo operators or dotted paths reaching query objects.
  app.use(mongoSanitize({ replaceWith: "_" }));
  app.use(
    "/api",
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 300,
      standardHeaders: "draft-7",
      legacyHeaders: false,
      handler(req, res) {
        return res.status(429).json({
          success: false,
          message: "Too many requests. Please try again later.",
          errors: [],
        });
      },
    })
  );
  app.get("/api/health", (req, res) =>
    res.json({ success: true, message: "API is healthy.", status: "ok" })
  );
  app.use("/api/auth", authRoutes);
  app.use("/api/users", userRoutes);
  app.use("/api/transactions", transactionRoutes);
  app.use("/api/analytics", analyticsRoutes);
  app.use("/api/models", modelRoutes);
  app.use("/api/investigations", investigationRoutes);
  app.use("/api/admin", adminRoutes);
  app.use(notFound);
  app.use(errorHandler);
  return app;
}

module.exports = createApp;
