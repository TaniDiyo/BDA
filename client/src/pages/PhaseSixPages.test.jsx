import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

const apiMocks = vi.hoisted(() => ({
  summary: vi.fn(),
  fraudOverTime: vi.fn(),
  riskDistribution: vi.fn(),
  topRisky: vi.fn(),
  transactionList: vi.fn(),
  transactionGet: vi.fn(),
  createInvestigation: vi.fn(),
  metrics: vi.fn(),
  featureImportance: vi.fn(),
}));

vi.mock("../api/analytics", () => ({
  default: {
    summary: apiMocks.summary,
    fraudOverTime: apiMocks.fraudOverTime,
    riskDistribution: apiMocks.riskDistribution,
    topRisky: apiMocks.topRisky,
  },
}));
vi.mock("../api/transactions", () => ({
  default: {
    list: apiMocks.transactionList,
    get: apiMocks.transactionGet,
  },
}));
vi.mock("../api/investigations", () => ({
  default: {
    create: apiMocks.createInvestigation,
    list: vi.fn(),
    update: vi.fn(),
    addNote: vi.fn(),
  },
}));
vi.mock("../api/models", () => ({
  default: { metrics: apiMocks.metrics, featureImportance: apiMocks.featureImportance },
}));
vi.mock("recharts", () => ({
  Area: () => null,
  AreaChart: ({ children }) => <div>{children}</div>,
  Bar: () => null,
  BarChart: ({ children }) => <div>{children}</div>,
  CartesianGrid: () => null,
  ResponsiveContainer: ({ children }) => <div>{children}</div>,
  Tooltip: () => null,
  XAxis: () => null,
  YAxis: () => null,
}));

import DashboardPage from "./DashboardPage";
import TransactionDetailsPage from "./TransactionDetailsPage";
import TransactionsPage from "./TransactionsPage";

afterEach(cleanup);

function renderWithRoute(element, path = "/dashboard") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/dashboard" element={element} />
        <Route path="/transactions" element={<TransactionsPage />} />
        <Route path="/transactions/:id" element={<TransactionDetailsPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("Phase 6 dashboard and transaction details", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMocks.summary.mockResolvedValue({
      data: {
        totalTransactions: 3,
        flaggedCount: 1,
        fraudRate: 1 / 3,
        totalFlaggedAmount: 25,
      },
    });
    apiMocks.fraudOverTime.mockResolvedValue({ data: { items: [{ bucket: 0, fraudCount: 1 }] } });
    apiMocks.riskDistribution.mockResolvedValue({
      data: { items: [{ bucket: 9, lowerBound: 0.9, count: 1 }] },
    });
    apiMocks.topRisky.mockResolvedValue({
      data: {
        items: [{
          _id: "transaction-id",
          transactionId: "rf-high",
          modelUsed: "random_forest",
          riskScore: 0.9,
          predictedLabel: 1,
          Amount: 25,
        }],
      },
    });
    apiMocks.transactionList.mockResolvedValue({
      data: {
        items: [{
          _id: "transaction-id",
          transactionId: "rf-high",
          modelUsed: "random_forest",
          riskScore: 0.9,
          predictedLabel: 1,
          actualLabel: 1,
          Amount: 25,
        }],
        page: 2,
        pages: 3,
        total: 21,
      },
    });
    apiMocks.transactionGet.mockResolvedValue({
      data: {
        transaction: {
          _id: "transaction-id",
          transactionId: "rf-high",
          modelUsed: "random_forest",
          riskScore: 0.9,
          predictedLabel: 1,
          actualLabel: 1,
          Amount: 25,
          V1: 0.25,
        },
        investigation: null,
      },
    });
    apiMocks.createInvestigation.mockResolvedValue({ data: { success: true } });
  });

  it("renders API-provided dashboard cards and independent analytics widgets", async () => {
    renderWithRoute(<DashboardPage />);
    expect(await screen.findByText("Total transactions")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("Fraud over time")).toBeInTheDocument();
    expect(screen.getByText("Risk score distribution")).toBeInTheDocument();
    expect(screen.getByText("rf-high")).toBeInTheDocument();
    expect(apiMocks.fraudOverTime).toHaveBeenCalledWith({ interval: "day" });
  });

  it("keeps successful dashboard widgets visible when another widget request fails", async () => {
    apiMocks.fraudOverTime.mockRejectedValue(new Error("time-series unavailable"));
    renderWithRoute(<DashboardPage />);
    expect(await screen.findByRole("alert")).toHaveTextContent("time-series unavailable");
    expect(screen.getByText("Total transactions")).toBeInTheDocument();
    expect(screen.getByText("Top risky transactions")).toBeInTheDocument();
    expect(screen.getByText("rf-high")).toBeInTheDocument();
  });

  it("loads transaction filters from the URL and sends them to the list API", async () => {
    renderWithRoute(
      <TransactionsPage />,
      "/transactions?riskScoreMin=0.5&predictedLabel=1&page=2&sortBy=amount&sortOrder=asc"
    );
    expect(await screen.findByText("rf-high")).toBeInTheDocument();
    await waitFor(() => expect(apiMocks.transactionList).toHaveBeenCalledWith({
      riskScoreMin: "0.5",
      predictedLabel: "1",
      page: "2",
      sortBy: "amount",
      sortOrder: "asc",
    }));
    expect(screen.getByLabelText("Risk score min")).toHaveValue(0.5);
    expect(screen.getByLabelText("Prediction")).toHaveValue("1");
  });

  it("offers opening a case only when absent and refreshes the transaction after creation", async () => {
    renderWithRoute(<TransactionDetailsPage />, "/transactions/transaction-id");
    expect(await screen.findByText("Transaction fields")).toBeInTheDocument();
    expect(screen.getByText("V1")).toBeInTheDocument();
    const openButton = screen.getByRole("button", { name: "Open investigation" });
    fireEvent.click(openButton);
    await waitFor(() => expect(apiMocks.createInvestigation).toHaveBeenCalledWith({
      transactionId: "transaction-id",
    }));
    expect(await screen.findByText("Investigation opened.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Open investigation" })).not.toBeInTheDocument();
  });

  it("does not offer opening a second case for an already investigated transaction", async () => {
    apiMocks.transactionGet.mockResolvedValue({
      data: {
        transaction: {
          _id: "transaction-id",
          transactionId: "rf-high",
          riskScore: 0.9,
          predictedLabel: 1,
        },
        investigation: { status: "under_review", notesHistory: [] },
      },
    });
    renderWithRoute(<TransactionDetailsPage />, "/transactions/transaction-id");
    expect(await screen.findByText("under review")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Open investigation" })).not.toBeInTheDocument();
  });
});
