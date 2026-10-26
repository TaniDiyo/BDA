import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({ user: null, loading: false, signup: vi.fn() }),
}));

import SignupPage from "./SignupPage";

afterEach(cleanup);

describe("signup form", () => {
  it("validates minimum password length and confirmation", () => {
    render(<MemoryRouter><SignupPage /></MemoryRouter>);
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Analyst" } });
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "analyst@example.test" },
    });
    fireEvent.change(screen.getByLabelText("Password (at least 12 characters)"), {
      target: { value: "short" },
    });
    fireEvent.change(screen.getByLabelText("Confirm password"), {
      target: { value: "short" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Password must be at least 12 characters."
    );

    fireEvent.change(screen.getByLabelText("Password (at least 12 characters)"), {
      target: { value: "long-password-123" },
    });
    fireEvent.change(screen.getByLabelText("Confirm password"), {
      target: { value: "different-password" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Passwords do not match.");
  });
});
