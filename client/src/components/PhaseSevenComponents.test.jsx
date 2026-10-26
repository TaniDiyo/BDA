import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

vi.mock("../context/AuthContext", () => ({ useAuth: vi.fn() }));

import { useAuth } from "../context/AuthContext";
import Badge, { RiskBadge, StatusBadge } from "./Badge";
import DataTable from "./DataTable";
import ProtectedRoute from "./ProtectedRoute";
import RoleRoute from "./RoleRoute";
import StatCard from "./StatCard";
import LoginPage from "../pages/LoginPage";

afterEach(cleanup);

describe("route access components", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects a visitor without a session to login", () => {
    useAuth.mockReturnValue({ user: null, loading: false });
    render(
      <MemoryRouter initialEntries={["/private"]}>
        <Routes>
          <Route path="/login" element={<p>Sign-in destination</p>} />
          <Route element={<ProtectedRoute />}>
            <Route path="/private" element={<p>Private content</p>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText("Sign-in destination")).toBeInTheDocument();
    expect(screen.queryByText("Private content")).not.toBeInTheDocument();
  });

  it("blocks a signed-in user whose role is not allowed", () => {
    useAuth.mockReturnValue({ user: { role: "analyst" }, loading: false });
    render(
      <MemoryRouter initialEntries={["/admin"]}>
        <Routes>
          <Route element={<RoleRoute allowedRoles={["admin"]} />}>
            <Route path="/admin" element={<p>Admin content</p>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText("Not authorized")).toBeInTheDocument();
    expect(screen.queryByText("Admin content")).not.toBeInTheDocument();
  });
});

describe("login validation", () => {
  beforeEach(() => {
    useAuth.mockReturnValue({ user: null, loading: false, login: vi.fn() });
  });

  it("shows validation errors for invalid email and an empty password", () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "not-an-email" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "secret" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Enter a valid email address.");

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "person@example.test" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Enter your password.");
  });
});

describe("shared display components", () => {
  it("renders statistic values and badge labels", () => {
    render(
      <>
        <StatCard label="Transactions" value={123} description="Loaded records" />
        <Badge tone="success">Confirmed</Badge>
        <RiskBadge value={0.8} />
        <StatusBadge status="under_review" />
      </>
    );

    expect(screen.getByText("Transactions")).toBeInTheDocument();
    expect(screen.getByText("123")).toBeInTheDocument();
    expect(screen.getByText("Confirmed")).toHaveClass("success");
    expect(screen.getByText("80.0%")).toHaveClass("risk-high");
    expect(screen.getByText("under review")).toHaveClass("status-under_review");
  });

  it("renders loading, empty, and error states for a table", () => {
    const columns = [{ key: "name", label: "Name" }];
    const { rerender } = render(<DataTable columns={columns} loading />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading");

    rerender(<DataTable columns={columns} rows={[]} />);
    expect(screen.getByText("No records found")).toBeInTheDocument();

    rerender(<DataTable columns={columns} rows={[]} error="Unable to load records." />);
    expect(screen.getByRole("alert")).toHaveTextContent("Unable to load records.");
  });
});
