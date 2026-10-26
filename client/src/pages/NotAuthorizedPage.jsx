import { Link } from "react-router-dom";
import Card from "../components/Card";
import PageHeader from "../components/PageHeader";

export default function NotAuthorizedPage() {
  return (
    <>
      <PageHeader title="Not authorized" description="Your account does not have permission to view this page." />
      <Card><Link to="/dashboard">Return to dashboard</Link></Card>
    </>
  );
}
