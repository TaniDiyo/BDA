export default function EmptyState({ title = "Nothing to show yet", children }) {
  return (
    <div className="state empty-state">
      <strong>{title}</strong>
      <p>{children || "Run the batch pipeline and import its output to populate this view."}</p>
    </div>
  );
}
