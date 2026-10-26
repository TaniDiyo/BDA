const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });
const connectDatabase = require("../config/db");
const User = require("../models/User");
const Transaction = require("../models/Transaction");
const ModelMetric = require("../models/ModelMetric");

const MODEL_NAMES = ["logistic_regression", "random_forest"];
const DATASET_COLUMNS = [
  "Time",
  ...Array.from({ length: 28 }, (_, index) => `V${index + 1}`),
  "Amount",
  "Class",
];
const SCORING_COLUMNS = new Set([
  "model",
  "modelUsed",
  "modelName",
  "riskScore",
  "fraudProbability",
  "predictedLabel",
  "predictedFraud",
  "actualLabel",
  "actualFraud",
  "sourceRow",
  "transactionId",
  "prediction",
  "probability",
]);

function resolveOutputDirectory() {
  const argumentIndex = process.argv.indexOf("--input");
  if (argumentIndex >= 0) {
    const input = process.argv[argumentIndex + 1];
    if (!input) throw new Error("Provide a directory after --input.");
    return path.resolve(process.cwd(), input);
  }
  return path.resolve(__dirname, "../../../pipeline/output");
}

function firstExisting(candidates, description) {
  const found = candidates.find((candidate) => fs.existsSync(candidate));
  if (!found) {
    throw new Error(
      `${description} was not found. Generate the Phase 2 pipeline output before seeding.`
    );
  }
  return found;
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    throw new Error(`Could not read valid JSON from ${filePath}: ${error.message}`);
  }
}

function normalizeModelName(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  if (normalized === "logisticregression") return "logistic_regression";
  if (normalized === "randomforest") return "random_forest";
  if (!MODEL_NAMES.includes(normalized)) {
    throw new Error(`Unsupported or missing model name: ${value || "(empty)"}`);
  }
  return normalized;
}

function extractMetricRows(metricsDocument) {
  const models = metricsDocument.models || metricsDocument;
  if (Array.isArray(models)) {
    return models.map((metric) => [
      metric.modelName || metric.model || metric.name,
      metric,
    ]);
  }
  return Object.entries(models).filter(([, value]) => value && typeof value === "object");
}

function readMetrics(outputDirectory) {
  const filePath = firstExisting(
    [
      path.join(outputDirectory, "model_metrics.json"),
      path.join(outputDirectory, "metrics.json"),
    ],
    "Model metrics JSON"
  );
  return { filePath, document: readJson(filePath) };
}

function parseFeatureImportancePayload(payload, modelName) {
  let records = payload;
  if (!Array.isArray(records)) {
    records =
      records?.[modelName] ??
      records?.models?.[modelName] ??
      records?.featureImportance ??
      records?.feature_importance ??
      records?.features ??
      [];
  }
  if (!Array.isArray(records) && records && typeof records === "object") {
    records = Object.entries(records).map(([feature, importance]) => ({
      feature,
      importance,
    }));
  }
  if (!Array.isArray(records)) return [];
  return records.map((record) => {
    const feature = record.feature ?? record.name;
    return {
      feature: typeof feature === "string" ? feature.trim() : "",
      importance: Number(record.importance ?? record.score),
    };
  });
}

async function readCsvRecords(filePath) {
  const records = [];
  await new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(csv())
      .on("data", (record) => records.push(record))
      .on("end", resolve)
      .on("error", reject);
  });
  return records;
}

function partFiles(directory) {
  return fs
    .readdirSync(directory)
    .filter((name) => name.startsWith("part-") && /\.(csv|json)$/i.test(name))
    .sort()
    .map((name) => path.join(directory, name));
}

async function readFeatureImportance(outputDirectory) {
  const jsonPath = path.join(outputDirectory, "feature_importance.json");
  if (fs.existsSync(jsonPath)) return readJson(jsonPath);

  const legacyDirectory = path.join(outputDirectory, "feature_importance");
  if (fs.existsSync(legacyDirectory) && fs.statSync(legacyDirectory).isDirectory()) {
    const csvPath = partFiles(legacyDirectory).find((file) => /\.csv$/i.test(file));
    if (csvPath) return await readCsvRecords(csvPath);
  }
  return null;
}

function getScoreSources(outputDirectory) {
  const candidates = [
    path.join(outputDirectory, "scored_transactions.csv"),
    path.join(outputDirectory, "scored_transactions.json"),
    path.join(outputDirectory, "scored_transactions"),
  ];
  const combined = candidates.find((candidate) => fs.existsSync(candidate));
  if (combined) {
    if (fs.statSync(combined).isDirectory()) {
      const files = partFiles(combined);
      if (!files.length) throw new Error(`No scored transaction part files found in ${combined}`);
      return files.map((filePath) => ({ filePath, modelHint: null }));
    }
    return [{ filePath: combined, modelHint: null }];
  }

  // Accept the original Spark output layout as a migration path for earlier Phase 2 runs.
  return MODEL_NAMES.map((modelName) => {
    const directory = path.join(outputDirectory, `scored_${modelName}`);
    if (!fs.existsSync(directory)) {
      throw new Error(`Scored transaction output is missing: ${directory}`);
    }
    const filePath = partFiles(directory).find((file) => /\.csv$/i.test(file));
    if (!filePath) throw new Error(`No Spark CSV part file found in ${directory}`);
    return { filePath, modelHint: modelName };
  });
}

function readLabel(row, canonicalField, legacyField) {
  const value = row[canonicalField] ?? row[legacyField];
  if (value === true || value === "true") return 1;
  if (value === false || value === "false") return 0;
  const numeric = Number(value);
  if (numeric === 0 || numeric === 1) return numeric;
  throw new Error(`Transaction has an invalid ${canonicalField} value: ${value}`);
}

function readFiniteNumber(row, keys, description) {
  const key = keys.find((candidate) => row[candidate] !== undefined && row[candidate] !== "");
  const value = key ? Number(row[key]) : NaN;
  if (!Number.isFinite(value)) {
    throw new Error(`Transaction has no valid ${description} (${keys.join(" / ")}).`);
  }
  return value;
}

function mapScoredTransaction(row, modelHint, sourceRow) {
  const modelUsed = normalizeModelName(row.modelUsed || row.modelName || row.model || modelHint);
  const riskScore = readFiniteNumber(row, ["riskScore", "fraudProbability", "score"], "risk score");
  if (riskScore < 0 || riskScore > 1) {
    throw new Error(`Transaction risk score must be between 0 and 1; got ${riskScore}.`);
  }
  const predictedLabel = readLabel(row, "predictedLabel", "predictedFraud");
  const actualLabel =
    row.actualLabel !== undefined || row.actualFraud !== undefined
      ? readLabel(row, "actualLabel", "actualFraud")
      : readLabel(row, "Class", "label");
  const features = {};

  for (const [key, value] of Object.entries(row)) {
    if (SCORING_COLUMNS.has(key) || key === "label") continue;
    if (value === "" || value === null || value === undefined) continue;
    const number = Number(value);
    if (Number.isFinite(number) && !DATASET_COLUMNS.includes(key)) features[key] = number;
  }

  const record = {
    transactionId: String(row.transactionId || `${modelUsed}-${sourceRow}`),
    sourceRow: Number(row.sourceRow) || sourceRow,
    modelUsed,
    riskScore,
    predictedLabel,
    actualLabel,
    model: modelUsed,
    fraudProbability: riskScore,
    predictedFraud: predictedLabel === 1,
    actualFraud: actualLabel === 1,
    features,
  };
  for (const column of DATASET_COLUMNS) {
    if (column === "Class") {
      record.Class = actualLabel;
      continue;
    }
    if (row[column] !== undefined && row[column] !== "") {
      const value = Number(row[column]);
      if (Number.isFinite(value)) record[column] = value;
    }
  }
  if (record.Time !== undefined) record.time = record.Time;
  if (record.Amount !== undefined) record.amount = record.Amount;
  return record;
}

async function* iterateRecords(filePath) {
  if (/\.csv$/i.test(filePath)) {
    const stream = fs.createReadStream(filePath).pipe(csv());
    for await (const row of stream) yield row;
    return;
  }
  const payload = readJson(filePath);
  const records = Array.isArray(payload)
    ? payload
    : payload.scoredTransactions || payload.transactions || payload.records || payload.data;
  if (!Array.isArray(records)) {
    throw new Error(`Expected a JSON array or transactions/records/data array in ${filePath}.`);
  }
  for (const row of records) yield row;
}

async function importScoredTransactions(sources) {
  const batchSize = 500;
  const batch = [];
  const counts = Object.fromEntries(MODEL_NAMES.map((modelName) => [modelName, 0]));
  const modelRowNumbers = Object.fromEntries(MODEL_NAMES.map((name) => [name, 0]));
  let rowNumber = 0;

  const flush = async () => {
    if (!batch.length) return;
    const operations = batch.map((record) => ({
      updateOne: {
        filter: { modelUsed: record.modelUsed, sourceRow: record.sourceRow },
        update: { $set: record },
        upsert: true,
      },
    }));
    await Transaction.bulkWrite(operations, { ordered: false });
    batch.length = 0;
  };

  for (const source of sources) {
    for await (const row of iterateRecords(source.filePath)) {
      rowNumber += 1;
      const modelName = normalizeModelName(
        row.modelUsed || row.modelName || row.model || source.modelHint
      );
      modelRowNumbers[modelName] += 1;
      const record = mapScoredTransaction(row, modelName, modelRowNumbers[modelName]);
      batch.push(record);
      counts[modelName] += 1;
      if (batch.length >= batchSize) await flush();
    }
  }
  await flush();
  if (!rowNumber) throw new Error("Scored transaction file contains no rows.");
  return counts;
}

function normalizeMetricsRow(key, metric, root, featureImportance) {
  const modelName = normalizeModelName(metric.modelName || metric.model || key);
  const trainedAtValue =
    metric.trainedAt ||
    metric.generatedAtUtc ||
    root.trainedAt ||
    root.generatedAtUtc ||
    root.generatedAt;
  const trainedAt = new Date(trainedAtValue);
  if (!trainedAtValue || Number.isNaN(trainedAt.getTime())) {
    throw new Error(`Metrics for ${modelName} must include a valid trainedAt timestamp.`);
  }

  const importancePayload =
    metric.featureImportance ||
    metric.feature_importance ||
    (modelName === "random_forest" ? featureImportance : []);
  const importance = parseFeatureImportancePayload(importancePayload, modelName);
  if (importance.some((item) => !item.feature || !Number.isFinite(item.importance))) {
    throw new Error(`Feature importance for ${modelName} contains invalid values.`);
  }

  return {
    modelName,
    model: modelName,
    displayName: metric.displayName || modelName.replace(/_/g, " "),
    precision: Number(metric.precision),
    recall: Number(metric.recall),
    f1: Number(metric.f1),
    rocAuc: Number(metric.rocAuc ?? metric.roc_auc),
    prAuc: Number(metric.prAuc ?? metric.pr_auc ?? metric.areaUnderPR),
    confusionMatrix: metric.confusionMatrix,
    featureImportance: importance,
    trainedAt,
    evaluatedAt: trainedAt,
    runMetadata: root.runMetadata || {
      generatedAtUtc: root.generatedAtUtc,
      inputFile: root.inputFile,
      inputRows: root.inputRows,
      validRows: root.validRows,
      trainRows: root.trainRows,
      testRows: root.testRows,
      threshold: root.threshold,
    },
  };
}

async function importMetrics(outputDirectory, metricsFile) {
  const importance = await readFeatureImportance(outputDirectory);
  const rows = extractMetricRows(metricsFile.document);
  if (!rows.length) throw new Error("The model metrics JSON contains no model results.");

  for (const [key, metric] of rows) {
    const modelName = normalizeModelName(metric.modelName || metric.model || key);
    const document = normalizeMetricsRow(key, metric, metricsFile.document, importance);
    const values = [
      document.precision,
      document.recall,
      document.f1,
      document.rocAuc,
      document.prAuc,
    ];
    if (values.some((value) => !Number.isFinite(value) || value < 0 || value > 1)) {
      throw new Error(`Metrics for ${modelName} must contain valid 0-to-1 metric values.`);
    }
    if (!document.confusionMatrix) {
      throw new Error(`Metrics for ${modelName} are missing a confusion matrix.`);
    }
    await ModelMetric.updateOne(
      { modelName },
      { $set: document },
      { upsert: true, runValidators: true }
    );
  }
  return rows.length;
}

async function seedUsers() {
  const accounts = [
    {
      email: process.env.ADMIN_EMAIL,
      password: process.env.ADMIN_PASSWORD,
      name: process.env.ADMIN_NAME || "FraudLens Admin",
      role: "admin",
    },
    {
      email: process.env.ANALYST_EMAIL,
      password: process.env.ANALYST_PASSWORD,
      name: process.env.ANALYST_NAME || "FraudLens Analyst",
      role: "analyst",
    },
  ];
  for (const account of accounts) {
    if (!account.email || !account.password) {
      throw new Error(
        "Set ADMIN_EMAIL, ADMIN_PASSWORD, ANALYST_EMAIL, and ANALYST_PASSWORD in server/.env."
      );
    }
  }
  for (const account of accounts) {
    const passwordHash = await bcrypt.hash(account.password, 12);
    await User.updateOne(
      { email: account.email.toLowerCase() },
      {
        $set: {
          name: account.name,
          passwordHash,
          role: account.role,
          active: true,
        },
      },
      { upsert: true, runValidators: true }
    );
  }
}

async function main() {
  const outputDirectory = resolveOutputDirectory();
  const skipUsers = process.argv.includes("--skip-users");
  if (!fs.existsSync(outputDirectory) || !fs.statSync(outputDirectory).isDirectory()) {
    throw new Error(`Pipeline output directory does not exist: ${outputDirectory}`);
  }
  const requiredVariables = ["MONGODB_URI"];
  if (!skipUsers) {
    requiredVariables.push(
      "ADMIN_EMAIL",
      "ADMIN_PASSWORD",
      "ANALYST_EMAIL",
      "ANALYST_PASSWORD"
    );
  }
  for (const variable of requiredVariables) {
    if (!process.env[variable]) {
      throw new Error(`Set ${variable} in server/.env before running the seed script.`);
    }
  }
  const metricsFile = readMetrics(outputDirectory);
  const scoreSources = getScoreSources(outputDirectory);

  await connectDatabase();
  try {
    if (!skipUsers) await seedUsers();
    else console.log("Skipping initial user creation as requested.");
    const metricsImported = await importMetrics(outputDirectory, metricsFile);
    const transactionCounts = await importScoredTransactions(scoreSources);
    console.log(`Seeded ${metricsImported} model metric records.`);
    for (const [modelName, count] of Object.entries(transactionCounts)) {
      console.log(`Upserted ${count} scored transaction rows for ${modelName}.`);
    }
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error("Seed failed:", error.message);
    process.exitCode = 1;
  });
}

module.exports = {
  main,
  mapScoredTransaction,
  normalizeModelName,
  parseFeatureImportancePayload,
};
