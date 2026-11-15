import React from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Plus,
  TrendingUp,
  Wallet,
  PiggyBank,
  MessageSquareText,
  ChevronRight,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { Budget, Transaction, ViewId } from "../types/finance";
import {
  calculateCategoryBreakdown,
  calculateForecastSeries,
  calculateMonthMetrics,
  calculateMonthlySeries,
  filterTransactionsByMonth,
  formatCurrency,
  formatMonthLabel,
} from "../lib/finance";
import { CATEGORY_COLORS } from "../lib/seedData";
import { formatDisplayDate, type DateFormatOption } from "../lib/workspace-settings";

interface OverviewViewProps {
  transactions: Transaction[];
  budgets: Budget[];
  selectedMonth: string;
  currency: string;
  dateFormat: DateFormatOption;
  onOpenAddTransaction: () => void;
  onNavigate: (view: ViewId) => void;
}

export const OverviewView: React.FC<OverviewViewProps> = ({
  transactions,
  selectedMonth,
  currency,
  dateFormat,
  onOpenAddTransaction,
  onNavigate,
}) => {
  const metrics = calculateMonthMetrics(transactions, selectedMonth);
  const monthlySeries = calculateMonthlySeries(transactions);
  const breakdown = calculateCategoryBreakdown(transactions, selectedMonth, "expense").slice(0, 6);
  const forecast = calculateForecastSeries(transactions, 3);
  const recentTx = filterTransactionsByMonth(transactions, selectedMonth)
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 6);

  const periodLabel =
    selectedMonth === "all" ? "All Recorded Months" : formatMonthLabel(selectedMonth);

  return (
    <div className="space-y-6">
      {/* Top Workspace Header */}
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground">
            Overview
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {periodLabel} · {metrics.transactionCount} recorded entries
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => onNavigate("assistant")}
            className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors whitespace-nowrap shrink-0"
          >
            <MessageSquareText className="h-4 w-4 text-primary" />
            <span>Ask AI Assistant</span>
          </button>
          <button
            type="button"
            onClick={onOpenAddTransaction}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-95 transition-opacity whitespace-nowrap shrink-0"
          >
            <Plus className="h-4 w-4" />
            <span>Log Transaction</span>
          </button>
        </div>
      </header>

      {/* 4 KPI Summary Cards */}
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4" aria-label="Key metrics">
        <div className="metric-panel metric-income border border-border bg-card p-5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-muted-foreground">Total Income</span>
            <span className="metric-icon grid h-8 w-8 place-items-center rounded-md">
              <ArrowDownLeft className="h-4 w-4" />
            </span>
          </div>
          <div className="metric-number text-2xl font-semibold text-foreground mt-4 tabular-nums">
            {formatCurrency(metrics.income, currency)}
          </div>
          <div className="text-xs text-muted-foreground mt-1.5 tabular-nums">
            {metrics.incomeDeltaPct !== null
              ? `${metrics.incomeDeltaPct >= 0 ? "+" : ""}${metrics.incomeDeltaPct.toFixed(1)}% vs prior month`
              : "Inflows recorded in period"}
          </div>
        </div>

        <div className="metric-panel metric-expense border border-border bg-card p-5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-muted-foreground">Total Expenses</span>
            <span className="metric-icon grid h-8 w-8 place-items-center rounded-md">
              <ArrowUpRight className="h-4 w-4" />
            </span>
          </div>
          <div className="metric-number text-2xl font-semibold text-foreground mt-4 tabular-nums">
            {formatCurrency(metrics.expenses, currency)}
          </div>
          <div className="text-xs text-muted-foreground mt-1.5 tabular-nums">
            {metrics.expenseDeltaPct !== null
              ? `${metrics.expenseDeltaPct >= 0 ? "+" : ""}${metrics.expenseDeltaPct.toFixed(1)}% vs prior month`
              : "Outflows recorded in period"}
          </div>
        </div>

        <div className="metric-panel metric-balance border border-border bg-card p-5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-muted-foreground">Net Balance</span>
            <span className="metric-icon grid h-8 w-8 place-items-center rounded-md">
              <Wallet className="h-4 w-4" />
            </span>
          </div>
          <div className="metric-number text-2xl font-semibold text-foreground mt-4 tabular-nums">
            {formatCurrency(metrics.balance, currency)}
          </div>
          <div className="text-xs text-muted-foreground mt-1.5">
            {metrics.balance >= 0 ? "Net surplus retained" : "Net deficit drawn"}
          </div>
        </div>

        <div className="metric-panel border border-border bg-card p-5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-muted-foreground">Savings Rate</span>
            <span className="metric-icon grid h-8 w-8 place-items-center rounded-md">
              <PiggyBank className="h-4 w-4" />
            </span>
          </div>
          <div className="metric-number text-2xl font-semibold text-foreground mt-4 tabular-nums">
            {metrics.savingsRate.toFixed(1)}%
          </div>
          <div className="text-xs text-muted-foreground mt-1.5">
            {metrics.savingsRate >= 20 ? "Above 20% benchmark" : "Below 20% target"}
          </div>
        </div>
      </section>

      {/* Forecast Strip */}
      <div className="forecast-strip border border-border bg-card px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <TrendingUp className="h-4 w-4 text-primary shrink-0" />
          <p className="text-sm text-foreground">
            Next month outlook ({forecast.selectedModelLabel}):{" "}
            <strong className="font-semibold tabular-nums">
              {formatCurrency(forecast.nextMonthProjectedExpense, currency)}
            </strong>{" "}
            projected spend ·{" "}
            <strong className="font-semibold tabular-nums">
              {formatCurrency(forecast.nextMonthProjectedNet, currency)}
            </strong>{" "}
            projected net surplus
          </p>
        </div>
        <button
          type="button"
          onClick={() => onNavigate("insights")}
          className="forecast-link inline-flex items-center gap-1 text-xs font-semibold whitespace-nowrap shrink-0"
        >
          <span>View forecast &amp; insights</span>
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Main Analytics Split: Cashflow Chart + Category Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <section className="data-section lg:col-span-2 border border-border bg-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Monthly Cashflow</h2>
              <p className="text-xs text-muted-foreground">Income versus expenses by month</p>
            </div>
            <div className="chart-key text-xs text-muted-foreground">
              <i className="key-income" />
              <span>Income</span>
              <i className="key-expense" />
              <span>Expenses</span>
            </div>
          </div>

          <div className="h-64 w-full">
            {monthlySeries.length === 0 ? (
              <div className="h-full grid place-items-center text-sm text-muted-foreground">
                No cashflow entries recorded yet.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlySeries} margin={{ top: 8, right: 8, left: -4, bottom: 0 }}>
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
                  <Bar dataKey="income" name="Income" fill="var(--chart-income)" radius={[4, 4, 0, 0]} />
                  <Bar
                    dataKey="expenses"
                    name="Expenses"
                    fill="var(--chart-expense)"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>

        <section className="data-section border border-border bg-card p-5 flex flex-col">
          <div className="flex items-center justify-between gap-2 mb-4">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Top Categories</h2>
              <p className="text-xs text-muted-foreground">Expense share in period</p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate("budgets")}
              className="forecast-link text-xs font-semibold whitespace-nowrap shrink-0"
            >
              Budgets
            </button>
          </div>

          {breakdown.length === 0 ? (
            <div className="flex-1 grid place-items-center text-sm text-muted-foreground py-10">
              No expenses recorded for this period.
            </div>
          ) : (
            <div className="space-y-3.5 flex-1">
              {breakdown.map((item) => (
                <div key={item.category} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 text-foreground font-medium">
                      <span
                        className="category-dot"
                        style={{ backgroundColor: CATEGORY_COLORS[item.category] }}
                      />
                      <span>{item.category}</span>
                    </div>
                    <div className="text-muted-foreground tabular-nums">
                      <span className="font-semibold text-foreground">
                        {formatCurrency(item.total, currency)}
                      </span>{" "}
                      · {item.sharePct.toFixed(0)}%
                    </div>
                  </div>
                  <div className="budget-track h-1.5 w-full rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.min(100, item.sharePct)}%`,
                        backgroundColor: CATEGORY_COLORS[item.category],
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Recent Transactions Table */}
      <section className="data-section border border-border bg-card overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Recent Activity</h2>
            <p className="text-xs text-muted-foreground">Latest posted entries with ledger IDs</p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate("transactions")}
            className="forecast-link text-xs font-semibold whitespace-nowrap shrink-0"
          >
            Open full ledger
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="finance-table w-full text-left border-collapse">
            <thead>
              <tr>
                <th>ID</th>
                <th>Date</th>
                <th>Description</th>
                <th>Category</th>
                <th className="text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {recentTx.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center text-muted-foreground py-8">
                    No transactions recorded for this period.
                  </td>
                </tr>
              ) : (
                recentTx.map((tx) => (
                  <tr key={tx.id} className="hover:bg-muted/40 transition-colors">
                    <td className="font-mono text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                      {tx.id}
                    </td>
                    <td className="text-muted-foreground tabular-nums whitespace-nowrap">
                      {formatDisplayDate(tx.date, dateFormat)}
                    </td>
                    <td className="font-medium text-foreground">{tx.description}</td>
                    <td className="text-muted-foreground whitespace-nowrap">
                      <span className="inline-flex items-center gap-2">
                        <span
                          className="category-dot"
                          style={{ backgroundColor: CATEGORY_COLORS[tx.category] }}
                        />
                        <span>{tx.category}</span>
                      </span>
                    </td>
                    <td
                      className={`text-right font-medium tabular-nums whitespace-nowrap ${
                        tx.type === "income" ? "amount-positive" : "text-foreground"
                      }`}
                    >
                      {tx.type === "income" ? "+" : "-"}
                      {formatCurrency(tx.amount, currency)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
