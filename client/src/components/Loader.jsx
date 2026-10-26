export default function Loader({ label = "Loading…" }) {
  return <div className="state loader" role="status" aria-live="polite">{label}</div>;
}
