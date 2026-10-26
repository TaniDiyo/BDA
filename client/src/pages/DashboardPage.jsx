import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Link } from "react-router-dom";
import analyticsApi from "../api/analytics";
import { RiskBadge } from "../components/Badge";
import ChartCard from "../components/ChartCard";
import DataTable from "../components/DataTable";
import ErrorMessage from "../components/ErrorMessage";
import PageHeader from "../components/PageHeader";
import StatCard from "../components/StatCard";
import Skeleton from "../components/Skeleton";
import { useResource } from "../hooks/useResource";
import { formatCurrency, formatPercent } from "../utils/format";

const chartMargin = { top: 12, right: 18, bottom: 24, left: 4 };

export default function DashboardPage() {
  // Each widget fetches independently so a failed chart does not hide other dashboard data.
  const summary = useResource(() => analyticsApi.summary(), []);
  const timeSeries = useResource(() => analyticsApi.fraudOverTime({ interval: "day" }), []);
  const distribution = useResource(() => analyticsApi.riskDistribution(), []);
  const topRisky = useResource(() => analyticsApi.topRisky({ limit: 10 }), []);

  const summaryData = summary.data;
  const stats = [
    ["Total transactions", summaryData?.totalTransactions],
    ["Flagged transactions", summaryData?.flaggedCount],
    ["Fraud rate", summaryData ? formatPercent(summaryData.fraudRate) : undefined],
    ["Total flagged amount", summaryData ? formatCurrency(summaryData.totalFlaggedAmount) : undefined],
  ];
  const topColumns = [
    { key: "transactionId", label: "Transaction ID" },
    { key: "modelUsed", label: "Model" },
    { key: "Amount", label: "Amount", render: (row) => formatCurrency(row.Amount ?? row.amount) },
    { key: "riskScore", label: "Risk score", render: (row) => <RiskBadge value={row.riskScore ?? row.fraudProbability} /> },
    { key: "predictedLabel", label: "Prediction", render: (row) => (row.predictedLabel ?? Number(row.predictedFraud)) === 1 ? "Flagged" : "Not flagged" },
    { key: "open", label: "Details", render: (row) => <Link to={`/transactions/${row._id}`}>View</Link> },
  ];
  const timeItems = timeSeries.data?.items || [];
  const riskItems = distribution.data?.items || [];
  const topItems = topRisky.data?.items || [];

  return (
    <>
      <PageHeader title="Dashboard" description="Batch fraud analytics from scored transactions." />
      <section className="stat-grid" aria-label="Fraud summary">
        {summary.loading && Array.from({ length: 4 }, (_, index) => (
          <div className="card summary-skeleton" key={index}><Skeleton /><Skeleton /><Skeleton /></div>
        ))}
        <ErrorMessage>{summary.error}</ErrorMessage>
        {summaryData && stats.map(([label, value]) => (
          <StatCard key={label} label={label} value={value ?? "—"} />
        ))}
      </section>
      <section className="page-grid dashboard-charts">
        <ChartCard
          title="Fraud over time"
          loading={timeSeries.loading}
          error={timeSeries.error}
          empty={!timeItems.length}
        >
          <div className="chart-area">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={timeItems} margin={chartMargin}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="bucket" label={{ value: "Relative dataset day", position: "insideBottom", offset: -14 }} />
                <YAxis allowDecimals={false} label={{ value: "Fraud count", angle: -90, position: "insideLeft" }} />
                <Tooltip labelFormatter={(value) => `Relative day ${value}`} />
                <Area type="monotone" dataKey="fraudCount" name="Fraud count" stroke="#286e58" fill="#91c9a8" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
        <ChartCard
          title="Risk score distribution"
          loading={distribution.loading}
          error={distribution.error}
          empty={!riskItems.length}
        >
          <div className="chart-area">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={riskItems} margin={chartMargin}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="lowerBound" tickFormatter={(value) => formatPercent(value)} label={{ value: "Risk score bucket", position: "insideBottom", offset: -14 }} />
                <YAxis allowDecimals={false} label={{ value: "Transactions", angle: -90, position: "insideLeft" }} />
                <Tooltip labelFormatter={(value) => `Risk from ${formatPercent(value)}`} />
                <Bar dataKey="count" name="Transactions" fill="#468bb3" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </section>
      <ChartCard
        title="Top risky transactions"
        loading={topRisky.loading}
        error={topRisky.error}
        empty={!topItems.length}
      >
        <DataTable
          columns={topColumns}
          rows={topItems}
          getRowKey={(row) => row._id}
        />
      </ChartCard>
    </>
  );
}
