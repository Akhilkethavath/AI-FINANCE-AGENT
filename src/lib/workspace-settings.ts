import type {
  Budget,
  BudgetCategory,
  CategoryName,
  Transaction,
  TransactionType,
} from "../types/finance";
import { ALL_CATEGORIES } from "./seedData";

export type DateFormatOption = "YYYY-MM-DD" | "DD/MM/YYYY" | "MM/DD/YYYY";

export interface WorkspaceSettings {
  currency: string;
  theme: "light" | "dark" | "system";
  dateFormat: DateFormatOption;
  voiceLang: string;
  autoSpeak: boolean;
  voiceRate: number;
}

const SETTINGS_STORAGE_KEY = "moneymind_v2:settings";

const DEFAULT_SETTINGS: WorkspaceSettings = {
  currency: "₹",
  theme: "system",
  dateFormat: "YYYY-MM-DD",
  voiceLang: "auto",
  autoSpeak: false,
  voiceRate: 1.0,
};

export const CURRENCY_OPTIONS = [
  { code: "INR", symbol: "₹", label: "₹ INR (Indian Rupee)" },
  { code: "USD", symbol: "$", label: "$ USD (US Dollar)" },
  { code: "EUR", symbol: "€", label: "€ EUR (Euro)" },
  { code: "GBP", symbol: "£", label: "£ GBP (British Pound)" },
  { code: "JPY", symbol: "¥", label: "¥ JPY (Japanese Yen)" },
  { code: "AED", symbol: "AED ", label: "AED (UAE Dirham)" },
];

export const VOICE_LANG_OPTIONS = [
  { code: "auto", label: "Auto (Browser Default)" },
  { code: "en-IN", label: "English (India)" },
  { code: "en-US", label: "English (United States)" },
  { code: "en-GB", label: "English (United Kingdom)" },
  { code: "hi-IN", label: "Hindi (India)" },
];

export function getWorkspaceSettings(): WorkspaceSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<WorkspaceSettings>) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveWorkspaceSettings(settings: WorkspaceSettings): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // ignore storage errors
  }
}

export function applyTheme(theme: WorkspaceSettings["theme"]): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const prefersDark =
    typeof window !== "undefined" &&
    Boolean(window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);
  const useDark = theme === "dark" || (theme === "system" && prefersDark);
  root.classList.toggle("dark", useDark);
}

export function formatDisplayDate(isoDate: string, format: DateFormatOption): string {
  const parts = isoDate.split("-");
  if (parts.length !== 3) return isoDate;
  const [y, m, d] = parts;
  if (format === "DD/MM/YYYY") return `${d}/${m}/${y}`;
  if (format === "MM/DD/YYYY") return `${m}/${d}/${y}`;
  return isoDate;
}

function triggerDownload(filename: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportDataAsJson(
  transactions: Transaction[],
  budgets: Budget[],
  accountName: string,
): void {
  const payload = {
    app: "MoneyMind AI",
    exportedAt: new Date().toISOString(),
    accountName,
    transactions,
    budgets,
  };
  triggerDownload(
    `moneymind-backup-${new Date().toISOString().slice(0, 10)}.json`,
    JSON.stringify(payload, null, 2),
    "application/json",
  );
}

function escapeCsvCell(value: string | number | undefined): string {
  const str = String(value ?? "");
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function exportTransactionsAsCsv(transactions: Transaction[]): void {
  const header = ["id", "date", "type", "category", "description", "amount", "note"].join(",");
  const rows = transactions.map((t) =>
    [
      escapeCsvCell(t.id),
      escapeCsvCell(t.date),
      escapeCsvCell(t.type),
      escapeCsvCell(t.category),
      escapeCsvCell(t.description),
      escapeCsvCell(t.amount.toFixed(2)),
      escapeCsvCell(t.note ?? ""),
    ].join(","),
  );
  triggerDownload(
    `moneymind-transactions-${new Date().toISOString().slice(0, 10)}.csv`,
    [header, ...rows].join("\n"),
    "text/csv;charset=utf-8",
  );
}

function normalizeCategory(raw: string | undefined, type: TransactionType): CategoryName {
  const cleaned = (raw ?? "").trim().toLowerCase();
  const matched = ALL_CATEGORIES.find((c) => c.toLowerCase() === cleaned);
  if (matched) return matched;
  return type === "income" ? "Salary" : "Other";
}

export function parseJsonBackup(content: string): {
  transactions: Transaction[];
  budgets: Budget[];
} {
  const parsed = JSON.parse(content) as {
    transactions?: unknown[];
    budgets?: unknown[];
  };
  const rawTx = Array.isArray(parsed.transactions) ? parsed.transactions : [];
  const rawBudgets = Array.isArray(parsed.budgets) ? parsed.budgets : [];

  const transactions: Transaction[] = rawTx
    .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
    .map((item, idx) => {
      const type: TransactionType = item.type === "income" ? "income" : "expense";
      const amount = Math.abs(Number(item.amount) || 0);
      return {
        id: typeof item.id === "string" && item.id.trim() ? item.id.trim() : `TXN-IMP-${Date.now()}-${idx}`,
        type,
        date:
          typeof item.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(item.date.trim())
            ? item.date.trim()
            : new Date().toISOString().slice(0, 10),
        description:
          typeof item.description === "string" && item.description.trim()
            ? item.description.trim()
            : "Imported entry",
        category: normalizeCategory(typeof item.category === "string" ? item.category : undefined, type),
        amount,
        note: typeof item.note === "string" && item.note.trim() ? item.note.trim() : undefined,
      };
    })
    .filter((t) => t.amount > 0);

  const budgets: Budget[] = rawBudgets
    .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
    .map((item, idx) => {
      const limit = Math.abs(Number(item.monthlyLimit) || 0);
      const rawCat = typeof item.category === "string" ? item.category.trim() : "Other";
      const category: BudgetCategory =
        rawCat.toUpperCase() === "ALL" ? "ALL" : normalizeCategory(rawCat, "expense");
      return {
        id: typeof item.id === "string" && item.id.trim() ? item.id.trim() : `BDG-IMP-${idx + 1}`,
        category,
        monthlyLimit: limit,
      };
    })
    .filter((b) => b.monthlyLimit > 0);

  return { transactions, budgets };
}

function splitCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

export function parseCsvTransactions(content: string): Transaction[] {
  const lines = content
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];

  const headers = splitCsvLine(lines[0]).map((h) => h.toLowerCase().replace(/[^a-z0-9]/g, ""));
  const idxId = headers.findIndex((h) => h === "id" || h === "transactionid");
  const idxDate = headers.findIndex((h) => h.includes("date"));
  const idxType = headers.findIndex((h) => h === "type");
  const idxCat = headers.findIndex((h) => h.includes("category"));
  const idxDesc = headers.findIndex((h) => h.includes("desc") || h.includes("merchant") || h.includes("title"));
  const idxAmt = headers.findIndex((h) => h.includes("amount") || h.includes("value"));
  const idxNote = headers.findIndex((h) => h.includes("note") || h.includes("memo"));

  if (idxDesc === -1 || idxAmt === -1) return [];

  const txs: Transaction[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i]);
    const rawAmount = Number((cols[idxAmt] ?? "").replace(/[^0-9.-]/g, ""));
    if (!Number.isFinite(rawAmount) || rawAmount === 0) continue;

    const rawType = (idxType >= 0 ? cols[idxType] : "").toLowerCase();
    const type: TransactionType =
      rawType === "income" || rawType === "credit"
        ? "income"
        : rawType === "expense" || rawType === "debit"
          ? "expense"
          : rawAmount > 0 && idxType === -1
            ? "expense"
            : rawAmount < 0
              ? "expense"
              : "expense";

    const rawDate = idxDate >= 0 ? cols[idxDate] ?? "" : "";
    const normalizedDate = /^\d{4}-\d{2}-\d{2}$/.test(rawDate)
      ? rawDate
      : new Date().toISOString().slice(0, 10);

    const desc = (cols[idxDesc] ?? "").trim();
    if (!desc) continue;

    txs.push({
      id: idxId >= 0 && cols[idxId] ? cols[idxId] : `TXN-CSV-${Date.now()}-${i}`,
      type,
      date: normalizedDate,
      description: desc,
      category: normalizeCategory(idxCat >= 0 ? cols[idxCat] : undefined, type),
      amount: Math.abs(rawAmount),
      note: idxNote >= 0 && cols[idxNote] ? cols[idxNote] : undefined,
    });
  }
  return txs;
}
