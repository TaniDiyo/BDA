const mongoose = require("mongoose");
const fs = require("fs");
const os = require("os");
const path = require("path");
const bcrypt = require("bcryptjs");
const { MongoMemoryServer } = require("mongodb-memory-server");
const User = require("../models/User");
const Transaction = require("../models/Transaction");
const ModelMetric = require("../models/ModelMetric");
const Investigation = require("../models/Investigation");
const { main: seed, mapScoredTransaction } = require("../scripts/seed");

describe("seed script integration", () => {
  let mongoServer;
  let outputDirectory;
  let originalArgv;
  let originalEnvironment;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    outputDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "fraudlens-seed-test-"));
    originalArgv = process.argv;
    originalEnvironment = {
      MONGODB_URI: process.env.MONGODB_URI,
      ADMIN_EMAIL: process.env.ADMIN_EMAIL,
      ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
      ANALYST_EMAIL: process.env.ANALYST_EMAIL,
      ANALYST_PASSWORD: process.env.ANALYST_PASSWORD,
    };
    process.env.MONGODB_URI = mongoServer.getUri();
    process.env.ADMIN_EMAIL = "admin@test.invalid";
    process.env.ADMIN_PASSWORD = "test-admin-password";
    process.env.ANALYST_EMAIL = "analyst@test.invalid";
    process.env.ANALYST_PASSWORD = "test-analyst-password";
    process.argv = [...originalArgv.slice(0, 2), "--input", outputDirectory];

    fs.writeFileSync(
      path.join(outputDirectory, "model_metrics.json"),
      JSON.stringify({
        generatedAtUtc: "2026-01-01T00:00:00.000Z",
        models: {
          logistic_regression: {
            precision: 0.8,
            recall: 0.7,
            f1: 0.74,
            rocAuc: 0.9,
            prAuc: 0.6,
            confusionMatrix: [[8, 2], [3, 7]],
          },
          random_forest: {
            precision: 0.9,
            recall: 0.8,
            f1: 0.84,
            rocAuc: 0.95,
            prAuc: 0.7,
            confusionMatrix: [[9, 1], [2, 8]],
          },
        },
      })
    );
    fs.writeFileSync(
      path.join(outputDirectory, "feature_importance.json"),
      JSON.stringify([{ feature: "V1", importance: 0.9 }])
    );
    fs.writeFileSync(
      path.join(outputDirectory, "scored_transactions.csv"),
      [
        "Time,V1,Amount,Class,modelUsed,riskScore,predictedLabel,actualLabel",
        "10,0.2,4.5,0,logistic_regression,0.1,0,0",
        "20,-0.4,9.5,1,random_forest,0.8,1,1",
      ].join("\n")
    );
  }, 60000);

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongoServer) await mongoServer.stop();
    if (outputDirectory) fs.rmSync(outputDirectory, { recursive: true, force: true });
    if (originalArgv) process.argv = originalArgv;
    for (const [key, value] of Object.entries(originalEnvironment || {})) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it("imports pipeline artifacts idempotently and hashes both account passwords", async () => {
    await seed();
    await seed();
    await mongoose.connect(mongoServer.getUri());

    expect(await User.countDocuments()).toBe(2);
    expect(await Transaction.countDocuments()).toBe(2);
    expect(await ModelMetric.countDocuments()).toBe(2);
    expect(await User.findOne({ email: "admin@test.invalid" }).select("+passwordHash").then(
      (user) => bcrypt.compare("test-admin-password", user.passwordHash)
    )).toBe(true);
    expect(
      await ModelMetric.findOne({ modelName: "random_forest" }).then(
        (metric) =>
          metric.featureImportance.map(({ feature, importance }) => ({ feature, importance }))
      )
    ).toEqual([{ feature: "V1", importance: 0.9 }]);
  }, 60000);
});

describe("database models", () => {
  it("requires user identity, role, and a password hash", () => {
    const error = new User({}).validateSync();
    expect(error.errors.name).toBeDefined();
    expect(error.errors.email).toBeDefined();
    expect(error.errors.passwordHash).toBeDefined();
    expect(error.errors.role).toBeDefined();
  });

  it("stores canonical scores and the legacy dashboard fields", () => {
    const transaction = new Transaction({
      transactionId: "random_forest-1",
      sourceRow: 1,
      modelUsed: "random_forest",
      riskScore: 0.8,
      predictedLabel: 1,
      actualLabel: 1,
      model: "random_forest",
      fraudProbability: 0.8,
      predictedFraud: true,
      actualFraud: true,
      Time: 12,
      Amount: 5,
    });
    expect(transaction.validateSync()).toBeUndefined();
    expect(Transaction.schema.indexes().map(([keys]) => keys)).toEqual(
      expect.arrayContaining([
        { modelUsed: 1, sourceRow: 1 },
        { predictedLabel: 1, riskScore: -1 },
        { modelUsed: 1, riskScore: -1 },
        { createdAt: -1 },
      ])
    );
  });

  it("stores one metric document with PR-AUC and training time", () => {
    const metric = new ModelMetric({
      modelName: "logistic_regression",
      model: "logistic_regression",
      displayName: "Logistic Regression",
      precision: 0.9,
      recall: 0.8,
      f1: 0.84,
      rocAuc: 0.95,
      prAuc: 0.7,
      confusionMatrix: [[10, 1], [2, 8]],
      trainedAt: new Date("2026-01-01T00:00:00Z"),
      evaluatedAt: new Date("2026-01-01T00:00:00Z"),
    });
    expect(metric.validateSync()).toBeUndefined();
  });

  it("embeds investigation notes while referencing users and a transaction", () => {
    const investigation = new Investigation({
      transactionId: new mongoose.Types.ObjectId(),
      assignedTo: new mongoose.Types.ObjectId(),
      notes: [{ text: "Review transfer pattern", author: new mongoose.Types.ObjectId() }],
    });
    expect(investigation.validateSync()).toBeUndefined();
    expect(investigation.notes[0].timestamp).toBeInstanceOf(Date);
  });
});

describe("scored transaction seed mapping", () => {
  it("maps dataset fields and scores to canonical and API-compatible fields", () => {
    const transaction = mapScoredTransaction(
      {
        Time: "4",
        V1: "-0.25",
        Amount: "21.5",
        Class: "1",
        riskScore: "0.91",
        predictedLabel: "1",
      },
      "random_forest",
      12
    );

    expect(transaction).toMatchObject({
      transactionId: "random_forest-12",
      sourceRow: 12,
      modelUsed: "random_forest",
      riskScore: 0.91,
      predictedLabel: 1,
      actualLabel: 1,
      model: "random_forest",
      fraudProbability: 0.91,
      predictedFraud: true,
      actualFraud: true,
      time: 4,
      amount: 21.5,
      Time: 4,
      V1: -0.25,
      Amount: 21.5,
      Class: 1,
      features: {},
    });
  });
});
