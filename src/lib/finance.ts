import type { Budget, BudgetCategory, CategoryName, Transaction } from "../types/finance";

export interface MonthMetrics {
  income: number;
  expenses: number;
  balance: number;
  savingsRate: number;
  transactionCount: number;
  incomeDeltaPct: number | null;
  expenseDeltaPct: number | null;
}

export interface MonthlySeriesPoint {
  month: string;
  label: string;
  income: number;
  expenses: number;
  net: number;
}

export interface CategoryBreakdownItem {
  category: CategoryName;
  total: number;
  sharePct: number;
}

export interface BudgetStatus {
  id: string;
  category: BudgetCategory;
  monthlyLimit: number;
  spent: number;
  remaining: number;
  utilizationPct: number;
  state: "on_track" | "warning" | "exceeded";
}

export interface ForecastSeriesPoint {
  month: string;
  label: string;
  isForecast: boolean;
  actualExpenses: number | null;
  actualIncome: number | null;
  projectedExpenses: number;
  projectedIncome: number;
}

export interface ForecastCandidateMetrics {
  model: "ols" | "poly2" | "moving_avg" | "weighted_ma";
  label: string;
  mae: number;
  rmse: number;
  r2: number | null;
}

export interface ForecastSummary {
  series: ForecastSeriesPoint[];
  nextMonthProjectedIncome: number;
  nextMonthProjectedExpense: number;
  nextMonthProjectedNet: number;
  slopePerMonth: number;
  rmse: number;
  selectedModel: ForecastCandidateMetrics["model"];
  selectedModelLabel: string;
  candidates: ForecastCandidateMetrics[];
}

export interface DeterministicInsight {
  id: string;
  kind: "increase" | "decrease" | "savings" | "budget_warning" | "budget_exceeded" | "neutral";
  title: string;
  detail: string;
  metricLabel: string;
}

const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export function formatMonthLabel(monthKey: string): string {
  const [yStr, mStr] = monthKey.split("-");
  const y = Number(yStr);
  const m = Number(mStr);
  if (!y || !m || m < 1 || m > 12) return monthKey;
  return `${MONTH_NAMES[m - 1]} ${y}`;
}

function addMonths(monthKey: string, delta: number): string {
  const [yStr, mStr] = monthKey.split("-");
  const y = Number(yStr) || 2026;
  const m = (Number(mStr) || 1) - 1;
  const dt = new Date(Date.UTC(y, m + delta, 1));
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  return `${yy}-${mm}`;
}

export function getAvailableMonths(transactions: Transaction[]): string[] {
  const set = new Set<string>();
  for (const tx of transactions) {
    if (tx.date && tx.date.length >= 7) {
      set.add(tx.date.slice(0, 7));
    }
  }
  return Array.from(set).sort((a, b) => b.localeCompare(a));
}

export function filterTransactionsByMonth(
  transactions: Transaction[],
  selectedMonth: string,
): Transaction[] {
  if (!selectedMonth || selectedMonth === "all") return transactions;
  return transactions.filter((tx) => tx.date.startsWith(selectedMonth));
}

export function formatCurrency(amount: number, currency = "₹", compact = false): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  const sign = safe < 0 ? "-" : "";
  const abs = Math.abs(safe);

  if (compact) {
    if (abs >= 1_000_000) {
      return `${sign}${currency}${(abs / 1_000_000).toFixed(1)}M`;
    }
    if (abs >= 1_000) {
      return `${sign}${currency}${(abs / 1_000).toFixed(1)}k`;
    }
    return `${sign}${currency}${Math.round(abs)}`;
  }

  const formatted = new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: abs % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(abs);
  return `${sign}${currency}${formatted}`;
}

export function calculateMonthMetrics(
  transactions: Transaction[],
  selectedMonth: string,
): MonthMetrics {
  const scoped = filterTransactionsByMonth(transactions, selectedMonth);
  let income = 0;
  let expenses = 0;
  for (const tx of scoped) {
    if (tx.type === "income") income += tx.amount;
    else expenses += tx.amount;
  }

  const balance = income - expenses;
  const savingsRate = income > 0 ? (balance / income) * 100 : 0;

  let incomeDeltaPct: number | null = null;
  let expenseDeltaPct: number | null = null;

  if (selectedMonth !== "all") {
    const prevMonth = addMonths(selectedMonth, -1);
    const prevTx = filterTransactionsByMonth(transactions, prevMonth);
    if (prevTx.length > 0) {
      let prevIncome = 0;
      let prevExpense = 0;
      for (const tx of prevTx) {
        if (tx.type === "income") prevIncome += tx.amount;
        else prevExpense += tx.amount;
      }
      if (prevIncome > 0) incomeDeltaPct = ((income - prevIncome) / prevIncome) * 100;
      if (prevExpense > 0) expenseDeltaPct = ((expenses - prevExpense) / prevExpense) * 100;
    }
  }

  return {
    income,
    expenses,
    balance,
    savingsRate,
    transactionCount: scoped.length,
    incomeDeltaPct,
    expenseDeltaPct,
  };
}

export function calculateMonthlySeries(transactions: Transaction[]): MonthlySeriesPoint[] {
  const map = new Map<string, { income: number; expenses: number }>();
  for (const tx of transactions) {
    const m = tx.date.slice(0, 7);
    if (!m) continue;
    const entry = map.get(m) ?? { income: 0, expenses: 0 };
    if (tx.type === "income") entry.income += tx.amount;
    else entry.expenses += tx.amount;
    map.set(m, entry);
  }

  return Array.from(map.keys())
    .sort((a, b) => a.localeCompare(b))
    .map((month) => {
      const entry = map.get(month)!;
      return {
        month,
        label: formatMonthLabel(month),
        income: Number(entry.income.toFixed(2)),
        expenses: Number(entry.expenses.toFixed(2)),
        net: Number((entry.income - entry.expenses).toFixed(2)),
      };
    });
}

export function calculateCategoryBreakdown(
  transactions: Transaction[],
  selectedMonth: string,
  type: "expense" | "income" = "expense",
): CategoryBreakdownItem[] {
  const scoped = filterTransactionsByMonth(transactions, selectedMonth).filter(
    (t) => t.type === type,
  );
  const map = new Map<CategoryName, number>();
  let totalAll = 0;
  for (const tx of scoped) {
    map.set(tx.category, (map.get(tx.category) ?? 0) + tx.amount);
    totalAll += tx.amount;
  }

  return Array.from(map.entries())
    .map(([category, total]) => ({
      category,
      total: Number(total.toFixed(2)),
      sharePct: totalAll > 0 ? (total / totalAll) * 100 : 0,
    }))
    .sort((a, b) => b.total - a.total);
}

export function calculateBudgetStatuses(
  transactions: Transaction[],
  budgets: Budget[],
  monthKey: string,
): BudgetStatus[] {
  const expenses = filterTransactionsByMonth(transactions, monthKey).filter(
    (t) => t.type === "expense",
  );
  const totalSpent = expenses.reduce((acc, t) => acc + t.amount, 0);

  return budgets.map((b) => {
    const spent =
      b.category === "ALL"
        ? totalSpent
        : expenses
            .filter((t) => t.category === b.category)
            .reduce((acc, t) => acc + t.amount, 0);
    const remaining = b.monthlyLimit - spent;
    const utilizationPct = b.monthlyLimit > 0 ? (spent / b.monthlyLimit) * 100 : 0;
    const state: BudgetStatus["state"] =
      utilizationPct >= 100 ? "exceeded" : utilizationPct >= 80 ? "warning" : "on_track";

    return {
      id: b.id,
      category: b.category,
      monthlyLimit: b.monthlyLimit,
      spent: Number(spent.toFixed(2)),
      remaining: Number(remaining.toFixed(2)),
      utilizationPct,
      state,
    };
  });
}

function fitLinearOLS(values: number[]): { slope: number; intercept: number } {
  const n = values.length;
  if (n === 0) return { slope: 0, intercept: 0 };
  if (n === 1) return { slope: 0, intercept: values[0] };

  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += values[i];
    sumXY += i * values[i];
    sumXX += i * i;
  }
  const denom = n * sumXX - sumX * sumX;
  const slope = denom !== 0 ? (n * sumXY - sumX * sumY) / denom : 0;
  const intercept = (sumY - slope * sumX) / n;
  return { slope, intercept };
}

function predictPoly2(history: number[], targetIdx: number): number {
  const n = history.length;
  if (n < 3) {
    const { slope, intercept } = fitLinearOLS(history);
    return Math.max(0, slope * targetIdx + intercept);
  }
  // Normal equations for y = a*x^2 + b*x + c (3x3 Gaussian elimination)
  let s0 = n,
    s1 = 0,
    s2 = 0,
    s3 = 0,
    s4 = 0;
  let sy = 0,
    sxy = 0,
    sx2y = 0;
  for (let i = 0; i < n; i++) {
    const x2 = i * i;
    s1 += i;
    s2 += x2;
    s3 += x2 * i;
    s4 += x2 * x2;
    sy += history[i];
    sxy += i * history[i];
    sx2y += x2 * history[i];
  }
  const A = [
    [s4, s3, s2, sx2y],
    [s3, s2, s1, sxy],
    [s2, s1, s0, sy],
  ];
  for (let col = 0; col < 3; col++) {
    let pivot = col;
    for (let r = col + 1; r < 3; r++) {
      if (Math.abs(A[r][col]) > Math.abs(A[pivot][col])) pivot = r;
    }
    [A[col], A[pivot]] = [A[pivot], A[col]];
    const div = A[col][col];
    if (Math.abs(div) < 1e-9) {
      const { slope, intercept } = fitLinearOLS(history);
      return Math.max(0, slope * targetIdx + intercept);
    }
    for (let j = col; j < 4; j++) A[col][j] /= div;
    for (let r = 0; r < 3; r++) {
      if (r === col) continue;
      const factor = A[r][col];
      for (let j = col; j < 4; j++) A[r][j] -= factor * A[col][j];
    }
  }
  const a = A[0][3];
  const b = A[1][3];
  const c = A[2][3];
  return Math.max(0, a * targetIdx * targetIdx + b * targetIdx + c);
}

function predictMovingAvg(history: number[], windowSize = 3): number {
  const slice = history.slice(-windowSize);
  if (slice.length === 0) return 0;
  return slice.reduce((acc, v) => acc + v, 0) / slice.length;
}

function predictWeightedMA(history: number[]): number {
  if (history.length === 0) return 0;
  let num = 0;
  let den = 0;
  for (let i = 0; i < history.length; i++) {
    const w = i + 1;
    num += w * history[i];
    den += w;
  }
  return den > 0 ? num / den : 0;
}

function computeErrors(actuals: number[], preds: number[]): {
  mae: number;
  rmse: number;
  r2: number | null;
} {
  const n = actuals.length;
  if (n === 0) return { mae: 0, rmse: 0, r2: null };
  let sumAbs = 0;
  let sumSq = 0;
  for (let i = 0; i < n; i++) {
    const err = actuals[i] - preds[i];
    sumAbs += Math.abs(err);
    sumSq += err * err;
  }
  const meanActual = actuals.reduce((a, b) => a + b, 0) / n;
  const ssTot = actuals.reduce((acc, v) => acc + (v - meanActual) ** 2, 0);
  const r2 = n >= 2 && ssTot > 1e-6 ? 1 - sumSq / ssTot : null;
  return {
    mae: sumAbs / n,
    rmse: Math.sqrt(sumSq / n),
    r2,
  };
}

export function calculateForecastSeries(
  transactions: Transaction[],
  horizonMonths = 3,
): ForecastSummary {
  const monthly = calculateMonthlySeries(transactions);
  const expenses = monthly.map((m) => m.expenses);
  const incomes = monthly.map((m) => m.income);
  const incFit = fitLinearOLS(incomes);
  const expFit = fitLinearOLS(expenses);

  const candidateDefs: Array<{
    model: ForecastCandidateMetrics["model"];
    label: string;
    predictNext: (hist: number[], idx: number) => number;
  }> = [
    {
      model: "ols",
      label: "Linear Regression (OLS)",
      predictNext: (hist, idx) => {
        const fit = fitLinearOLS(hist);
        return Math.max(0, fit.slope * idx + fit.intercept);
      },
    },
    {
      model: "poly2",
      label: "Polynomial Trend (Deg 2)",
      predictNext: (hist, idx) => predictPoly2(hist, idx),
    },
    {
      model: "moving_avg",
      label: "3-Month Moving Avg",
      predictNext: (hist) => predictMovingAvg(hist, 3),
    },
    {
      model: "weighted_ma",
      label: "Weighted Moving Avg",
      predictNext: (hist) => predictWeightedMA(hist),
    },
  ];

  let candidates: ForecastCandidateMetrics[] = [];
  if (monthly.length >= 3) {
    candidates = candidateDefs
      .map((def) => {
        const actuals: number[] = [];
        const preds: number[] = [];
        for (let t = 2; t < expenses.length; t++) {
          const train = expenses.slice(0, t);
          actuals.push(expenses[t]);
          preds.push(def.predictNext(train, t));
        }
        const metrics = computeErrors(actuals, preds);
        return {
          model: def.model,
          label: def.label,
          mae: Number(metrics.mae.toFixed(2)),
          rmse: Number(metrics.rmse.toFixed(2)),
          r2: metrics.r2 !== null ? Number(metrics.r2.toFixed(2)) : null,
        };
      })
      .sort((a, b) => a.rmse - b.rmse);
  }

  const bestCandidate = candidates[0] ?? {
    model: "ols" as const,
    label: "Linear Regression (OLS)",
    mae: 0,
    rmse: 0,
    r2: null,
  };
  const bestDef = candidateDefs.find((d) => d.model === bestCandidate.model) ?? candidateDefs[0];

  const series: ForecastSeriesPoint[] = monthly.map((m, i) => ({
    month: m.month,
    label: m.label,
    isForecast: false,
    actualExpenses: m.expenses,
    actualIncome: m.income,
    projectedExpenses: Math.max(0, Number((expFit.slope * i + expFit.intercept).toFixed(2))),
    projectedIncome: Math.max(0, Number((incFit.slope * i + incFit.intercept).toFixed(2))),
  }));

  const lastMonth = monthly[monthly.length - 1]?.month ?? "2026-11";
  const runningExpenseHist = [...expenses];

  for (let h = 1; h <= horizonMonths; h++) {
    const idx = monthly.length - 1 + h;
    const futureMonth = addMonths(lastMonth, h);
    const predExp = Math.max(
      0,
      Number(bestDef.predictNext(runningExpenseHist, idx).toFixed(2)),
    );
    runningExpenseHist.push(predExp);
    const predInc = Math.max(
      0,
      Number((incFit.slope * idx + incFit.intercept).toFixed(2)),
    );

    series.push({
      month: futureMonth,
      label: formatMonthLabel(futureMonth),
      isForecast: true,
      actualExpenses: null,
      actualIncome: null,
      projectedExpenses: predExp,
      projectedIncome: predInc,
    });
  }

  const firstForecast = series.find((p) => p.isForecast);
  const nextMonthProjectedIncome = firstForecast?.projectedIncome ?? 0;
  const nextMonthProjectedExpense = firstForecast?.projectedExpenses ?? 0;

  return {
    series,
    nextMonthProjectedIncome,
    nextMonthProjectedExpense,
    nextMonthProjectedNet: Number((nextMonthProjectedIncome - nextMonthProjectedExpense).toFixed(2)),
    slopePerMonth: Number(expFit.slope.toFixed(2)),
    rmse: bestCandidate.rmse,
    selectedModel: bestCandidate.model,
    selectedModelLabel: bestCandidate.label,
    candidates,
  };
}

export function generateDeterministicInsights(
  transactions: Transaction[],
  budgets: Budget[],
  monthKey: string,
  currency = "₹",
): DeterministicInsight[] {
  const insights: DeterministicInsight[] = [];
  const metrics = calculateMonthMetrics(transactions, monthKey);
  const breakdown = calculateCategoryBreakdown(transactions, monthKey, "expense");
  const statuses = calculateBudgetStatuses(transactions, budgets, monthKey);

  if (metrics.transactionCount === 0) return insights;

  if (metrics.expenseDeltaPct !== null) {
    const isUp = metrics.expenseDeltaPct > 0;
    insights.push({
      id: "ins-mom-expense",
      kind: isUp ? "increase" : "decrease",
      title: isUp ? "Monthly Spending Increased" : "Monthly Spending Reduced",
      detail: isUp
        ? `Expenses in ${formatMonthLabel(monthKey)} are ${Math.abs(metrics.expenseDeltaPct).toFixed(1)}% higher than the previous month.`
        : `Expenses in ${formatMonthLabel(monthKey)} dropped by ${Math.abs(metrics.expenseDeltaPct).toFixed(1)}% compared to the previous month.`,
      metricLabel: `${metrics.expenseDeltaPct >= 0 ? "+" : ""}${metrics.expenseDeltaPct.toFixed(1)}%`,
    });
  }

  if (breakdown.length > 0) {
    const top = breakdown[0];
    insights.push({
      id: "ins-top-category",
      kind: "neutral",
      title: `Largest Driver: ${top.category}`,
      detail: `${top.category} represents ${top.sharePct.toFixed(1)}% of total expenses this month (${formatCurrency(top.total, currency)}).`,
      metricLabel: formatCurrency(top.total, currency),
    });
  }

  insights.push({
    id: "ins-savings-rate",
    kind: metrics.savingsRate >= 20 ? "savings" : "budget_warning",
    title: metrics.savingsRate >= 20 ? "Healthy Savings Cushion" : "Savings Rate Below 20% Benchmark",
    detail:
      metrics.income > 0
        ? `You retained ${formatCurrency(metrics.balance, currency)} (${metrics.savingsRate.toFixed(1)}% of income) in ${formatMonthLabel(monthKey)}.`
        : "No income entries recorded for this month yet.",
    metricLabel: `${metrics.savingsRate.toFixed(1)}%`,
  });

  for (const status of statuses) {
    if (status.state === "exceeded") {
      insights.push({
        id: `ins-bdg-${status.id}`,
        kind: "budget_exceeded",
        title: `${status.category === "ALL" ? "Overall" : status.category} Budget Exceeded`,
        detail: `Spent ${formatCurrency(status.spent, currency)} against a ${formatCurrency(status.monthlyLimit, currency)} monthly limit.`,
        metricLabel: `${status.utilizationPct.toFixed(0)}%`,
      });
    } else if (status.state === "warning") {
      insights.push({
        id: `ins-bdg-${status.id}`,
        kind: "budget_warning",
        title: `${status.category === "ALL" ? "Overall" : status.category} Budget Near Limit`,
        detail: `${formatCurrency(status.remaining, currency)} remaining out of ${formatCurrency(status.monthlyLimit, currency)}.`,
        metricLabel: `${status.utilizationPct.toFixed(0)}%`,
      });
    }
  }

  return insights.slice(0, 6);
}

export function buildFinanceContextSummary(
  accountName: string,
  accountEmail: string,
  transactions: Transaction[],
  budgets: Budget[],
  selectedMonth: string,
  currency: string,
): string {
  const effectiveMonth = selectedMonth === "all" ? "2026-11" : selectedMonth;
  const metrics = calculateMonthMetrics(transactions, selectedMonth);
  const breakdown = calculateCategoryBreakdown(transactions, selectedMonth, "expense");
  const budgetStatuses = calculateBudgetStatuses(transactions, budgets, effectiveMonth);
  const forecast = calculateForecastSeries(transactions, 3);
  const scopedTx = filterTransactionsByMonth(transactions, selectedMonth)
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 30);

  const lines: string[] = [
    `Account Holder: ${accountName} (${accountEmail})`,
    `Active Reporting Period: ${selectedMonth === "all" ? "All Recorded Months" : formatMonthLabel(selectedMonth)} (${selectedMonth})`,
    `Currency Symbol: ${currency}`,
    "",
    "== Period Summary ==",
    `- Total Income: ${formatCurrency(metrics.income, currency)}`,
    `- Total Expenses: ${formatCurrency(metrics.expenses, currency)}`,
    `- Net Balance / Surplus: ${formatCurrency(metrics.balance, currency)}`,
    `- Savings Rate: ${metrics.savingsRate.toFixed(1)}%`,
    `- Scoped Transactions Count: ${metrics.transactionCount}`,
    metrics.expenseDeltaPct !== null
      ? `- Expense MoM Delta: ${metrics.expenseDeltaPct >= 0 ? "+" : ""}${metrics.expenseDeltaPct.toFixed(1)}%`
      : "- Expense MoM Delta: N/A",
    "",
    "== Expense Category Breakdown ==",
    ...(breakdown.length > 0
      ? breakdown.map(
          (b) => `- ${b.category}: ${formatCurrency(b.total, currency)} (${b.sharePct.toFixed(1)}%)`,
        )
      : ["- No expenses in selected scope"]),
    "",
    `== Budget Status (${formatMonthLabel(effectiveMonth)}) ==`,
    ...(budgetStatuses.length > 0
      ? budgetStatuses.map(
          (b) =>
            `- ${b.category}: spent ${formatCurrency(b.spent, currency)} / limit ${formatCurrency(b.monthlyLimit, currency)} (${b.utilizationPct.toFixed(1)}%, ${b.state})`,
        )
      : ["- No budgets configured"]),
    "",
    "== 3-Month Forecast (Deterministic Walk-Forward) ==",
    `- Selected Model: ${forecast.selectedModelLabel} (RMSE: ${formatCurrency(forecast.rmse, currency)})`,
    `- Projected Next Month Income: ${formatCurrency(forecast.nextMonthProjectedIncome, currency)}`,
    `- Projected Next Month Expenses: ${formatCurrency(forecast.nextMonthProjectedExpense, currency)}`,
    `- Projected Next Month Net: ${formatCurrency(forecast.nextMonthProjectedNet, currency)}`,
    "",
    "== Recent Scoped Transactions (Most Recent 30) ==",
    ...(scopedTx.length > 0
      ? scopedTx.map(
          (t) =>
            `- ${t.id} | ${t.date} | ${t.type.toUpperCase()} | ${t.category} | ${t.description} | ${formatCurrency(t.amount, currency)}${t.note ? ` | Note: ${t.note}` : ""}`,
        )
      : ["- No transactions in selected scope"]),
  ];

  return lines.join("\n");
}
