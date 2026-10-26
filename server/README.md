# FraudLens API

Express and Mongoose API for the FraudLens dashboard. PySpark trains and scores transactions offline; this service reads the resulting records from MongoDB and supports authenticated review workflows.

## Run on Windows

Requirements: Node.js LTS, MongoDB Atlas (or a local MongoDB instance), and pipeline artifacts if you want the dashboard populated.

```powershell
Set-Location "E:\BDA Project\server"
npm install
Copy-Item .env.example .env
```

Edit `server\.env` and set:

- `MONGODB_URI`: your Atlas connection string (replace username, password, cluster, and database; URL-encode special characters in the password).
- `JWT_SECRET`: a randomly generated secret of at least 32 characters.
- `CLIENT_ORIGIN`: the exact React origin, such as `http://localhost:5173`.
- `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ANALYST_EMAIL`, and `ANALYST_PASSWORD`: demo accounts used by the seed script.
- `PORT`: API port; the example uses `4000`.

`JWT_EXPIRES_IN` controls token lifetime (example: `8h`). Never commit `server\.env`.

Start the API after configuring `MONGODB_URI`, `JWT_SECRET`, and `CLIENT_ORIGIN`:

```powershell
npm run dev
```

The server connects to MongoDB before listening. A successful startup logs the port; if Atlas is unreachable, the process reports the connection error and does not claim readiness. Health check: `http://localhost:4000/api/health`.

For a production host, set `NODE_ENV=production` in its environment and use `npm run start:prod`. SIGINT and SIGTERM stop new HTTP requests, close active connections after a timeout if necessary, and then disconnect MongoDB.

After Phase 2 creates pipeline output, seed its records and initial accounts in a separate terminal:

```powershell
Set-Location "E:\BDA Project\server"
npm run seed
```

The seed script defaults to `..\pipeline\output`. For a different output directory:

```powershell
npm run seed -- --input "E:\path\to\pipeline\output"
```

## API conventions

- Base URL: `http://localhost:4000/api`.
- Send `Authorization: Bearer <JWT>` on protected routes.
- Login response token carries the user's role; admin-only routes require an `admin` token.
- Success responses include `success: true` and `message`, plus the resource fields shown below.
- Errors use `{ "success": false, "message": "...", "errors": [] }`. Validation errors include field, location, and message entries in `errors`.
- CORS permits only the exact `CLIENT_ORIGIN` configured in `.env` (requests without an `Origin` header are allowed for tools and same-origin clients).
- General API limit is 300 requests per 15 minutes per client IP; login is limited to 10 attempts per 15 minutes.
- Dataset has no merchant or category fields, so top-risk analytics returns transactions.
- `fraud-over-time` groups the dataset's `Time` elapsed-seconds field into relative hour/day buckets; it is not a real-world transaction timestamp.
- The transaction list date filter operates on MongoDB `createdAt` (when imported), not the dataset's elapsed-time field.

## Endpoints

| Method | Path | Authentication / role | Query parameters or body | Example response fields |
| --- | --- | --- | --- | --- |
| `GET` | `/health` | None | — | `{ success, message, status: "ok" }` |
| `POST` | `/auth/login` | None; strict rate limit | JSON `{ "email", "password" }` | `{ success, message, token, user: { id, name, email, role } }` |
| `POST` | `/auth/signup` | None; strict rate limit; creates analyst only | JSON `{ "name", "email", "password" }`; password 12–128 characters | `201 { success, message, token, user: { id, name, email, role: "analyst" } }` |
| `GET` | `/auth/me` | Admin or analyst | — | `{ success, message, user: { id, name, email, role } }` |
| `POST` | `/users` | Admin only; creates analyst | JSON `{ "name", "email", "password" }`; password minimum 12 characters | `{ success, message, user: { id, name, email, role: "analyst" } }` |
| `GET` | `/users/analysts` | Admin or analyst | — | `{ success, message, items: [{ _id, name, email, role }] }` |
| `GET` | `/admin/users` | Admin only | — | `{ success, message, items: [{ id, name, email, role, active }] }` |
| `GET` | `/transactions` | Admin or analyst | `page`, `limit` (max 100), `sortBy` (`riskScore`, `createdAt`, `amount`), `sortOrder` (`asc`, `desc`), `riskScoreMin`, `riskScoreMax`, `predictedLabel` (0/1; legacy `predictedFraud=true\|false` also accepted), `model`, `startDate`, `endDate`, `amountMin`, `amountMax`, `search` (transaction ID) | `{ success, message, items: [], page, limit, total, pages }` |
| `GET` | `/transactions/:id` | Admin or analyst | MongoDB transaction ID | `{ success, message, transaction, investigation }` |
| `GET` | `/analytics/summary` | Admin or analyst | — | `{ success, message, totalTransactions, flaggedCount, fraudRate, totalFlaggedAmount, byModel }` |
| `GET` | `/analytics/fraud-over-time` | Admin or analyst | `interval=hour\|day` | `{ success, message, interval, items: [{ bucket, fraudCount, transactionCount }] }` |
| `GET` | `/analytics/risk-distribution` | Admin or analyst | — | `{ success, message, items: [{ bucket, lowerBound, count }] }` |
| `GET` | `/analytics/top-risky` | Admin or analyst | `limit` (1–100; default 10) | `{ success, message, items: [transaction, ...] }` |
| `GET` | `/models/metrics` | Admin or analyst | — | `{ success, message, items: [modelMetric, ...] }` |
| `GET` | `/models/feature-importance` | Admin or analyst | — | `{ success, message, modelName, featureImportance, trainedAt }` |
| `GET` | `/analytics/metrics` | Admin or analyst | Compatibility alias for `/models/metrics` | `{ success, message, items: [modelMetric, ...] }` |
| `GET` | `/investigations` | Admin or analyst | `status`, `assignedTo` (MongoDB user ID) | `{ success, message, items: [investigation, ...] }` |
| `POST` | `/investigations` | Admin or analyst | JSON `{ "transactionId", "notes"? }`; transaction must be flagged | `201 { success, message, item: investigation }` |
| `PATCH` | `/investigations/:id` | Admin or analyst | JSON with `status` and/or `assignedTo`; set `assignedTo` to `null` to unassign | `{ success, message, item: investigation }` |
| `POST` | `/investigations/:id/notes` | Admin or analyst | JSON `{ "text" }` | `201 { success, message, item: investigation }` |

Valid investigation statuses: `open`, `under_review`, `confirmed_fraud`, `false_positive`. An investigation can only be created for a flagged transaction; a unique transaction reference and conflict response prevent duplicate cases. Assignment accepts active analyst accounts.

### Example responses

Health:

```json
{
  "success": true,
  "message": "API is healthy.",
  "status": "ok"
}
```

Login (JWT shown as a placeholder):

```json
{
  "success": true,
  "message": "Login successful.",
  "token": "<JWT>",
  "user": {
    "id": "<user-id>",
    "name": "FraudLens Analyst",
    "email": "analyst@example.com",
    "role": "analyst"
  }
}
```

Transactions:

```json
{
  "success": true,
  "message": "Transactions retrieved.",
  "items": [],
  "page": 1,
  "limit": 25,
  "total": 0,
  "pages": 0
}
```

Summary (values are computed from the current database; these are field examples, not claimed results):

```json
{
  "success": true,
  "message": "Analytics summary retrieved.",
  "totalTransactions": 0,
  "flaggedCount": 0,
  "actualFraudCount": 0,
  "totalFlaggedAmount": 0,
  "averageRisk": 0,
  "fraudRate": 0,
  "overall": {
    "total": 0,
    "predictedFraud": 0,
    "actualFraud": 0,
    "averageRisk": 0
  },
  "byModel": []
}
```

Investigation list:

```json
{
  "success": true,
  "message": "Investigations retrieved.",
  "items": [
    {
      "_id": "<investigation-id>",
      "transaction": { "_id": "<transaction-id>", "transactionId": "random_forest-1" },
      "status": "under_review",
      "assignedTo": null,
      "notes": "Analyst note",
      "notesHistory": [
        { "text": "Analyst note", "author": "<user-id>", "timestamp": "<ISO-date>" }
      ]
    }
  ]
}
```

## Request examples

Use [api.http](./api.http) with the VS Code REST Client extension, or copy requests into another HTTP client. Run server tests with:

```powershell
npm test
```

Tests use `mongodb-memory-server` and do not require or connect to your Atlas account. For a real local smoke test, start with `npm run dev`, then send a health request:

```powershell
Invoke-RestMethod http://localhost:4000/api/health
```

Protected endpoint tests create temporary users and documents in an isolated in-memory MongoDB instance. They do not verify Atlas connectivity or deployment.
