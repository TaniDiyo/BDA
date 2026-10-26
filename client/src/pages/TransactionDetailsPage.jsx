import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import investigationsApi from "../api/investigations";
import transactionsApi from "../api/transactions";
import { RiskBadge, StatusBadge } from "../components/Badge";
import Button from "../components/Button";
import Card from "../components/Card";
import EmptyState from "../components/EmptyState";
import ErrorMessage from "../components/ErrorMessage";
import Loader from "../components/Loader";
import PageHeader from "../components/PageHeader";
import { useResource } from "../hooks/useResource";
import { formatCurrency, formatLabel, formatPercent } from "../utils/format";

const INTERNAL_FIELDS = new Set([
  "_id", "__v", "features", "model", "time", "amount",
  "fraudProbability", "predictedFraud", "actualFraud",
]);

function displayValue(key, value) {
  if (value === null || value === undefined || value === "") return "—";
  if (key === "riskScore" || key === "fraudProbability") return formatPercent(value);
  if (key === "Amount" || key === "amount") return formatCurrency(value);
  if (key === "predictedLabel" || key === "actualLabel" || key === "Class") {
    return Number(value) === 1 ? "Fraud (1)" : "Legitimate (0)";
  }
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export default function TransactionDetailsPage() {
  const { id } = useParams();
  const [refresh, setRefresh] = useState(0);
  const [caseOpened, setCaseOpened] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [errorAction, setErrorAction] = useState("");
  const { data, loading, error } = useResource(
    () => transactionsApi.get(id),
    [id, refresh]
  );
  const transaction = data?.transaction;
  const investigation = data?.investigation;
  const risk = transaction?.riskScore ?? transaction?.fraudProbability;
  const predicted = transaction?.predictedLabel ?? Number(transaction?.predictedFraud);
  const detailEntries = transaction
    ? [
        ...Object.entries(transaction).filter(([key]) => !INTERNAL_FIELDS.has(key)),
        ...Object.entries(transaction.features || {}).filter(
          ([key]) => !Object.prototype.hasOwnProperty.call(transaction, key)
        ),
      ]
    : [];

  async function openInvestigation() {
    setBusy(true);
    setFeedback("");
    setErrorAction("");
    try {
      await investigationsApi.create({ transactionId: transaction._id });
      setCaseOpened(true);
      setFeedback("Investigation opened.");
      setRefresh((value) => value + 1);
    } catch (requestError) {
      setErrorAction(requestError.response?.data?.message || requestError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader title="Transaction details" description={transaction?.transactionId || "Review the model score and linked case."} />
      {loading && <Loader />}
      <ErrorMessage>{error || errorAction}</ErrorMessage>
      {feedback && <p className="success-message" role="status">{feedback}</p>}
      {transaction && (
        <>
          <Card title="Fraud risk">
            <div className="risk-detail">
              <div><RiskBadge value={risk} /> <strong>{formatPercent(risk)}</strong></div>
              <progress max="1" value={Number(risk) || 0} aria-label={`Risk score ${formatPercent(risk)}`} />
              <p className="muted">
                Prediction: <strong>{predicted === 1 ? "Flagged as fraud" : "Not flagged"}</strong>
                {" · "}Model: <strong>{formatLabel(transaction.modelUsed || transaction.model)}</strong>
              </p>
            </div>
          </Card>
          <Card title="Transaction fields">
            <dl className="details-grid">
              {detailEntries.map(([key, value]) => (
                <div key={key}>
                  <dt>{formatLabel(key)}</dt>
                  <dd>{displayValue(key, value)}</dd>
                </div>
              ))}
            </dl>
          </Card>
          <Card title="Investigation">
            {investigation ? (
              <div className="investigation-summary">
                <StatusBadge status={investigation.status} />
                {investigation.assignedTo?.name && <p>Assigned to {investigation.assignedTo.name}</p>}
                {investigation.notesHistory?.length > 0 && (
                  <ol className="notes-timeline">
                    {investigation.notesHistory.map((note, index) => (
                      <li key={`${note.timestamp}-${index}`}>
                        <p>{note.text}</p>
                        <small>{note.author?.name || note.author?.email || "Analyst"} · {new Date(note.timestamp).toLocaleString()}</small>
                      </li>
                    ))}
                  </ol>
                )}
                <Link to="/investigations">Manage investigation</Link>
              </div>
            ) : predicted === 1 && !caseOpened ? (
              <Button disabled={busy} onClick={openInvestigation}>
                {busy ? "Opening…" : "Open investigation"}
              </Button>
            ) : (
              <EmptyState title="No investigation linked" />
            )}
          </Card>
        </>
      )}
      {!loading && !error && !transaction && <EmptyState title="Transaction not found" />}
    </>
  );
}
