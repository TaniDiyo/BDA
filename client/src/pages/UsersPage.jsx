import { useState } from "react";
import usersApi from "../api/users";
import Button from "../components/Button";
import DataTable from "../components/DataTable";
import EmptyState from "../components/EmptyState";
import ErrorMessage from "../components/ErrorMessage";
import Loader from "../components/Loader";
import PageHeader from "../components/PageHeader";
import { useResource } from "../hooks/useResource";

export default function UsersPage() {
  const [refresh, setRefresh] = useState(0);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const resource = useResource(() => usersApi.list(), [refresh]);
  const users = resource.data?.items || [];
  const columns = [
    { key: "name", label: "Name" },
    { key: "email", label: "Email" },
    { key: "role", label: "Role" },
    { key: "active", label: "Active", render: (user) => user.active ? "Yes" : "No" },
  ];

  async function createAnalyst(event) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setBusy(true);
    try {
      await usersApi.createAnalyst({ name: name.trim(), email: email.trim(), password });
      setName("");
      setEmail("");
      setPassword("");
      setRefresh((value) => value + 1);
      setSuccess("Analyst account created.");
    } catch (requestError) {
      setError(requestError.response?.data?.message || requestError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader title="Users" description="View workspace accounts and provision analyst access." />
      <section className="user-page-grid">
        <form className="card form-stack" onSubmit={createAnalyst}>
          <h2 className="card-title">Create analyst</h2>
          <label>Name
            <input value={name} onChange={(event) => setName(event.target.value)} required maxLength={100} />
          </label>
          <label>Email
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </label>
          <label>Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength={12}
              maxLength={128}
              autoComplete="new-password"
            />
          </label>
          <small className="muted">Use at least 12 characters. The password is hashed by the API.</small>
          <ErrorMessage>{error}</ErrorMessage>
          {success && <p className="success-message" role="status">{success}</p>}
          <Button type="submit" disabled={busy}>{busy ? "Creating…" : "Create analyst"}</Button>
        </form>
        <section className="card users-list">
          <h2 className="card-title">Workspace users</h2>
          {resource.loading && <Loader />}
          <ErrorMessage>{resource.error}</ErrorMessage>
          {!resource.loading && !resource.error && users.length === 0 && (
            <EmptyState title="No user accounts found" />
          )}
          {users.length > 0 && <DataTable columns={columns} rows={users} />}
        </section>
      </section>
    </>
  );
}
