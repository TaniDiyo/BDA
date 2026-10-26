import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import transactionsApi from "../api/transactions";
import { RiskBadge } from "../components/Badge";
import DataTable from "../components/DataTable";
import EmptyState from "../components/EmptyState";
import ErrorMessage from "../components/ErrorMessage";
import Loader from "../components/Loader";
import PageHeader from "../components/PageHeader";
import Pagination from "../components/Pagination";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { useResource } from "../hooks/useResource";
import { formatCurrency, formatLabel } from "../utils/format";
import { Link } from "react-router-dom";

export default function TransactionsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryString = searchParams.toString();
  const page = Math.max(1, Number(searchParams.get("page") || 1));
  const [searchDraft, setSearchDraft] = useState(searchParams.get("search") || "");
  const debouncedSearch = useDebouncedValue(searchDraft);

  // Keep the text input synchronized when a shared URL changes in browser history.
  useEffect(() => {
    setSearchDraft(searchParams.get("search") || "");
  }, [searchParams]);

  useEffect(() => {
    const next = new URLSearchParams(queryString);
    const currentSearch = next.get("search") || "";
    if (currentSearch === debouncedSearch.trim()) return;
    if (debouncedSearch.trim()) next.set("search", debouncedSearch.trim());
    else next.delete("search");
    next.delete("page");
    setSearchParams(next, { replace: true });
  }, [debouncedSearch, queryString, setSearchParams]);

  const { data, loading, error } = useResource(
    () => transactionsApi.list(Object.fromEntries(new URLSearchParams(queryString))),
    [queryString]
  );
  const rows = data?.items || [];

  function updateFilters(values, resetPage = true) {
    const next = new URLSearchParams(queryString);
    for (const [key, value] of Object.entries(values)) {
      if (value === "" || value === undefined || value === null) next.delete(key);
      else next.set(key, String(value));
    }
    if (resetPage) next.delete("page");
    setSearchParams(next, { replace: true });
  }

  const columns = [
    { key: "transactionId", label: "Transaction", render: (row) => <Link to={`/transactions/${row._id}`}>{row.transactionId}</Link> },
    { key: "modelUsed", label: "Model", render: (row) => formatLabel(row.modelUsed || row.model) },
    { key: "Amount", label: "Amount", render: (row) => formatCurrency(row.Amount ?? row.amount) },
    { key: "riskScore", label: "Risk score", render: (row) => <RiskBadge value={row.riskScore ?? row.fraudProbability} /> },
    { key: "predictedLabel", label: "Prediction", render: (row) => (row.predictedLabel ?? Number(row.predictedFraud)) === 1 ? "Flagged" : "Not flagged" },
    { key: "actualLabel", label: "Actual label", render: (row) => (row.actualLabel ?? Number(row.actualFraud)) === 1 ? "Fraud" : "Legitimate" },
  ];

  return (
    <>
      <PageHeader title="Transactions" description="Filter and sort scored transactions. Filter settings are reflected in the URL." />
      <section className="filter-panel" aria-label="Transaction filters">
        <label>Search transaction ID
          <input value={searchDraft} onChange={(event) => setSearchDraft(event.target.value)} placeholder="Search by ID" />
        </label>
        <label>Risk score min
          <input type="number" min="0" max="1" step="0.01" value={searchParams.get("riskScoreMin") || ""} onChange={(event) => updateFilters({ riskScoreMin: event.target.value })} />
        </label>
        <label>Risk score max
          <input type="number" min="0" max="1" step="0.01" value={searchParams.get("riskScoreMax") || ""} onChange={(event) => updateFilters({ riskScoreMax: event.target.value })} />
        </label>
        <label>Prediction
          <select value={searchParams.get("predictedLabel") || ""} onChange={(event) => updateFilters({ predictedLabel: event.target.value })}>
            <option value="">All labels</option><option value="1">Flagged</option><option value="0">Not flagged</option>
          </select>
        </label>
        <label>From date
          <input type="date" value={searchParams.get("startDate") || ""} onChange={(event) => updateFilters({ startDate: event.target.value })} />
        </label>
        <label>To date
          <input type="date" value={searchParams.get("endDate") || ""} onChange={(event) => updateFilters({ endDate: event.target.value })} />
        </label>
        <label>Amount min
          <input type="number" min="0" step="0.01" value={searchParams.get("amountMin") || ""} onChange={(event) => updateFilters({ amountMin: event.target.value })} />
        </label>
        <label>Amount max
          <input type="number" min="0" step="0.01" value={searchParams.get("amountMax") || ""} onChange={(event) => updateFilters({ amountMax: event.target.value })} />
        </label>
        <label>Sort by
          <select value={searchParams.get("sortBy") || "riskScore"} onChange={(event) => updateFilters({ sortBy: event.target.value }, false)}>
            <option value="riskScore">Risk score</option><option value="createdAt">Imported date</option><option value="amount">Amount</option>
          </select>
        </label>
        <label>Sort order
          <select value={searchParams.get("sortOrder") || "desc"} onChange={(event) => updateFilters({ sortOrder: event.target.value }, false)}>
            <option value="desc">Descending</option><option value="asc">Ascending</option>
          </select>
        </label>
      </section>
      <ErrorMessage>{error}</ErrorMessage>
      {loading && <Loader />}
      {!loading && !error && rows.length === 0 && <EmptyState title="No transactions match these filters" />}
      {rows.length > 0 && (
        <>
          <p className="muted">{data.total.toLocaleString()} matching records</p>
          <DataTable
            columns={columns}
            rows={rows}
            onRowClick={(row) => navigate(`/transactions/${row._id}`)}
            onRowKeyDown={(event, row) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                navigate(`/transactions/${row._id}`);
              }
            }}
          />
          <Pagination
            page={page}
            pages={data.pages}
            onPageChange={(nextPage) => updateFilters({ page: nextPage }, false)}
          />
        </>
      )}
    </>
  );
}
