import React, { useMemo, useRef, useState } from "react";
import {
  Search,
  Plus,
  Pencil,
  Trash2,
  Download,
  Upload,
  Sparkles,
  X,
  Calendar,
} from "lucide-react";
import { CategoryName, Transaction, TransactionType } from "../types/finance";
import {
  ALL_CATEGORIES,
  CATEGORY_COLORS,
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
} from "../lib/seedData";
import { filterTransactionsByMonth, formatCurrency } from "../lib/finance";
import { predictExpense } from "../lib/tfidfClassifier";
import {
  exportTransactionsAsCsv,
  formatDisplayDate,
  parseCsvTransactions,
  parseJsonBackup,
  type DateFormatOption,
} from "../lib/workspace-settings";

interface TransactionsViewProps {
  transactions: Transaction[];
  selectedMonth: string;
  currency: string;
  dateFormat: DateFormatOption;
  onAddTransaction: (tx: Omit<Transaction, "id">) => void;
  onUpdateTransaction: (tx: Transaction) => void;
  onDeleteTransaction: (id: string) => void;
  onImportTransactions: (txs: Transaction[]) => void;
  externalDialogOpen?: boolean;
  onCloseExternalDialog?: () => void;
}

export const TransactionsView: React.FC<TransactionsViewProps> = ({
  transactions,
  selectedMonth,
  currency,
  dateFormat,
  onAddTransaction,
  onUpdateTransaction,
  onDeleteTransaction,
  onImportTransactions,
  externalDialogOpen,
  onCloseExternalDialog,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | TransactionType>("all");
  const [categoryFilter, setCategoryFilter] = useState<"all" | CategoryName>("all");
  const [dateFilter, setDateFilter] = useState<"all" | "7d" | "30d" | "specific" | "range">("all");
  const [specificDate, setSpecificDate] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [importFeedback, setImportFeedback] = useState<string | null>(null);

  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Form state
  const [formType, setFormType] = useState<TransactionType>("expense");
  const [formDate, setFormDate] = useState("2026-11-14");
  const [formDescription, setFormDescription] = useState("");
  const [formCategory, setFormCategory] = useState<CategoryName>("Food");
  const [formAmount, setFormAmount] = useState("");
  const [formNote, setFormNote] = useState("");
  const [predicting, setPredicting] = useState(false);
  const [predictionHint, setPredictionHint] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const effectiveDialogOpen = isDialogOpen || Boolean(externalDialogOpen);

  // Real-time local TF-IDF preview while typing expense description
  const liveTfidfPreview = useMemo(() => {
    if (formType !== "expense" || !formDescription.trim()) return null;
    return predictExpense(formDescription);
  }, [formDescription, formType]);

  const openCreateDialog = () => {
    setEditingTx(null);
    setFormType("expense");
    setFormDate("2026-11-14");
    setFormDescription("");
    setFormCategory("Food");
    setFormAmount("");
    setFormNote("");
    setPredictionHint(null);
    setIsDialogOpen(true);
  };

  const openEditDialog = (tx: Transaction) => {
    setEditingTx(tx);
    setFormType(tx.type);
    setFormDate(tx.date);
    setFormDescription(tx.description);
    setFormCategory(tx.category);
    setFormAmount(tx.amount.toString());
    setFormNote(tx.note ?? "");
    setPredictionHint(null);
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingTx(null);
    onCloseExternalDialog?.();
  };

  const handlePredictCategory = async () => {
    if (!formDescription.trim()) return;
    setPredicting(true);
    setPredictionHint(null);
    try {
      const res = await fetch("/api/predict-category", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: formDescription.trim(),
          type: formType,
          amount: Number(formAmount) || undefined,
        }),
      });
      const data = (await res.json()) as {
        category?: CategoryName;
        confidence?: number;
        reasoning?: string;
      };
      if (data.category) {
        setFormCategory(data.category);
        const confPct = data.confidence ? `${Math.round(data.confidence * 100)}%` : "";
        setPredictionHint(
          `AI predicted ${data.category}${confPct ? ` (${confPct})` : ""}: ${data.reasoning ?? ""}`,
        );
      }
    } catch {
      if (liveTfidfPreview && liveTfidfPreview.knownWords > 0) {
        setFormCategory(liveTfidfPreview.category);
        setPredictionHint(
          `Applied local TF-IDF prediction: ${liveTfidfPreview.category} (${Math.round(liveTfidfPreview.confidence * 100)}%).`,
        );
      } else {
        setPredictionHint("Could not run prediction right now.");
      }
    } finally {
      setPredicting(false);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = Number(formAmount);
    if (!formDescription.trim() || !Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      return;
    }

    if (editingTx) {
      onUpdateTransaction({
        ...editingTx,
        type: formType,
        date: formDate,
        description: formDescription.trim(),
        category: formCategory,
        amount: Number(parsedAmount.toFixed(2)),
        note: formNote.trim() || undefined,
      });
    } else {
      onAddTransaction({
        type: formType,
        date: formDate,
        description: formDescription.trim(),
        category: formCategory,
        amount: Number(parsedAmount.toFixed(2)),
        note: formNote.trim() || undefined,
      });
    }
    closeDialog();
  };

  const filtered = useMemo(() => {
    const monthScoped = filterTransactionsByMonth(transactions, selectedMonth);
    const latestInScope = monthScoped.reduce(
      (max, t) => (t.date > max ? t.date : max),
      "",
    );
    const anchorStr = latestInScope || new Date().toISOString().slice(0, 10);
    const shiftDate = (iso: string, days: number) => {
      const [y, m, d] = iso.split("-").map(Number);
      const dt = new Date(Date.UTC(y, (m || 1) - 1, d || 1));
      dt.setUTCDate(dt.getUTCDate() + days);
      return dt.toISOString().slice(0, 10);
    };
    const min7d = shiftDate(anchorStr, -6);
    const min30d = shiftDate(anchorStr, -29);

    return monthScoped
      .filter((tx) => {
        if (typeFilter !== "all" && tx.type !== typeFilter) return false;
        if (categoryFilter !== "all" && tx.category !== categoryFilter) return false;

        if (dateFilter === "7d" && (tx.date < min7d || tx.date > anchorStr)) return false;
        if (dateFilter === "30d" && (tx.date < min30d || tx.date > anchorStr)) return false;
        if (dateFilter === "specific" && specificDate && tx.date !== specificDate) return false;
        if (dateFilter === "range") {
          if (dateFrom && tx.date < dateFrom) return false;
          if (dateTo && tx.date > dateTo) return false;
        }

        if (searchQuery.trim()) {
          const q = searchQuery.trim().toLowerCase();
          const match =
            tx.description.toLowerCase().includes(q) ||
            tx.category.toLowerCase().includes(q) ||
            tx.id.toLowerCase().includes(q) ||
            (tx.note && tx.note.toLowerCase().includes(q));
          if (!match) return false;
        }
        return true;
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [
    transactions,
    selectedMonth,
    typeFilter,
    categoryFilter,
    dateFilter,
    specificDate,
    dateFrom,
    dateTo,
    searchQuery,
  ]);

  const handleExportCsv = () => {
    exportTransactionsAsCsv(filtered);
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = file.name.endsWith(".json")
        ? parseJsonBackup(text).transactions
        : parseCsvTransactions(text);
      if (parsed.length === 0) {
        setImportFeedback("No valid transactions found in that file.");
      } else {
        onImportTransactions(parsed);
        setImportFeedback(`Imported ${parsed.length} transactions into the active account ledger.`);
      }
    } catch {
      setImportFeedback("Could not parse the uploaded CSV or JSON file.");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const hasActiveFilters =
    Boolean(searchQuery.trim()) ||
    typeFilter !== "all" ||
    categoryFilter !== "all" ||
    dateFilter !== "all";

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground">
            Transactions Ledger
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Searchable transaction records, live TF-IDF classifier, and CSV/JSON import
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.json"
            onChange={handleImportFile}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3.5 py-2 text-xs font-medium text-foreground hover:bg-muted transition-colors whitespace-nowrap shrink-0"
          >
            <Upload className="h-3.5 w-3.5" />
            <span>Import CSV / JSON</span>
          </button>
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3.5 py-2 text-xs font-medium text-foreground hover:bg-muted transition-colors whitespace-nowrap shrink-0"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export CSV</span>
          </button>
          <button
            type="button"
            onClick={openCreateDialog}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-xs font-medium text-primary-foreground hover:opacity-95 transition-opacity whitespace-nowrap shrink-0"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add Transaction</span>
          </button>
        </div>
      </header>

      {importFeedback && (
        <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-secondary px-4 py-2.5 text-xs text-secondary-foreground">
          <span>{importFeedback}</span>
          <button
            type="button"
            onClick={() => setImportFeedback(null)}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Dismiss message"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="data-section border border-border bg-card p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search merchant, note, or category..."
              className="w-full rounded-md border border-input bg-background pl-9 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div className="relative inline-flex items-center">
            <Calendar className="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <select
              aria-label="Filter by date"
              value={dateFilter}
              onChange={(e) =>
                setDateFilter(
                  e.target.value as "all" | "7d" | "30d" | "specific" | "range",
                )
              }
              className="rounded-md border border-input bg-background pl-9 pr-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="all">All dates</option>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="specific">Specific date</option>
              <option value="range">Date range</option>
            </select>
          </div>

          <select
            aria-label="Filter by category"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as "all" | CategoryName)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="all">All categories</option>
            {ALL_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <div className="segmented-control inline-flex items-center gap-1 rounded-lg bg-muted p-1 shrink-0">
            {(["all", "expense", "income"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTypeFilter(t)}
                className={`px-3 py-1 text-xs font-medium whitespace-nowrap ${
                  typeFilter === t ? "selected" : ""
                }`}
              >
                {t === "all" ? "All" : t === "expense" ? "Expenses" : "Income"}
              </button>
            ))}
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
                setTypeFilter("all");
                setCategoryFilter("all");
                setDateFilter("all");
                setSpecificDate("");
                setDateFrom("");
                setDateTo("");
              }}
              className="text-xs font-medium text-primary hover:underline whitespace-nowrap"
            >
              Reset
            </button>
          )}
        </div>

        {dateFilter === "specific" && (
          <div className="flex flex-wrap items-center gap-3 pt-1 border-t border-border/60">
            <label htmlFor="tx-filter-date" className="text-xs font-medium text-muted-foreground">
              Select date
            </label>
            <input
              id="tx-filter-date"
              type="date"
              value={specificDate}
              onChange={(e) => setSpecificDate(e.target.value)}
              className="rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        )}

        {dateFilter === "range" && (
          <div className="flex flex-wrap items-center gap-3 pt-1 border-t border-border/60">
            <label htmlFor="tx-filter-from" className="text-xs font-medium text-muted-foreground">
              From
            </label>
            <input
              id="tx-filter-from"
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <label htmlFor="tx-filter-to" className="text-xs font-medium text-muted-foreground">
              To
            </label>
            <input
              id="tx-filter-to"
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        )}
      </div>

      {/* Ledger Table */}
      <div className="data-section border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="finance-table w-full text-left border-collapse">
            <thead>
              <tr>
                <th>Transaction ID</th>
                <th>Date</th>
                <th>Description</th>
                <th>Category</th>
                <th>Type</th>
                <th className="text-right">Amount</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-muted-foreground">
                    No transactions match the current filters.
                  </td>
                </tr>
              ) : (
                filtered.map((tx) => (
                  <tr key={tx.id} className="hover:bg-muted/40 transition-colors">
                    <td className="font-mono text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                      {tx.id}
                    </td>
                    <td className="text-muted-foreground tabular-nums whitespace-nowrap">
                      {formatDisplayDate(tx.date, dateFormat)}
                    </td>
                    <td>
                      <div className="font-medium text-foreground">{tx.description}</div>
                      {tx.note && (
                        <div className="text-xs text-muted-foreground truncate max-w-xs">
                          {tx.note}
                        </div>
                      )}
                    </td>
                    <td className="whitespace-nowrap">
                      <span className="inline-flex items-center gap-2 text-foreground">
                        <span
                          className="category-dot"
                          style={{ backgroundColor: CATEGORY_COLORS[tx.category] }}
                        />
                        <span>{tx.category}</span>
                      </span>
                    </td>
                    <td className="text-xs text-muted-foreground capitalize whitespace-nowrap">
                      {tx.type}
                    </td>
                    <td
                      className={`text-right font-medium tabular-nums whitespace-nowrap ${
                        tx.type === "income" ? "amount-positive" : "text-foreground"
                      }`}
                    >
                      {tx.type === "income" ? "+" : "-"}
                      {formatCurrency(tx.amount, currency)}
                    </td>
                    <td className="text-right whitespace-nowrap">
                      <div className="inline-flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => openEditDialog(tx)}
                          aria-label={`Edit ${tx.id}`}
                          className="icon-button"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteTransaction(tx.id)}
                          aria-label={`Delete ${tx.id}`}
                          className="icon-button destructive-icon"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Dialog */}
      {effectiveDialogOpen && (
        <div
          className="dialog-backdrop fixed inset-0 z-50 grid place-items-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="tx-dialog-title"
        >
          <div className="transaction-dialog w-full max-w-lg border border-border bg-card p-6 shadow-xl">
            <div className="flex items-center justify-between gap-3 mb-5">
              <h2 id="tx-dialog-title" className="text-xl font-semibold text-foreground">
                {editingTx ? `Edit ${editingTx.id}` : "Log Transaction"}
              </h2>
              <button
                type="button"
                onClick={closeDialog}
                aria-label="Close dialog"
                className="icon-button"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div className="segmented-control grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
                <button
                  type="button"
                  onClick={() => {
                    setFormType("expense");
                    if (!EXPENSE_CATEGORIES.includes(formCategory)) {
                      setFormCategory("Food");
                    }
                  }}
                  className={formType === "expense" ? "selected font-medium" : ""}
                >
                  Expense
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFormType("income");
                    if (!INCOME_CATEGORIES.includes(formCategory)) {
                      setFormCategory("Salary");
                    }
                  }}
                  className={formType === "income" ? "selected font-medium" : ""}
                >
                  Income
                </button>
              </div>

              <div>
                <label
                  htmlFor="tx-desc"
                  className="block text-xs font-medium text-muted-foreground mb-1.5"
                >
                  Merchant or Description
                </label>
                <div className="flex gap-2">
                  <input
                    id="tx-desc"
                    type="text"
                    required
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    placeholder="e.g., Swiggy Dinner 450 or Uber ride"
                    className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <button
                    type="button"
                    onClick={handlePredictCategory}
                    disabled={predicting || !formDescription.trim()}
                    className="inline-flex items-center gap-1.5 rounded-md border border-border bg-secondary px-3 py-2 text-xs font-medium text-secondary-foreground hover:opacity-90 disabled:opacity-50 whitespace-nowrap shrink-0"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>{predicting ? "Predicting..." : "Ask Gemini"}</span>
                  </button>
                </div>

                {liveTfidfPreview && liveTfidfPreview.knownWords > 0 && (
                  <div className="mt-1.5 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span>
                      Local TF-IDF suggestion:{" "}
                      <strong className="text-foreground">{liveTfidfPreview.category}</strong> (
                      {(liveTfidfPreview.confidence * 100).toFixed(0)}%)
                    </span>
                    {formCategory !== liveTfidfPreview.category && (
                      <button
                        type="button"
                        onClick={() => setFormCategory(liveTfidfPreview.category)}
                        className="text-primary font-medium hover:underline"
                      >
                        Apply {liveTfidfPreview.category}
                      </button>
                    )}
                  </div>
                )}

                {predictionHint && (
                  <p className="text-xs text-primary mt-1.5">{predictionHint}</p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="tx-category"
                    className="block text-xs font-medium text-muted-foreground mb-1.5"
                  >
                    Category
                  </label>
                  <select
                    id="tx-category"
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value as CategoryName)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    {(formType === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="tx-amount"
                    className="block text-xs font-medium text-muted-foreground mb-1.5"
                  >
                    Amount ({currency})
                  </label>
                  <input
                    id="tx-amount"
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={formAmount}
                    onChange={(e) => setFormAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono tabular-nums text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="tx-date"
                    className="block text-xs font-medium text-muted-foreground mb-1.5"
                  >
                    Date
                  </label>
                  <input
                    id="tx-date"
                    type="date"
                    required
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <div>
                  <label
                    htmlFor="tx-note"
                    className="block text-xs font-medium text-muted-foreground mb-1.5"
                  >
                    Note (optional)
                  </label>
                  <input
                    id="tx-note"
                    type="text"
                    value={formNote}
                    onChange={(e) => setFormNote(e.target.value)}
                    placeholder="Optional memo"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeDialog}
                  className="rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-95"
                >
                  {editingTx ? "Save Changes" : "Save Entry"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
