import Card from "./Card";
import EmptyState from "./EmptyState";
import ErrorMessage from "./ErrorMessage";
import Loader from "./Loader";
import Skeleton from "./Skeleton";

export default function ChartCard({ title, loading, error, empty, children }) {
  return (
    <Card title={title} className="chart-card">
      {loading && (
        <>
          <Loader label={`Loading ${title.toLowerCase()}…`} />
          <Skeleton className="chart-skeleton" />
        </>
      )}
      <ErrorMessage>{error}</ErrorMessage>
      {!loading && !error && empty && <EmptyState title={`No ${title.toLowerCase()} data`} />}
      {!loading && !error && !empty && children}
    </Card>
  );
}
