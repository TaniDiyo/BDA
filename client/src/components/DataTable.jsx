import EmptyState from "./EmptyState";
import ErrorMessage from "./ErrorMessage";
import Loader from "./Loader";

export default function DataTable({
  columns,
  rows = [],
  getRowKey = (row) => row._id,
  onRowClick,
  onRowKeyDown,
  loading = false,
  error = "",
  emptyMessage = "No records found",
}) {
  if (loading) return <Loader />;
  if (error) return <ErrorMessage>{error}</ErrorMessage>;
  if (!rows.length) return <EmptyState title={emptyMessage} />;
  return (
    <div className="table-scroll">
      <table className="data-table">
        <thead>
          <tr>{columns.map((column) => <th key={column.key}>{column.label}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={getRowKey(row)}
              className={onRowClick ? "clickable-row" : undefined}
              onClick={onRowClick ? (event) => {
                if (event.target.closest("a, button, input, select")) return;
                onRowClick(row);
              } : undefined}
              onKeyDown={onRowKeyDown ? (event) => onRowKeyDown(event, row) : undefined}
              tabIndex={onRowClick ? 0 : undefined}
            >
              {columns.map((column) => (
                <td key={column.key}>
                  {column.render ? column.render(row) : row[column.key] ?? "—"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
