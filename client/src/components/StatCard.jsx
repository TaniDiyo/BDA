import Card from "./Card";

export default function StatCard({ label, value, description }) {
  return (
    <Card className="stat-card">
      <p className="muted">{label}</p>
      <strong>{value ?? "—"}</strong>
      {description && <small className="muted">{description}</small>}
    </Card>
  );
}
