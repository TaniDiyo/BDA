import { formatPercent } from "../utils/format";

export function RiskBadge({ value }) {
  const score = Number(value);
  // These fixed bands make the same probability score visually comparable across screens.
  const level = score >= 0.5 ? "high" : score >= 0.2 ? "medium" : "low";
  return <span className={`badge risk-${level}`}>{formatPercent(score)}</span>;
}

export function StatusBadge({ status }) {
  return <span className={`badge status-${status}`}>{status?.replaceAll("_", " ") || "Unknown"}</span>;
}

export default function Badge({ children, tone = "neutral" }) {
  return <span className={`badge ${tone}`}>{children}</span>;
}
