import { useEffect, useState } from "react";
import investigationsApi from "../api/investigations";
import usersApi from "../api/users";
import { StatusBadge } from "../components/Badge";
import Button from "../components/Button";
import Card from "../components/Card";
import DataTable from "../components/DataTable";
import EmptyState from "../components/EmptyState";
import ErrorMessage from "../components/ErrorMessage";
import Loader from "../components/Loader";
import PageHeader from "../components/PageHeader";
import { useResource } from "../hooks/useResource";
import { formatCurrency, formatPercent } from "../utils/format";

const statuses = ["open", "under_review", "confirmed_fraud", "false_positive"];

export default function InvestigationsPage() {
  const [statusFilter, setStatusFilter] = useState("");
  const [assigneeFilter, setAssigneeFilter] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [success, setSuccess] = useState("");
  const [actionError, setActionError] = useState("");
  const cases = useResource(
    () => investigationsApi.list({
      ...(statusFilter ? { status: statusFilter } : {}),
      ...(assigneeFilter ? { assignedTo: assigneeFilter } : {}),
    }),
    [statusFilter, assigneeFilter, refresh]
  );
  const analystResource = useResource(() => usersApi.listAnalysts(), []);
  const items = cases.data?.items || [];
  const analysts = analystResource.data?.items || [];
  const selected = items.find((item) => item._id === selectedId);

  useEffect(() => {
    if (items.length && !items.some((item) => item._id === selectedId)) {
      setSelectedId(items[0]._id);
    }
    if (!items.length) setSelectedId("");
  }, [items, selectedId]);

  function announceSuccess(message) {
    setSuccess(message);
    setActionError("");
    window.setTimeout(() => setSuccess(""), 4000);
  }

  async function updateCase(payload, message) {
    if (!selected) return;
    setBusy(true);
    setActionError("");
    setSuccess("");
    try {
      await investigationsApi.update(selected._id, payload);
      setRefresh((value) => value + 1);
      announceSuccess(message);
    } catch (error) {
      setActionError(error.response?.data?.message || error.message);
    } finally {
      setBusy(false);
    }
  }

  async function addNote(event) {
    event.preventDefault();
    if (!selected || !note.trim()) return;
    setBusy(true);
    setActionError("");
    setSuccess("");
    try {
      await investigationsApi.addNote(selected._id, { text: note.trim() });
      setNote("");
      setRefresh((value) => value + 1);
      announceSuccess("Note added to the case.");
    } catch (error) {
      setActionError(error.response?.data?.message || error.message);
    } finally {
      setBusy(false);
    }
  }

  const columns = [
    {
      key: "transaction",
      label: "Transaction",
      render: (item) => item.transaction?.transactionId || "—",
    },
    { key: "status", label: "Status", render: (item) => <StatusBadge status={item.status} /> },
    { key: "assignedTo", label: "Assigned to", render: (item) => item.assignedTo?.name || "Unassigned" },
  ];

  return (
    <>
      <PageHeader title="Investigations" description="Review flagged transactions and manage case history." />
      <div className="filter-panel investigation-filters">
        <label>Status
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="">All statuses</option>
            {statuses.map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}
          </select>
        </label>
        <label>Assigned analyst
          <select value={assigneeFilter} onChange={(event) => setAssigneeFilter(event.target.value)}>
            <option value="">All analysts</option>
            {analysts.map((analyst) => (
              <option key={analyst._id} value={analyst._id}>{analyst.name} · {analyst.email}</option>
            ))}
          </select>
        </label>
        <ErrorMessage>{analystResource.error}</ErrorMessage>
      </div>
      <ErrorMessage>{cases.error || actionError}</ErrorMessage>
      {success && <p className="success-message" role="status">{success}</p>}
      {cases.loading && <Loader />}
      {!cases.loading && !cases.error && items.length === 0 && (
        <EmptyState title="No investigations found" />
      )}
      {items.length > 0 && (
        <div className="investigation-workspace">
          <Card title="Cases">
            <DataTable
              columns={columns}
              rows={items}
              onRowClick={(item) => setSelectedId(item._id)}
              onRowKeyDown={(event, item) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  setSelectedId(item._id);
                }
              }}
            />
          </Card>
          {selected && (
            <Card title="Case details" className="case-detail">
              <p className="case-transaction">{selected.transaction?.transactionId || "Transaction record"}</p>
              <dl className="case-summary">
                <dt>Amount</dt>
                <dd>{formatCurrency(selected.transaction?.Amount ?? selected.transaction?.amount)}</dd>
                <dt>Risk score</dt>
                <dd>{formatPercent(selected.transaction?.riskScore ?? selected.transaction?.fraudProbability)}</dd>
              </dl>
              <label className="form-field">Status
                <select
                  disabled={busy}
                  value={selected.status}
                  onChange={(event) => updateCase({ status: event.target.value }, "Case status updated.")}
                >
                  {statuses.map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}
                </select>
              </label>
              <label className="form-field">Assigned analyst
                <select
                  disabled={busy || analystResource.loading}
                  value={selected.assignedTo?._id || ""}
                  onChange={(event) => updateCase(
                    { assignedTo: event.target.value || null },
                    event.target.value ? "Case assigned." : "Case unassigned."
                  )}
                >
                  <option value="">Unassigned</option>
                  {analysts.map((analyst) => (
                    <option key={analyst._id} value={analyst._id}>{analyst.name}</option>
                  ))}
                </select>
              </label>
              <h3 className="timeline-heading">Notes timeline</h3>
              {(selected.notesHistory || []).length === 0 ? (
                <p className="muted">No notes have been added to this case.</p>
              ) : (
                <ol className="notes-timeline">
                  {selected.notesHistory.map((entry, index) => (
                    <li key={`${entry.timestamp}-${index}`}>
                      <p>{entry.text}</p>
                      <small>
                        {entry.author?.name || entry.author?.email || "Analyst"}
                        {" · "}{new Date(entry.timestamp).toLocaleString()}
                      </small>
                    </li>
                  ))}
                </ol>
              )}
              <form className="note-form" onSubmit={addNote}>
                <label className="form-field">Add a note
                  <textarea
                    value={note}
                    maxLength={2000}
                    onChange={(event) => setNote(event.target.value)}
                    required
                  />
                </label>
                <Button type="submit" disabled={busy || !note.trim()}>
                  {busy ? "Saving…" : "Add note"}
                </Button>
              </form>
            </Card>
          )}
        </div>
      )}
    </>
  );
}
