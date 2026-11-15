import React, { useMemo, useState } from "react";
import { Copy, Check, FlaskConical, Sparkles, BarChart3 } from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { Transaction } from "../types/finance";
import { calculateForecastSeries, calculateMonthlySeries, formatCurrency } from "../lib/finance";
import {
  MODEL_CLASSES,
  MODEL_VOCAB_SIZE,
  predictExpense,
} from "../lib/tfidfClassifier";

interface ModelLabViewProps {
  transactions: Transaction[];
  currency: string;
}

const PYTHON_WORKFLOW = `import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression

# 1. Load exported MoneyMind AI CSV
df = pd.read_csv("moneymind-transactions.csv", parse_dates=["date"])
df["month"] = df["date"].dt.to_period("M")

# 2. Monthly cashflow aggregation
monthly = (
    df.pivot_table(index="month", columns="type", values="amount", aggfunc="sum")
    .fillna(0.0)
)
monthly["net"] = monthly.get("income", 0.0) - monthly.get("expense", 0.0)

# 3. Ordinary Least Squares (OLS) expense trend via NumPy
x = np.arange(len(monthly))
y = monthly["expense"].to_numpy()
slope, intercept = np.polyfit(x, y, 1)
y_pred = slope * x + intercept

mae = np.mean(np.abs(y - y_pred))
rmse = np.sqrt(np.mean((y - y_pred) ** 2))
print(f"Slope: {slope:.2f}/mo | MAE: {mae:.2f} | RMSE: {rmse:.2f}")

# 4. Transaction categorization (1-2 gram TF-IDF + Logistic Regression)
vec = TfidfVectorizer(ngram_range=(1, 2), lowercase=True)
X_text = vec.fit_transform(df["description"].astype(str))
clf = LogisticRegression(max_iter=1000).fit(X_text, df["category"])

# 5. Visualization
fig, ax = plt.subplots(figsize=(8, 4))
ax.bar(monthly.index.astype(str), y, color="#c26d3a", alpha=0.85, label="Actual Expense")
ax.plot(monthly.index.astype(str), y_pred, color="#2d6a62", lw=2, label="OLS Trend")
ax.set_title("Monthly Expense Forecast Evaluation")
ax.legend()
plt.tight_layout()
plt.show()`;

export const ModelLabView: React.FC<ModelLabViewProps> = ({ transactions, currency }) => {
  const [copied, setCopied] = useState(false);
  const [sampleText, setSampleText] = useState("swiggy dinner 450");

  const forecast = useMemo(() => calculateForecastSeries(transactions, 3), [transactions]);
  const monthly = useMemo(() => calculateMonthlySeries(transactions), [transactions]);
  const prediction = useMemo(() => predictExpense(sampleText), [sampleText]);

  const expenseCategoriesCount = useMemo(
    () =>
      new Set(
        transactions.filter((t) => t.type === "expense").map((t) => t.category),
      ).size,
    [transactions],
  );

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(PYTHON_WORKFLOW);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard blocked
    }
  };

  return (
    <div className="space-y-6">
      <header>
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Preprocessing · Classification · Walk-Forward Regression
        </p>
        <h1 className="mt-1 text-2xl sm:text-3xl font-semibold tracking-tight text-foreground">
          Model Lab &amp; Methodology
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Test the bundled {MODEL_VOCAB_SIZE}-feature TF-IDF classifier and compare walk-forward
          forecasting models on your own completed monthly records.
        </p>
      </header>

      {/* Interactive TF-IDF Preprocessing & Classifier Sandbox */}
      <section className="data-section border border-border bg-card p-5 sm:p-6 space-y-5">
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            Transaction Text Preprocessing &amp; TF-IDF Classifier
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Clean raw descriptions, extract 1–2 word n-grams, and score expense classes locally in
            the browser.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.85fr)] lg:items-start">
          <div className="space-y-2">
            <label
              htmlFor="model-lab-description"
              className="block text-xs font-medium text-muted-foreground"
            >
              Try a transaction description
            </label>
            <input
              id="model-lab-description"
              maxLength={200}
              value={sampleText}
              onChange={(e) => setSampleText(e.target.value)}
              placeholder="e.g., uber ride airport 640, bigbasket vegetables, udemy course"
              className="w-full rounded-md border border-input bg-background px-3.5 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <div className="flex flex-wrap gap-1.5 pt-1">
              {[
                "swiggy dinner 450",
                "uber ride 300",
                "bescom electricity bill 2200",
                "udemy python course 1299",
                "apollo pharmacy medicines",
              ].map((example) => (
                <button
                  key={example}
                  type="button"
                  onClick={() => setSampleText(example)}
                  className="rounded border border-border bg-muted/60 px-2 py-1 text-[11px] text-foreground hover:bg-muted transition-colors"
                >
                  {example}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-border bg-secondary/40 p-4 flex items-start gap-3">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground">Predicted category</p>
              <p className="mt-0.5 text-xl font-semibold text-foreground">{prediction.category}</p>
              <p className="mt-1 text-xs text-muted-foreground tabular-nums">
                {prediction.knownWords > 0
                  ? `Confidence ${(prediction.confidence * 100).toFixed(0)}% · ${prediction.knownWords} matched vocab features${prediction.lowConfidence ? " (low confidence)" : ""}`
                  : "No known model vocabulary tokens · fallback category"}
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-5 border-t border-border pt-4 md:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Cleaned Text &amp; Extracted N-grams
            </p>
            <p className="mt-2 font-mono text-xs bg-muted/60 rounded-md px-3 py-2 text-foreground break-words">
              {prediction.cleaned || "Enter a description to inspect normalized text."}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Matched TF-IDF tokens:{" "}
              <span className="font-mono text-foreground">
                {prediction.matchedTokens.length > 0
                  ? prediction.matchedTokens.join(", ")
                  : "none"}
              </span>
            </p>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Top Class Probabilities ({MODEL_CLASSES.length} classes)
            </p>
            <div className="mt-2 space-y-2">
              {prediction.scores.slice(0, 4).map((s) => (
                <div key={s.category} className="space-y-1">
                  <div className="flex justify-between text-xs tabular-nums">
                    <span className="font-medium text-foreground">{s.category}</span>
                    <span className="text-muted-foreground">{(s.probability * 100).toFixed(1)}%</span>
                  </div>
                  <div className="budget-track h-1.5 w-full rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${Math.min(100, s.probability * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Walk-Forward Forecast Model Comparison */}
      <section className="data-section border border-border bg-card p-5 sm:p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              Walk-Forward Forecast Model Comparison
            </h2>
            <p className="text-xs text-muted-foreground">
              Lower MAE and RMSE indicate more accurate out-of-sample predictions across completed months
            </p>
          </div>
          <span className="text-xs text-muted-foreground">
            Lowest RMSE winner:{" "}
            <strong className="font-semibold text-foreground">{forecast.selectedModelLabel}</strong>
          </span>
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
          <div>
            {forecast.candidates.length > 0 ? (
              <div className="h-[230px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={forecast.candidates}
                    layout="vertical"
                    margin={{ top: 4, right: 20, left: 8, bottom: 4 }}
                  >
                    <CartesianGrid stroke="var(--chart-grid)" horizontal={false} />
                    <XAxis
                      type="number"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "var(--chart-label)", fontSize: 10 }}
                      tickFormatter={(v) => formatCurrency(Number(v), currency, true)}
                    />
                    <YAxis
                      type="category"
                      dataKey="label"
                      width={165}
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "var(--chart-label)", fontSize: 11 }}
                    />
                    <Tooltip
                      formatter={(value) => formatCurrency(Number(value ?? 0), currency)}
                      contentStyle={{
                        backgroundColor: "var(--card)",
                        borderColor: "var(--border)",
                        borderRadius: "6px",
                        fontSize: "12px",
                      }}
                    />
                    <Bar dataKey="rmse" name="RMSE" fill="var(--chart-3)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[180px] grid place-items-center text-xs text-muted-foreground border border-dashed border-border rounded-lg p-6 text-center">
                <div className="space-y-2">
                  <BarChart3 className="h-5 w-5 mx-auto text-primary" />
                  <p>Add transactions across at least 3 months to evaluate walk-forward errors.</p>
                </div>
              </div>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="finance-table w-full min-w-[420px] border-collapse text-left">
              <thead>
                <tr>
                  <th>Model</th>
                  <th className="text-right">MAE</th>
                  <th className="text-right">RMSE</th>
                  <th className="text-right">R²</th>
                </tr>
              </thead>
              <tbody>
                {forecast.candidates.length > 0 ? (
                  forecast.candidates.map((row) => {
                    const isBest = row.model === forecast.selectedModel;
                    return (
                      <tr key={row.model}>
                        <td className="font-medium text-foreground">
                          {row.label}
                          {isBest && (
                            <span className="ml-2 text-[11px] font-semibold text-primary">
                              · Selected
                            </span>
                          )}
                        </td>
                        <td className="text-right tabular-nums">
                          {formatCurrency(row.mae, currency)}
                        </td>
                        <td className="text-right tabular-nums font-semibold text-foreground">
                          {formatCurrency(row.rmse, currency)}
                        </td>
                        <td className="text-right tabular-nums">
                          {row.r2 === null ? "—" : row.r2.toFixed(2)}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={4} className="py-6 text-xs text-muted-foreground">
                      Validation metrics appear once multi-month history is available.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Dataset Summary + Architecture Matrix */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="metric-panel border border-border bg-card p-5">
          <div className="text-xs font-medium text-muted-foreground">Account Ledger Records</div>
          <div className="metric-number text-2xl font-semibold text-foreground mt-3 tabular-nums">
            {transactions.length}
          </div>
          <div className="text-xs text-muted-foreground mt-1">Isolated to signed-in profile</div>
        </div>

        <div className="metric-panel border border-border bg-card p-5">
          <div className="text-xs font-medium text-muted-foreground">Months in Forecast Window</div>
          <div className="metric-number text-2xl font-semibold text-foreground mt-3 tabular-nums">
            {monthly.length}
          </div>
          <div className="text-xs text-muted-foreground mt-1">Walk-forward validation horizon</div>
        </div>

        <div className="metric-panel border border-border bg-card p-5">
          <div className="text-xs font-medium text-muted-foreground">Active Expense Categories</div>
          <div className="metric-number text-2xl font-semibold text-foreground mt-3 tabular-nums">
            {expenseCategoriesCount}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            Of {MODEL_CLASSES.length} TF-IDF classes
          </div>
        </div>
      </section>

      {/* Companion Python Analysis Toolkit */}
      <section className="data-section border border-border bg-card overflow-hidden flex flex-col">
        <div className="px-5 py-3.5 border-b border-border flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <FlaskConical className="h-4 w-4 text-primary shrink-0" />
            <div>
              <h2 className="text-base font-semibold text-foreground">
                Companion Python Analysis Toolkit (NumPy · pandas · Matplotlib)
              </h2>
              <p className="text-xs text-muted-foreground">
                Run offline diagnostics on CSV exports from Settings &rarr; Data &amp; Backup
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted whitespace-nowrap shrink-0"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
            <span>{copied ? "Copied" : "Copy script"}</span>
          </button>
        </div>
        <pre className="p-4 text-xs font-mono text-foreground overflow-x-auto leading-relaxed bg-muted/40">
          <code>{PYTHON_WORKFLOW}</code>
        </pre>
      </section>
    </div>
  );
};
