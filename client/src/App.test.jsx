import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "./context/AuthContext";

describe("FraudLens client", () => {
  it("redirects an unauthenticated visitor to the sign-in page", async () => {
    localStorage.clear();
    render(
      <MemoryRouter initialEntries={["/"]}>
        <AuthProvider><App /></AuthProvider>
      </MemoryRouter>
    );
    expect(await screen.findByRole("heading", { name: "Welcome back" })).toBeInTheDocument();
  });

  it("shows a not-found page for an unknown route", async () => {
    localStorage.clear();
    render(
      <MemoryRouter initialEntries={["/missing"]}>
        <AuthProvider><App /></AuthProvider>
      </MemoryRouter>
    );
    expect(await screen.findByRole("heading", { name: "Page not found" })).toBeInTheDocument();
  });

  it("opens the signup page for unauthenticated visitors", async () => {
    localStorage.clear();
    render(
      <MemoryRouter initialEntries={["/signup"]}>
        <AuthProvider><App /></AuthProvider>
      </MemoryRouter>
    );
    expect(await screen.findByRole("heading", { name: "Create your account" }))
      .toBeInTheDocument();
  });
});
