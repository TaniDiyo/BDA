import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import modelsApi from "../api/models";
import Card from "../components/Card";
import ChartCard from "../components/ChartCard";
import EmptyState from "../components/EmptyState";
import ErrorMessage from "../components/ErrorMessage";
import Loader from "../components/Loader";
import PageHeader from "../components/PageHeader";
import { useResource } from "../hooks/useResource";
import { formatLabel, formatPercent } from "../utils/format";

const METRIC_ROWS = [
  ["Precision", "precision"],
  ["Recall", "recall"],
  ["F1", "f1"],
  ["ROC-AUC", "rocAuc"],
  ["PR-AUC", "prAuc"],
];

function getMatrixRows(matrix) {
  if (Array.isArray(matrix)) return matrix;
  if (Array.isArray(matrix?.rowsActualColumnsPredicted)) return matrix.rowsActualColumnsPredicted;
  if (Array.isArray(matrix?.matrix)) return matrix.matrix;
  return [];
}

function ConfusionMatrix({ matrix, modelName }) {
  const rows = getMatrixRows(matrix);
  if (!rows.length) return <EmptyState title="Confusion matrix unavailable" />;
  return (
    <div className="matrix-wrap">
      <p className="muted">Rows: actual · columns: predicted</p>
      <div className="confusion-matrix" role="table" aria-label={`${modelName} confusion matrix`}>
        {rows.map((row, rowIndex) => (
          <div className="matrix-row" role="row" key={rowIndex}>
            {row.map((value, columnIndex) => (
              <div
                className="matrix-cell"
                role="cell"
                key={columnIndex}
                aria-label={`Actual ${rowIndex}, predicted ${columnIndex}: ${value}`}
                title={`Actual ${rowIndex}, predicted ${columnIndex}`}
              >
                {Number(value).toLocaleString()}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ModelsPage() {
  const metrics = useResource(() => modelsApi.metrics(), []);
  const importance = useResource(() => modelsApi.featureImportance(), []);
  const models = metrics.data?.items || [];
  const features = (importance.data?.featureImportance || [])
    .filter((item) => Number.isFinite(Number(item.importance)))
    .slice(0, 15);

  return (
    <>
      <PageHeader title="Model comparison" description="Compare measured evaluation results from the batch run." />
      {metrics.loading && <Loader label="Loading model comparison…" />}
      <ErrorMessage>{metrics.error}</ErrorMessage>
      {!metrics.loading && !metrics.error && models.length === 0 && <EmptyState title="No model metrics available" />}
      {models.length > 0 && (
        <Card title="Evaluation metrics">
          <div className="table-scroll">
            <table className="data-table comparison-table">
              <thead><tr><th>Metric</th>{models.map((model) => (
                <th key={model.modelName || model.model}>{model.displayName || formatLabel(model.modelName || model.model)}</th>
              ))}</tr></thead>
              <tbody>{METRIC_ROWS.map(([label, key]) => (
                <tr key={key}><th scope="row">{label}</th>{models.map((model) => (
                  <td key={model.modelName || model.model}>{formatPercent(model[key])}</td>
                ))}</tr>
              ))}</tbody>
            </table>
          </div>
          <p className="plain-explainer">
            Fraud is rare in this dataset, so accuracy can look high even when a model misses most fraud.
            Recall shows how much actual fraud is found; PR-AUC summarizes precision and recall across
            thresholds and is useful when the positive class is uncommon.
          </p>
        </Card>
      )}
      {metrics.data && models.length > 0 && (
        <section className="page-grid">
          {models.map((model) => (
            <Card
              key={model.modelName || model.model}
              title={`${model.displayName || formatLabel(model.modelName || model.model)} confusion matrix`}
            >
              <ConfusionMatrix
                matrix={model.confusionMatrix}
                modelName={model.displayName || model.modelName || model.model}
              />
            </Card>
          ))}
        </section>
      )}
      <ChartCard
        title="Random Forest feature importance"
        loading={importance.loading}
        error={importance.error}
        empty={!features.length}
      >
        {features.length > 0 && (
          <div className="feature-chart-area">
            <ResponsiveContainer width="100%" height={Math.max(260, features.length * 34)}>
              <BarChart
                data={features}
                layout="vertical"
                margin={{ top: 8, right: 26, bottom: 8, left: 24 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" domain={[0, "auto"]} label={{ value: "Importance returned by API", position: "insideBottom", offset: -2 }} />
                <YAxis type="category" dataKey="feature" width={55} />
                <Tooltip formatter={(value) => formatPercent(value)} />
                <Bar dataKey="importance" name="Importance" fill="#286e58" radius={[0, 5, 5, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </ChartCard>
    </>
  );
}
