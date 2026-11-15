import React, { useState } from "react";
import { Plus, Pencil, Trash2, X, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Budget, BudgetCategory, Transaction } from "../types/finance";
import { CATEGORY_COLORS, EXPENSE_CATEGORIES } from "../lib/seedData";
import {
  calculateBudgetStatuses,
  formatCurrency,
  formatMonthLabel,
} from "../lib/finance";

interface BudgetsViewProps {
  transactions: Transaction[];
  budgets: Budget[];
  selectedMonth: string;
  currency: string;
  onSaveBudget: (category: BudgetCategory, monthlyLimit: number, existingId?: string) => void;
  onDeleteBudget: (id: string) => void;
}

export const BudgetsView: React.FC<BudgetsViewProps> = ({
  transactions,
  budgets,
  selectedMonth,
  currency,
  onSaveBudget,
  onDeleteBudget,
}) => {
  const effectiveMonth = selectedMonth === "all" ? "2026-11" : selectedMonth;
  const statuses = calculateBudgetStatuses(transactions, budgets, effectiveMonth);

  const categoryOnlyBudgets = statuses.filter((s) => s.category !== "ALL");
  const totalBudgeted = categoryOnlyBudgets.reduce((acc, s) => acc + s.monthlyLimit, 0);
  const totalSpent = categoryOnlyBudgets.reduce((acc, s) => acc + s.spent, 0);
  const overallPct = totalBudgeted > 0 ? (totalSpent / totalBudgeted) * 100 : 0;

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | undefined>(undefined);
  const [formCategory, setFormCategory] = useState<BudgetCategory>("Food");
  const [formLimit, setFormLimit] = useState("");

  const openAdd = () => {
    const unused = (["ALL", ...EXPENSE_CATEGORIES] as BudgetCategory[]).find(
      (c) => !budgets.some((b) => b.category === c),
    );
    setEditingId(undefined);
    setFormCategory(unused ?? "Other");
    setFormLimit("5000");
    setIsDialogOpen(true);
  };

  const openEdit = (b: { id: string; category: BudgetCategory; monthlyLimit: number }) => {
    setEditingId(b.id);
    setFormCategory(b.category);
    setFormLimit(b.monthlyLimit.toString());
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const limit = Number(formLimit);
    if (!Number.isFinite(limit) || limit <= 0) return;
    onSaveBudget(formCategory, Number(limit.toFixed(2)), editingId);
    setIsDialogOpen(false);
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground">
            Monthly Budgets
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Spending limits for {formatMonthLabel(effectiveMonth)} ·{" "}
            <span className="tabular-nums">
              {formatCurrency(totalSpent, currency)} of {formatCurrency(totalBudgeted, currency)}{" "}
              category limits used ({overallPct.toFixed(0)}%)
            </span>
          </p>
        </div>

        <button
          type="button"
          onClick={openAdd}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-xs font-medium text-primary-foreground hover:opacity-95 whitespace-nowrap shrink-0"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>Set Budget</span>
        </button>
      </header>

      {statuses.length === 0 ? (
        <div className="budget-card border border-border bg-card p-10 text-center space-y-3">
          <p className="text-sm text-muted-foreground">No monthly budgets configured yet.</p>
          <button
            type="button"
            onClick={openAdd}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-xs font-medium text-primary-foreground"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Create First Budget</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {statuses.map((b) => {
            const fillWidth = Math.min(100, b.utilizationPct);
            const stateClass =
              b.state === "exceeded" ? "exceeded" : b.state === "warning" ? "warning" : "";
            const statusText =
              b.state === "exceeded"
                ? `Exceeded by ${formatCurrency(Math.abs(b.remaining), currency)}`
                : b.state === "warning"
                  ? `Approaching limit · ${formatCurrency(b.remaining, currency)} left`
                  : `On track · ${formatCurrency(b.remaining, currency)} left`;

            const displayTitle = b.category === "ALL" ? "Overall Monthly Limit" : b.category;
            const dotColor =
              b.category === "ALL" ? "var(--primary)" : CATEGORY_COLORS[b.category];

            return (
              <div key={b.id} className="budget-card border border-border bg-card p-5 space-y-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="category-dot" style={{ backgroundColor: dotColor }} />
                      <h2 className="text-base font-semibold text-foreground">{displayTitle}</h2>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 tabular-nums">
                      Spent{" "}
                      <strong className="text-foreground">
                        {formatCurrency(b.spent, currency)}
                      </strong>{" "}
                      of {formatCurrency(b.monthlyLimit, currency)}
                    </p>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => openEdit(b)}
                      aria-label={`Edit ${displayTitle} budget`}
                      className="icon-button"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteBudget(b.id)}
                      aria-label={`Delete ${displayTitle} budget`}
                      className="icon-button destructive-icon"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <div className="budget-track h-2 w-full rounded-full overflow-hidden">
                  <div
                    className={`budget-fill h-full rounded-full ${stateClass}`}
                    style={{ width: `${fillWidth}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span
                    className={`inline-flex items-center gap-1.5 font-medium ${
                      b.state === "exceeded"
                        ? "text-destructive"
                        : b.state === "warning"
                          ? "text-warning"
                          : "text-success"
                    }`}
                  >
                    {b.state === "on_track" ? (
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    ) : (
                      <AlertTriangle className="h-3.5 w-3.5" />
                    )}
                    <span>{statusText}</span>
                  </span>
                  <span className="font-mono text-muted-foreground tabular-nums">
                    {b.utilizationPct.toFixed(1)}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {isDialogOpen && (
        <div
          className="dialog-backdrop fixed inset-0 z-50 grid place-items-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="budget-dialog-title"
        >
          <div className="transaction-dialog w-full max-w-md border border-border bg-card p-6 shadow-xl">
            <div className="flex items-center justify-between gap-3 mb-5">
              <h2 id="budget-dialog-title" className="text-xl font-semibold text-foreground">
                {editingId ? "Edit Monthly Budget" : "New Monthly Budget"}
              </h2>
              <button
                type="button"
                onClick={() => setIsDialogOpen(false)}
                aria-label="Close dialog"
                className="icon-button"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="bdg-category"
                  className="block text-xs font-medium text-muted-foreground mb-1.5"
                >
                  Scope or Expense Category
                </label>
                <select
                  id="bdg-category"
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value as BudgetCategory)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="ALL">Overall Monthly Spending (ALL)</option>
                  {EXPENSE_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="bdg-limit"
                  className="block text-xs font-medium text-muted-foreground mb-1.5"
                >
                  Monthly Limit ({currency})
                </label>
                <input
                  id="bdg-limit"
                  type="number"
                  step="1"
                  min="1"
                  required
                  value={formLimit}
                  onChange={(e) => setFormLimit(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono tabular-nums text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsDialogOpen(false)}
                  className="rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-95"
                >
                  Save Budget
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
