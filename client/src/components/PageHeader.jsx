export default function PageHeader({ title, description, actions }) {
  return (
    <header className="page-header">
      <div>
        <p className="eyebrow">FRAUDLENS WORKSPACE</p>
        <h1>{title}</h1>
        {description && <p className="muted">{description}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  );
}
