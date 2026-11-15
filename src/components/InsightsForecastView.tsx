import React from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from "recharts";
import { TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, ArrowRight } from "lucide-react";
import { Budget, Transaction, ViewId } from "../types/finance";
import {
  calculateForecastSeries,
  formatCurrency,
  formatMonthLabel,
  generateDeterministicInsights,
} from "../lib/finance";

interface InsightsForecastViewProps {
  transactions: Transaction[];
  budgets: Budget[];
  selectedMonth: string;
  currency: string;
  onNavigate: (view: ViewId) => void;
}

export const InsightsForecastView: React.FC<InsightsForecastViewProps> = ({
  transactions,
  budgets,
  selectedMonth,
  currency,
  onNavigate,
}) => {
  const effectiveMonth = selectedMonth === "all" ? "2026-11" : selectedMonth;
  const forecast = calculateForecastSeries(transactions, 3);
  const insights = generateDeterministicInsights(transactions, budgets, effectiveMonth, currency);

  const firstForecastLabel = forecast.series.find((p) => p.isForecast)?.label;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground">
            Insights &amp; Forecast
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Deterministic cashflow diagnostics and 3-month walk-forward projection ({forecast.selectedModelLabel})
          </p>
        </div>
        <button
          type="button"
          onClick={() => onNavigate("model-lab")}
          className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-4 py-2 text-xs font-medium text-foreground hover:bg-muted whitespace-nowrap shrink-0"
        >
          <span>Inspect methodology in Model Lab</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </header>

      {/* Forecast KPI Summary */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="metric-panel border border-border bg-card p-5">
          <div className="text-xs font-medium text-muted-foreground">
            Projected Next Month Income
          </div>
          <div className="metric-number text-2xl font-semibold text-foreground mt-3 tabular-nums">
            {formatCurrency(forecast.nextMonthProjectedIncome, currency)}
          </div>
          <div className="text-xs text-muted-foreground mt-1">Ordinary least-squares trend</div>
        </div>

        <div className="metric-panel border border-border bg-card p-5">
          <div className="text-xs font-medium text-muted-foreground">
            Projected Next Month Expenses
          </div>
          <div className="metric-number text-2xl font-semibold text-foreground mt-3 tabular-nums">
            {formatCurrency(forecast.nextMonthProjectedExpense, currency)}
          </div>
          <div className="text-xs text-muted-foreground mt-1 tabular-nums">
            Monthly trend slope: {forecast.slopePerMonth >= 0 ? "+" : ""}
            {formatCurrency(forecast.slopePerMonth, currency)}/mo
          </div>
        </div>

        <div className="metric-panel border border-border bg-card p-5">
          <div className="text-xs font-medium text-muted-foreground">
            Projected Next Month Net
          </div>
          <div className="metric-number text-2xl font-semibold text-foreground mt-3 tabular-nums">
            {formatCurrency(forecast.nextMonthProjectedNet, currency)}
          </div>
          <div className="text-xs text-muted-foreground mt-1 tabular-nums">
            Selected model RMSE: {formatCurrency(forecast.rmse, currency)}
          </div>
        </div>
      </section>

      {/* Forecast Trajectory Chart */}
      <section className="data-section border border-border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              Historical Actuals &amp; 3-Month Expense Projection
            </h2>
            <p className="text-xs text-muted-foreground">
              Bars show recorded monthly spend; lines track {forecast.selectedModelLabel} &amp; income trends
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <i className="inline-block w-2.5 h-2.5 rounded-sm bg-[var(--chart-expense)]" />
              Actual Expenses
            </span>
            <span className="inline-flex items-center gap-1.5">
              <i className="inline-block w-3 h-0.5 bg-[var(--chart-income)]" />
              Projected Income
            </span>
            <span className="inline-flex items-center gap-1.5">
              <i className="inline-block w-3 h-0.5 bg-[var(--chart-3)]" />
              Expense Forecast
            </span>
          </div>
        </div>

        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={forecast.series}
              margin={{ top: 10, right: 12, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: "var(--chart-label)", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: "var(--chart-label)", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => formatCurrency(Number(v), currency, true)}
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
              {firstForecastLabel && (
                <ReferenceLine
                  x={firstForecastLabel}
                  stroke="var(--border)"
                  strokeDasharray="4 4"
                  label={{
                    value: "Forecast horizon",
                    position: "top",
                    fill: "var(--muted-foreground)",
                    fontSize: 11,
                  }}
                />
              )}
              <Bar
                dataKey="actualExpenses"
                name="Actual Expenses"
                fill="var(--chart-expense)"
                radius={[4, 4, 0, 0]}
                barSize={28}
              />
              <Line
                type="monotone"
                dataKey="projectedIncome"
                name="Projected Income"
                stroke="var(--chart-income)"
                strokeWidth={2}
                dot={{ r: 3 }}
              />
              <Line
                type="monotone"
                dataKey="projectedExpenses"
                name="Expense Forecast"
                stroke="var(--chart-3)"
                strokeWidth={2}
                strokeDasharray="5 4"
                dot={{ r: 3 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Deterministic Insights Feed */}
      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            Deterministic Diagnostics ({formatMonthLabel(effectiveMonth)})
          </h2>
          <p className="text-xs text-muted-foreground">
            Calculated directly from verified account records without generative estimation
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {insights.length === 0 ? (
            <div className="col-span-full border border-border bg-card p-6 text-sm text-muted-foreground">
              Add transactions across months to unlock cashflow and budget diagnostics.
            </div>
          ) : (
            insights.map((ins) => {
              const Icon =
                ins.kind === "decrease" || ins.kind === "savings"
                  ? CheckCircle2
                  : ins.kind === "budget_warning" || ins.kind === "budget_exceeded"
                    ? AlertTriangle
                    : ins.kind === "increase"
                      ? TrendingUp
                      : TrendingDown;

              return (
                <div
                  key={ins.id}
                  className={`insight-item ${ins.kind} border border-border bg-card p-4 flex items-start gap-3.5`}
                >
                  <div className="insight-icon grid h-9 w-9 place-items-center rounded-md shrink-0">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-sm font-semibold text-foreground">{ins.title}</h3>
                      <span className="font-mono text-xs font-medium text-muted-foreground tabular-nums whitespace-nowrap">
                        {ins.metricLabel}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{ins.detail}</p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
};
