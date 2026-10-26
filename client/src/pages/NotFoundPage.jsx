import { Link } from "react-router-dom";
import Card from "../components/Card";

export default function NotFoundPage() {
  return (
    <main className="center-page">
      <Card>
        <p className="eyebrow">404</p>
        <h1>Page not found</h1>
        <p className="muted">The page you requested does not exist.</p>
        <Link to="/dashboard">Go to dashboard</Link>
      </Card>
    </main>
  );
}
