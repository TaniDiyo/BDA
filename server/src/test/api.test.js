const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const request = require("supertest");
const { MongoMemoryServer } = require("mongodb-memory-server");
const createApp = require("../app");
const User = require("../models/User");
const Transaction = require("../models/Transaction");
const ModelMetric = require("../models/ModelMetric");
const Investigation = require("../models/Investigation");

describe("FraudLens API", () => {
  let mongoServer;
  let app;
  let admin;
  let analyst;
  let adminToken;
  let analystToken;
  let flaggedTransaction;
  let normalTransaction;

  beforeAll(async () => {
    process.env.JWT_SECRET = "unit-test-secret-longer-than-thirty-two-characters";
    process.env.JWT_EXPIRES_IN = "1h";
    process.env.CLIENT_ORIGIN = "http://localhost:5173";
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
    await Promise.all([
      User.init(),
      Transaction.init(),
      ModelMetric.init(),
      Investigation.init(),
    ]);
    app = createApp();
  }, 60000);

  beforeEach(async () => {
    await Promise.all([
      User.deleteMany({}),
      Transaction.deleteMany({}),
      ModelMetric.deleteMany({}),
      Investigation.deleteMany({}),
    ]);

    admin = await User.create({
      name: "Admin",
      email: "admin@example.test",
      passwordHash: await bcrypt.hash("admin-password-123", 4),
      role: "admin",
    });
    analyst = await User.create({
      name: "Analyst",
      email: "analyst@example.test",
      passwordHash: await bcrypt.hash("analyst-password-123", 4),
      role: "analyst",
    });
    adminToken = jwt.sign({ sub: admin.id, role: "admin" }, process.env.JWT_SECRET);
    analystToken = jwt.sign({ sub: analyst.id, role: "analyst" }, process.env.JWT_SECRET);
    flaggedTransaction = await Transaction.create({
      transactionId: "rf-flagged-1",
      sourceRow: 1,
      modelUsed: "random_forest",
      riskScore: 0.91,
      predictedLabel: 1,
      actualLabel: 1,
      model: "random_forest",
      fraudProbability: 0.91,
      predictedFraud: true,
      actualFraud: true,
      Time: 7200,
      Amount: 25,
    });
    normalTransaction = await Transaction.create({
      transactionId: "lr-normal-1",
      sourceRow: 1,
      modelUsed: "logistic_regression",
      riskScore: 0.1,
      predictedLabel: 0,
      actualLabel: 0,
      model: "logistic_regression",
      fraudProbability: 0.1,
      predictedFraud: false,
      actualFraud: false,
      Time: 3600,
      Amount: 10,
    });
    await ModelMetric.create({
      modelName: "random_forest",
      model: "random_forest",
      displayName: "Random Forest",
      precision: 0.9,
      recall: 0.8,
      f1: 0.84,
      rocAuc: 0.95,
      prAuc: 0.7,
      confusionMatrix: [[9, 1], [2, 8]],
      featureImportance: [{ feature: "V1", importance: 0.8 }],
      trainedAt: new Date(),
      evaluatedAt: new Date(),
    });
  });

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongoServer) await mongoServer.stop();
  });

  it("serves health and consistent JSON errors for missing auth and routes", async () => {
    const health = await request(app).get("/api/health");
    expect(health.status).toBe(200);
    expect(health.body).toMatchObject({ success: true, status: "ok" });

    const protectedResponse = await request(app).get("/api/transactions");
    expect(protectedResponse.status).toBe(401);
    expect(protectedResponse.body).toMatchObject({
      success: false,
      message: "Authentication required.",
      errors: [],
    });

    const missing = await request(app).get("/api/not-a-route");
    expect(missing.status).toBe(404);
    expect(missing.body.success).toBe(false);
  });

  it("logs in and returns a current user without password data", async () => {
    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: "admin@example.test", password: "admin-password-123" });
    expect(login.status).toBe(200);
    expect(login.body.user).toMatchObject({ id: admin.id, role: "admin" });
    expect(login.body.user.passwordHash).toBeUndefined();

    const me = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${login.body.token}`);
    expect(me.body.user.email).toBe("admin@example.test");
    expect(me.body.user.passwordHash).toBeUndefined();
  });

  it("rejects missing credentials and incorrect passwords", async () => {
    const missing = await request(app).post("/api/auth/login").send({ email: "" });
    expect(missing.status).toBe(400);
    expect(missing.body).toMatchObject({ success: false, errors: expect.any(Array) });

    const wrongPassword = await request(app)
      .post("/api/auth/login")
      .send({ email: "admin@example.test", password: "incorrect-password" });
    expect(wrongPassword.status).toBe(401);
    expect(wrongPassword.body.message).toMatch(/email or password/i);
  });

  it("allows public signup for analyst accounts only and prevents duplicates", async () => {
    const signup = await request(app)
      .post("/api/auth/signup")
      .send({
        name: "New Analyst",
        email: "new.analyst@example.test",
        password: "strong-password-123",
        role: "admin",
      });

    expect(signup.status).toBe(201);
    expect(signup.body.user).toMatchObject({
      name: "New Analyst",
      email: "new.analyst@example.test",
      role: "analyst",
    });
    expect(signup.body.user.passwordHash).toBeUndefined();
    expect(signup.body.token).toEqual(expect.any(String));
    const created = await User.findOne({ email: "new.analyst@example.test" })
      .select("+passwordHash");
    expect(created.role).toBe("analyst");
    expect(created.passwordHash).not.toBe("strong-password-123");

    const duplicate = await request(app)
      .post("/api/auth/signup")
      .send({
        name: "Duplicate",
        email: "new.analyst@example.test",
        password: "strong-password-456",
      });
    expect(duplicate.status).toBe(409);
  });

  it("allows an analyst to log in with the same credentials used at signup", async () => {
    const credentials = {
      name: "Signup Login Check",
      email: "signup.login@example.test",
      password: "signup-password-123",
    };
    const signup = await request(app).post("/api/auth/signup").send(credentials);
    expect(signup.status).toBe(201);

    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: credentials.email, password: credentials.password });
    expect(login.status).toBe(200);
    expect(login.body.user).toMatchObject({
      email: credentials.email,
      role: "analyst",
    });
    expect(login.body.user.passwordHash).toBeUndefined();
  });

  it("validates signup input", async () => {
    const response = await request(app)
      .post("/api/auth/signup")
      .send({ name: "", email: "bad-email", password: "short" });

    expect(response.status).toBe(400);
    expect(response.body.errors.length).toBeGreaterThan(0);
  });

  it("rejects invalid and expired access tokens", async () => {
    const invalid = await request(app)
      .get("/api/auth/me")
      .set("Authorization", "Bearer not-a-jwt");
    const expiredToken = jwt.sign(
      { sub: admin.id, role: "admin" },
      process.env.JWT_SECRET,
      { expiresIn: "-1s" }
    );
    const expired = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${expiredToken}`);

    expect(invalid.status).toBe(401);
    expect(expired.status).toBe(401);
    expect(invalid.body.message).toBe("Invalid or expired access token.");
    expect(expired.body.message).toBe("Invalid or expired access token.");
  });

  it("sanitizes MongoDB operators and rejects malformed transaction query values", async () => {
    const injectedLogin = await request(app)
      .post("/api/auth/login")
      .send({ email: { $ne: null }, password: "admin-password-123" });
    const invalidPage = await request(app)
      .get("/api/transactions?page=0")
      .set("Authorization", `Bearer ${analystToken}`);

    expect(injectedLogin.status).toBe(400);
    expect(invalidPage.status).toBe(400);
    expect(injectedLogin.body.success).toBe(false);
  });

  it("filters and paginates transactions", async () => {
    const response = await request(app)
      .get("/api/transactions?riskScoreMin=0.5&predictedLabel=1&page=1&limit=10")
      .set("Authorization", `Bearer ${analystToken}`);
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ success: true, total: 1, page: 1 });
    expect(response.body.items[0].transactionId).toBe("rf-flagged-1");
    expect(response.body.items[0].passwordHash).toBeUndefined();

    const invalidRange = await request(app)
      .get("/api/transactions?riskScoreMin=0.9&riskScoreMax=0.2")
      .set("Authorization", `Bearer ${analystToken}`);
    expect(invalidRange.status).toBe(400);
    expect(invalidRange.body).toMatchObject({ success: false, errors: [] });

    const missing = await request(app)
      .get(`/api/transactions/${new mongoose.Types.ObjectId()}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(missing.status).toBe(404);
    expect(missing.body.message).toBe("Transaction not found.");
  });

  it("uses a stable final sort key when paginating tied transaction values", async () => {
    await Transaction.updateOne({ _id: flaggedTransaction._id }, { Amount: 10 });
    const pages = await Promise.all(
      [1, 2].map((page) =>
        request(app)
          .get(`/api/transactions?page=${page}&limit=1&sortBy=amount&sortOrder=asc`)
          .set("Authorization", `Bearer ${analystToken}`)
      )
    );
    const ids = pages.map((response) => {
      expect(response.status).toBe(200);
      return response.body.items[0]._id;
    });
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual([normalTransaction.id, flaggedTransaction.id].sort());
  });

  it("returns aggregation analytics and model outputs", async () => {
    const authorization = `Bearer ${analystToken}`;
    const summary = await request(app)
      .get("/api/analytics/summary")
      .set("Authorization", authorization);
    expect(summary.body).toMatchObject({
      totalTransactions: 2,
      flaggedCount: 1,
      fraudRate: 0.5,
      totalFlaggedAmount: 25,
      overall: { total: 2, predictedFraud: 1, actualFraud: 1 },
    });
    expect(summary.body.byModel).toHaveLength(2);

    const byHour = await request(app)
      .get("/api/analytics/fraud-over-time?interval=hour")
      .set("Authorization", authorization);
    expect(byHour.body.items).toHaveLength(2);
    const distribution = await request(app)
      .get("/api/analytics/risk-distribution")
      .set("Authorization", authorization);
    expect(distribution.body.items).toHaveLength(2);
    const top = await request(app)
      .get("/api/analytics/top-risky?limit=1")
      .set("Authorization", authorization);
    expect(top.body.items[0].transactionId).toBe("rf-flagged-1");

    const metrics = await request(app)
      .get("/api/models/metrics")
      .set("Authorization", authorization);
    expect(metrics.body.items[0].modelName).toBe("random_forest");
    const importance = await request(app)
      .get("/api/models/feature-importance")
      .set("Authorization", authorization);
    expect(importance.body.featureImportance[0].feature).toBe("V1");
  });

  it("restricts investigation creation to flagged transactions and supports case workflow", async () => {
    const authorization = `Bearer ${analystToken}`;
    const notFlagged = await request(app)
      .post("/api/investigations")
      .set("Authorization", authorization)
      .send({ transactionId: normalTransaction.id });
    expect(notFlagged.status).toBe(400);

    const opened = await request(app)
      .post("/api/investigations")
      .set("Authorization", authorization)
      .send({ transactionId: flaggedTransaction.id });
    expect(opened.status).toBe(201);
    const investigationId = opened.body.item._id;

    const details = await request(app)
      .get(`/api/transactions/${flaggedTransaction.id}`)
      .set("Authorization", authorization);
    expect(details.body.investigation._id).toBe(investigationId);

    const duplicate = await request(app)
      .post("/api/investigations")
      .set("Authorization", authorization)
      .send({ transactionId: flaggedTransaction.id });
    expect(duplicate.status).toBe(409);

    const note = await request(app)
      .post(`/api/investigations/${investigationId}/notes`)
      .set("Authorization", authorization)
      .send({ text: "Reviewed transaction pattern." });
    expect(note.status).toBe(201);
    expect(note.body.item.notes).toContain("Reviewed transaction pattern.");

    const updated = await request(app)
      .patch(`/api/investigations/${investigationId}`)
      .set("Authorization", authorization)
      .send({ status: "under_review", assignedTo: analyst.id });
    expect(updated.body.item).toMatchObject({
      status: "under_review",
      assignedTo: analyst.id,
    });

    const invalidStatus = await request(app)
      .patch(`/api/investigations/${investigationId}`)
      .set("Authorization", authorization)
      .send({ status: "not_a_valid_status" });
    expect(invalidStatus.status).toBe(400);

    const listing = await request(app)
      .get(`/api/investigations?status=under_review&assignedTo=${analyst.id}`)
      .set("Authorization", authorization);
    expect(listing.body.items).toHaveLength(1);
    expect(listing.body.items[0].transaction.transactionId).toBe("rf-flagged-1");
  });

  it("allows only admins to create analyst accounts", async () => {
    const denied = await request(app)
      .post("/api/users")
      .set("Authorization", `Bearer ${analystToken}`)
      .send({ name: "New Analyst", email: "new@example.test", password: "password-strong-123" });
    expect(denied.status).toBe(403);

    const created = await request(app)
      .post("/api/users")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "New Analyst", email: "new@example.test", password: "password-strong-123" });
    expect(created.status).toBe(201);
    expect(created.body.user.role).toBe("analyst");
    const savedUser = await User.findOne({ email: "new@example.test" }).select("+passwordHash");
    expect(savedUser.passwordHash).not.toBe("password-strong-123");

    const directory = await request(app)
      .get("/api/users/analysts")
      .set("Authorization", `Bearer ${analystToken}`);
    expect(directory.status).toBe(200);
    expect(directory.body.items.map((user) => user.email)).toContain("new@example.test");
    expect(JSON.stringify(directory.body)).not.toContain("passwordHash");
  });

  it("never includes password hashes in authenticated API responses", async () => {
    const authorization = `Bearer ${adminToken}`;
    const responses = await Promise.all([
      request(app).get("/api/users/analysts").set("Authorization", authorization),
      request(app).get("/api/admin/users").set("Authorization", authorization),
      request(app).get("/api/transactions").set("Authorization", authorization),
      request(app)
        .get(`/api/transactions/${flaggedTransaction.id}`)
        .set("Authorization", authorization),
      request(app).get("/api/investigations").set("Authorization", authorization),
      request(app).get("/api/models/metrics").set("Authorization", authorization),
      request(app).get("/api/models/feature-importance").set("Authorization", authorization),
    ]);

    for (const response of responses) {
      expect(response.status).toBe(200);
      expect(JSON.stringify(response.body)).not.toContain("passwordHash");
    }
  });

  it("rejects browser origins other than the configured client origin", async () => {
    const response = await request(app)
      .get("/api/health")
      .set("Origin", "https://unapproved.example");
    expect(response.status).toBe(403);
    expect(response.body).toMatchObject({ success: false, errors: [] });
  });
});
