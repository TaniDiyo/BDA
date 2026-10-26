import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Button from "./Button";

const links = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/transactions", label: "Transactions" },
  { to: "/models", label: "Models" },
  { to: "/investigations", label: "Investigations" },
];

export default function AppLayout() {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();
  const navigation = user?.role === "admin"
    ? [...links, { to: "/users", label: "Users" }]
    : links;

  function signOut() {
    logout(false);
    navigate("/login", { replace: true });
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${menuOpen ? "sidebar-open" : ""}`}>
        <NavLink className="brand" to="/dashboard" onClick={() => setMenuOpen(false)}>
          Fraud<span>Lens</span><small>BDA ANALYTICS</small>
        </NavLink>
        <nav aria-label="Main navigation">
          {navigation.map(({ to, label }) => (
            <NavLink key={to} to={to} onClick={() => setMenuOpen(false)}>{label}</NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">Offline Spark · Batch analytics</div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <Button
            variant="secondary"
            className="mobile-menu"
            aria-expanded={menuOpen}
            aria-label="Toggle navigation"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            Menu
          </Button>
          <div className="topbar-user">
            <span className="avatar">{user?.name?.slice(0, 1).toUpperCase() || "U"}</span>
            <span><strong>{user?.name || user?.email}</strong><small>{user?.role}</small></span>
            <Button variant="secondary" onClick={signOut}>Log out</Button>
          </div>
        </header>
        <main className="page-content"><Outlet /></main>
      </div>
    </div>
  );
}
