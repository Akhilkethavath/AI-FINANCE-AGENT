import { useServerFn } from "@tanstack/react-start";
import { askPersonalFinance } from "@/lib/personal-finance.functions";
import { personalFinanceReply } from "@/lib/personal-finance";
import { signupPasswordError } from "@/lib/auth-validation";
import { registerLocalUser, verifyLocalUser } from "@/lib/local-auth";
import { buildGoogleSession, getStoredGoogleAccounts, storeGoogleAccount, type GoogleAccount } from "@/lib/google-accounts";
import { speakText, startRecording, toSpokenText, transcribeRecording, type Recording } from "@/lib/voice-client";
import { Conversation, ConversationContent, ConversationScrollButton } from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import { PromptInput, PromptInputTextarea, PromptInputFooter, PromptInputSubmit } from "@/components/ai-elements/prompt-input";
import { createFileRoute } from "@tanstack/react-router";
import { createContext, useContext, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { lovable } from "@/integrations/lovable/index";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CATEGORIES,
  amountForMonth,
  budgetStatus,
  categorySpend,
  cleanDescription,
  currentMonth,
  formatAmount,
  forecastByCategory,
  forecastSpending,
  generateInsights,
  monthKey,
  monthStart,
  predictExpense,
  resolveCategory,
  shiftMonth,
  validateTransactionDraft,
  type FinanceBudget,
  type FinanceTransaction,
  type TransactionType,
  type SpendingForecast,
} from "@/lib/finance";
import {
  getWorkspaceSettings,
  saveWorkspaceSettings,
  applyTheme,
  type WorkspaceSettings,
} from "@/lib/workspace-settings";
import { SettingsView } from "@/components/settings-view";
import {
  Activity,
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Bot,
  CalendarDays,
  Check,
  ChevronDown,
  CircleHelp,
  CreditCard,
  Filter,
  Landmark,
  Mic,
  Square,
  Volume2,
  VolumeX,
  LoaderCircle,
  LogOut,
  MessageCircle,
  Pencil,
  Plus,
  Receipt,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Target,
  Trash2,
  TrendingDown,
  TrendingUp,
  Wallet,
  X,
} from "lucide-react";
import {
  Bar,
  BarChart,
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type View = "overview" | "transactions" | "budgets" | "insights" | "modelLab" | "assistant" | "settings";
type TransactionDraft = {
  transaction_date: string;
  description: string;
  amount: string;
  transaction_type: TransactionType;
  category: string;
};

export const CurrencyContext = createContext<string>("₹");
export const useCurrency = () => useContext(CurrencyContext);
export const CURRENCY = "₹";

const DEFAULT_DEMO_TRANSACTIONS: FinanceTransaction[] = [
  { id: "tx-demo-1", transaction_date: "2026-11-01", description: "Monthly Salary", amount: 65000, transaction_type: "income", category: "Income" },
  { id: "tx-demo-2", transaction_date: "2026-11-03", description: "Supermarket Groceries", amount: 4850, transaction_type: "expense", category: "Food" },
  { id: "tx-demo-3", transaction_date: "2026-11-05", description: "Electricity & Water Bill", amount: 2200, transaction_type: "expense", category: "Bills" },
  { id: "tx-demo-4", transaction_date: "2026-11-07", description: "Swiggy Dinner 450", amount: 450, transaction_type: "expense", category: "Food" },
  { id: "tx-demo-5", transaction_date: "2026-11-09", description: "Uber ride 300", amount: 300, transaction_type: "expense", category: "Transport" },
  { id: "tx-demo-6", transaction_date: "2026-11-11", description: "Movie & Entertainment", amount: 950, transaction_type: "expense", category: "Entertainment" },
  { id: "tx-demo-7", transaction_date: "2026-11-13", description: "Pharmacy Medicines", amount: 820, transaction_type: "expense", category: "Health" },
  { id: "tx-demo-8", transaction_date: "2026-10-01", description: "Monthly Salary", amount: 65000, transaction_type: "income", category: "Income" },
  { id: "tx-demo-9", transaction_date: "2026-10-04", description: "Grocery Store", amount: 5200, transaction_type: "expense", category: "Food" },
  { id: "tx-demo-10", transaction_date: "2026-10-10", description: "Metro Pass Recharge", amount: 1800, transaction_type: "expense", category: "Transport" },
  { id: "tx-demo-11", transaction_date: "2026-10-15", description: "Home Internet & Mobile", amount: 1650, transaction_type: "expense", category: "Bills" },
  { id: "tx-demo-12", transaction_date: "2026-10-22", description: "Clothing Shopping", amount: 3500, transaction_type: "expense", category: "Shopping" },
  { id: "tx-demo-13", transaction_date: "2026-09-01", description: "Monthly Salary", amount: 65000, transaction_type: "income", category: "Income" },
  { id: "tx-demo-14", transaction_date: "2026-09-05", description: "Groceries", amount: 4900, transaction_type: "expense", category: "Food" },
  { id: "tx-demo-15", transaction_date: "2026-09-12", description: "Fuel & Taxi", amount: 2100, transaction_type: "expense", category: "Transport" },
  { id: "tx-demo-16", transaction_date: "2026-09-18", description: "Electricity Bill", amount: 1950, transaction_type: "expense", category: "Bills" },
  { id: "tx-demo-17", transaction_date: "2026-08-01", description: "Monthly Salary", amount: 65000, transaction_type: "income", category: "Income" },
  { id: "tx-demo-18", transaction_date: "2026-08-06", description: "Supermarket", amount: 4700, transaction_type: "expense", category: "Food" },
  { id: "tx-demo-19", transaction_date: "2026-08-14", description: "Transport Pass", amount: 1600, transaction_type: "expense", category: "Transport" },
  { id: "tx-demo-20", transaction_date: "2026-08-20", description: "Utility Bills", amount: 1800, transaction_type: "expense", category: "Bills" },
];

const DEFAULT_DEMO_BUDGETS: FinanceBudget[] = [
  { id: "b-demo-1", month_start: "2026-11-01", category: "ALL", limit_amount: 25000 },
  { id: "b-demo-2", month_start: "2026-11-01", category: "Food", limit_amount: 8000 },
  { id: "b-demo-3", month_start: "2026-11-01", category: "Transport", limit_amount: 3000 },
];

function isLocalUser(id?: string): boolean {
  return Boolean(id && (id.startsWith("user-") || id.startsWith("local-") || id.startsWith("google-") || id === "demo-user"));
}

function getStoredTransactions(userId: string): FinanceTransaction[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(`ai_finance_tx_${userId}`);
    if (raw !== null) {
      const parsed = JSON.parse(raw) as FinanceTransaction[];
      if (userId !== "demo-user") {
        const userOnly = parsed.filter((t) => !t.id.startsWith("tx-demo-"));
        if (userOnly.length !== parsed.length) {
          saveStoredTransactions(userId, userOnly);
          return userOnly;
        }
      }
      return parsed;
    }
  } catch {}

  // Only the dedicated demo user gets sample pre-populated records
  if (userId === "demo-user") {
    saveStoredTransactions(userId, DEFAULT_DEMO_TRANSACTIONS);
    return DEFAULT_DEMO_TRANSACTIONS;
  }

  // All other new users start with their own clean slate (0 records)
  saveStoredTransactions(userId, []);
  return [];
}

function saveStoredTransactions(userId: string, txs: FinanceTransaction[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(`ai_finance_tx_${userId}`, JSON.stringify(txs));
  } catch {}
}

function getStoredBudgets(userId: string): FinanceBudget[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(`ai_finance_budgets_${userId}`);
    if (raw !== null) {
      const parsed = JSON.parse(raw) as FinanceBudget[];
      if (userId !== "demo-user") {
        const userOnly = parsed.filter((b) => !b.id.startsWith("b-demo-"));
        if (userOnly.length !== parsed.length) {
          saveStoredBudgets(userId, userOnly);
          return userOnly;
        }
      }
      return parsed;
    }
  } catch {}

  if (userId === "demo-user") {
    saveStoredBudgets(userId, DEFAULT_DEMO_BUDGETS);
    return DEFAULT_DEMO_BUDGETS;
  }

  saveStoredBudgets(userId, []);
  return [];
}

function saveStoredBudgets(userId: string, budgets: FinanceBudget[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(`ai_finance_budgets_${userId}`, JSON.stringify(budgets));
  } catch {}
}

const emptyDraft = (): TransactionDraft => ({
  transaction_date: new Date().toISOString().slice(0, 10),
  description: "",
  amount: "",
  transaction_type: "expense",
  category: "",
});

export const Route = createFileRoute("/")({
  component: FinanceApp,
  head: () => ({
    meta: [
      { title: "MoneyMind AI — Personal Finance Overview" },
      { name: "description", content: "Track transactions, budgets, spending patterns, and educational machine-learning forecasts in a private finance workspace." },
      { property: "og:title", content: "MoneyMind AI — Personal Finance Overview" },
      { property: "og:description", content: "Understand spending, compare forecasting models, and explore how transaction text is processed." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function FinanceApp() {
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [googleChooserOpen, setGoogleChooserOpen] = useState(false);
  const [authName, setAuthName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [authMessage, setAuthMessage] = useState("");
  const [activeView, setActiveView] = useState<View>("overview");
  const [transactions, setTransactions] = useState<FinanceTransaction[]>([]);
  const [budgets, setBudgets] = useState<FinanceBudget[]>([]);
  const [month, setMonth] = useState(currentMonth());
  const [loading, setLoading] = useState(false);
  const [pageMessage, setPageMessage] = useState("");
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");
  const [draft, setDraft] = useState<TransactionDraft>(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [transactionOpen, setTransactionOpen] = useState(false);
  const [budgetCategory, setBudgetCategory] = useState("ALL");
  const [budgetLimit, setBudgetLimit] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [chatBusy, setChatBusy] = useState(false);
  const [chatError, setChatError] = useState("");
  const askFinance = useServerFn(askPersonalFinance);
  const chatGeneration = useRef(0);
  const recordingRef = useRef<Recording | null>(null);
  const recognitionRef = useRef<any>(null);
  const recognitionBufferRef = useRef<string>("");
  const speechAbort = useRef<AbortController | null>(null);
  const silenceTimerRef = useRef<any>(null);
  const speechDetectedRef = useRef<boolean>(false);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [speakAnswers, setSpeakAnswers] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [chatMessages, setChatMessages] = useState<{ role: "you" | "assistant"; text: string }[]>([]);
  const [settings, setSettings] = useState<WorkspaceSettings>(getWorkspaceSettings);

  useEffect(() => {
    applyTheme(settings.theme);
  }, [settings.theme]);

  function updateSettings(next: WorkspaceSettings) {
    setSettings(next);
    saveWorkspaceSettings(next);
    applyTheme(next.theme);
  }

  function handleUpdateProfileName(name: string) {
    if (!session) return;
    const updatedSession: Session = {
      ...session,
      user: {
        ...session.user,
        user_metadata: {
          ...session.user.user_metadata,
          full_name: name,
          name,
        },
      },
    };
    setSession(updatedSession);
    try {
      localStorage.setItem("ai_finance_user", JSON.stringify(updatedSession));
    } catch {}
  }

  function handleImportData(newTransactions: FinanceTransaction[], newBudgets: FinanceBudget[]) {
    if (!userId) return;
    if (newTransactions.length > 0) {
      const mergedTx = [...newTransactions, ...transactions];
      const uniqueTx = Array.from(new Map(mergedTx.map((t) => [t.id, t])).values());
      setTransactions(uniqueTx);
      saveStoredTransactions(userId, uniqueTx);
    }
    if (newBudgets.length > 0) {
      const mergedB = [...newBudgets, ...budgets];
      const uniqueB = Array.from(new Map(mergedB.map((b) => [`${b.month_start}-${b.category}`, b])).values());
      setBudgets(uniqueB);
      saveStoredBudgets(userId, uniqueB);
    }
  }

  function handleLoadDemoData() {
    if (!userId) return;
    setTransactions(DEFAULT_DEMO_TRANSACTIONS);
    saveStoredTransactions(userId, DEFAULT_DEMO_TRANSACTIONS);
    setBudgets(DEFAULT_DEMO_BUDGETS);
    saveStoredBudgets(userId, DEFAULT_DEMO_BUDGETS);
  }

  function handleClearTransactions() {
    if (!userId) return;
    setTransactions([]);
    saveStoredTransactions(userId, []);
  }

  function handleClearBudgets() {
    if (!userId) return;
    setBudgets([]);
    saveStoredBudgets(userId, []);
  }

  function handleResetAllData() {
    if (!userId) return;
    setTransactions([]);
    saveStoredTransactions(userId, []);
    setBudgets([]);
    saveStoredBudgets(userId, []);
  }

  useEffect(() => {
    let live = true;
    try {
      const stored = localStorage.getItem("ai_finance_user");
      if (stored) {
        setSession(JSON.parse(stored) as Session);
        setAuthReady(true);
      }
    } catch {}

    void supabase.auth.getSession().then(({ data }) => {
      if (live) {
        if (data.session) setSession(data.session);
        setAuthReady(true);
      }
    }).catch(() => {
      if (live) setAuthReady(true);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (nextSession) {
        setSession(nextSession);
      }
      setAuthReady(true);
    });

    return () => {
      live = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const userId = session?.user.id;

  useEffect(() => {
    setTransactions([]);
    setBudgets([]);
    if (!userId) {
      return;
    }
    let live = true;
    setLoading(true);
    setPageMessage("");

    const loadData = async () => {
      if (isLocalUser(userId)) {
        const txs = getStoredTransactions(userId);
        const bgs = getStoredBudgets(userId);
        if (live) {
          setTransactions(txs);
          setBudgets(bgs);
          setLoading(false);
        }
        return;
      }

      try {
        const budgetRequest = supabase.from("budgets").select("id, month_start, category, limit_amount").order("month_start", { ascending: false });
        const allTransactions: FinanceTransaction[] = [];
        for (let from = 0; ; from += 1000) {
          const transactionResult = await supabase
            .from("transactions")
            .select("id, transaction_date, description, amount, transaction_type, category")
            .order("transaction_date", { ascending: false })
            .order("created_at", { ascending: false })
            .range(from, from + 999);
          if (!live) return;
          if (transactionResult.error) throw transactionResult.error;
          const page = (transactionResult.data ?? []) as FinanceTransaction[];
          allTransactions.push(...page);
          if (page.length < 1000) break;
        }
        const budgetResult = await budgetRequest;
        if (!live) return;
        if (budgetResult.error) throw budgetResult.error;
        setTransactions(allTransactions);
        setBudgets((budgetResult.data ?? []) as FinanceBudget[]);
        setLoading(false);
      } catch (error) {
        if (live) {
          console.warn("Could not load from Supabase cloud; switching to local workspace storage.", error);
          const txs = getStoredTransactions(userId);
          const bgs = getStoredBudgets(userId);
          setTransactions(txs);
          setBudgets(bgs);
          setLoading(false);
        }
      }
    };
    void loadData();
    return () => { live = false; };
  }, [userId]);

  const selectedTransactions = useMemo(
    () => transactions.filter((transaction) => monthKey(transaction.transaction_date) === month),
    [transactions, month],
  );
  const income = amountForMonth(transactions, month, "income");
  const expenses = amountForMonth(transactions, month, "expense");
  const balance = transactions.reduce((sum, transaction) => sum + (transaction.transaction_type === "income" ? Number(transaction.amount) : -Number(transaction.amount)), 0);
  const monthlyBudgets = budgetStatus(budgets, transactions, month);
  const forecast = forecastSpending(transactions);
  const categoryForecast = forecastByCategory(transactions);
  const insights = generateInsights(transactions, budgets, month);

  const chartData = useMemo(() => {
    const history = Array.from({ length: 6 }, (_, index) => shiftMonth(month, index - 5));
    return history.map((historyMonth) => ({
      month: new Date(`${historyMonth}-01T00:00:00`).toLocaleDateString("en", { month: "short" }),
      income: amountForMonth(transactions, historyMonth, "income"),
      expenses: amountForMonth(transactions, historyMonth, "expense"),
    }));
  }, [transactions, month]);

  const visibleTransactions = useMemo(() => {
    const query = search.trim().toLowerCase();
    return transactions.filter((transaction) => {
      const matchesId = query.length > 0 && transaction.id.toLowerCase().includes(query);
      return (
      (!query || transaction.description.toLowerCase().includes(query) || matchesId) &&
      (filterType === "all" || transaction.transaction_type === filterType) &&
      (filterCategory === "all" || transaction.category === filterCategory) &&
      (monthKey(transaction.transaction_date) === month || matchesId)
      );
    });
  }, [transactions, search, filterType, filterCategory, month]);

  function handleSignOut() {
    try { localStorage.removeItem("ai_finance_user"); } catch {}
    setSession(null);
    void supabase.auth.signOut().catch(() => {});
  }

  async function submitAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthBusy(true);
    setAuthMessage("");

    if (authMode === "register") {
      const mismatch = signupPasswordError(password, confirmPassword);
      if (mismatch) {
        setAuthMessage(mismatch);
        setAuthBusy(false);
        return;
      }
      if (password.length < 8) {
        setAuthMessage("Password must be at least 8 characters long.");
        setAuthBusy(false);
        return;
      }

      try {
        await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: authName } },
        });
      } catch {}

      try {
        registerLocalUser(authName, email, password);
        // Do NOT go directly to home page; redirect to sign-in page so user signs in
        setAuthMode("login");
        setPassword("");
        setConfirmPassword("");
        setAuthMessage("Account created successfully! Please sign in with your password to continue.");
      } catch (err) {
        setAuthMessage(err instanceof Error ? err.message : "Could not create account.");
      } finally {
        setAuthBusy(false);
      }
    } else {
      // Login mode: Check if account exists first
      try {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        if (data.session) {
          setSession(data.session);
          setAuthBusy(false);
          return;
        }
      } catch {}

      try {
        const verified = verifyLocalUser(email, password);
        const localSession = {
          user: {
            id: verified.id,
            email: verified.email,
            user_metadata: { full_name: verified.name },
          },
        };
        try { localStorage.setItem("ai_finance_user", JSON.stringify(localSession)); } catch {}
        setSession(localSession as any);
      } catch (err) {
        setAuthMessage(err instanceof Error ? err.message : "Sign-in could not be completed.");
      } finally {
        setAuthBusy(false);
      }
    }
  }

  function handleSelectGoogleAccount(accountName: string, accountEmail: string) {
    const normalizedEmail = accountEmail.trim().toLowerCase();
    const normalizedName = accountName.trim() || normalizedEmail.split("@")[0];
    storeGoogleAccount({ name: normalizedName, email: normalizedEmail });

    const googleSession = buildGoogleSession(normalizedName, normalizedEmail);
    try { localStorage.setItem("ai_finance_user", JSON.stringify(googleSession)); } catch {}
    setSession(googleSession as any);
    setGoogleChooserOpen(false);
  }

  function socialSignIn(provider: "google") {
    setGoogleChooserOpen(true);
  }

  async function saveTransaction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!userId) return;
    setPageMessage("");
    const prediction = draft.transaction_type === "expense" ? predictExpense(draft.description) : null;
    const selectedCategory = resolveCategory(draft.category);
    const category = draft.transaction_type === "income" ? "Income" : (selectedCategory ?? prediction?.category ?? "Other");
    const values = {
      transaction_date: draft.transaction_date,
      description: draft.description.trim(),
      amount: Number(draft.amount),
      transaction_type: draft.transaction_type,
      category,
      updated_at: new Date().toISOString(),
    };
    const validation = validateTransactionDraft(values);
    if (!validation.valid) {
      setPageMessage(validation.message);
      return;
    }

    if (isLocalUser(userId)) {
      let updated: FinanceTransaction[];
      if (editingId) {
        const item: FinanceTransaction = { id: editingId, ...values };
        updated = transactions.map((t) => (t.id === editingId ? item : t));
      } else {
        const newId = "tx-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
        const item: FinanceTransaction = { id: newId, ...values };
        updated = [item, ...transactions].sort((a, b) => b.transaction_date.localeCompare(a.transaction_date));
      }
      setTransactions(updated);
      saveStoredTransactions(userId, updated);
      setDraft(emptyDraft());
      setEditingId(null);
      setTransactionOpen(false);
      return;
    }

    let savedId = editingId;
    try {
      if (editingId) {
        const { data, error } = await supabase.from("transactions").update(values).eq("id", editingId).select("id, transaction_date, description, amount, transaction_type, category").single();
        if (error) throw error;
        setTransactions((previous) => previous.map((transaction) => transaction.id === editingId ? data as FinanceTransaction : transaction));
      } else {
        const { data, error } = await supabase.from("transactions").insert({ ...values, user_id: userId }).select("id, transaction_date, description, amount, transaction_type, category").single();
        if (error) throw error;
        savedId = data.id;
        setTransactions((previous) => [data as FinanceTransaction, ...previous].sort((a, b) => b.transaction_date.localeCompare(a.transaction_date)));
      }
      if (!editingId && prediction && savedId) {
        await supabase.from("transaction_predictions").insert({
          transaction_id: savedId,
          user_id: userId,
          predicted_category: prediction.category,
          confidence: prediction.confidence,
        }).catch(() => {});
      }
      if (prediction && selectedCategory && selectedCategory !== prediction.category) {
        await supabase.from("category_corrections").insert({
          user_id: userId,
          description: draft.description.trim(),
          category: selectedCategory,
        }).catch(() => {});
      }
    } catch {
      let updated: FinanceTransaction[];
      if (editingId) {
        const item: FinanceTransaction = { id: editingId, ...values };
        updated = transactions.map((t) => (t.id === editingId ? item : t));
      } else {
        const newId = "tx-" + Date.now().toString(36);
        const item: FinanceTransaction = { id: newId, ...values };
        updated = [item, ...transactions].sort((a, b) => b.transaction_date.localeCompare(a.transaction_date));
      }
      setTransactions(updated);
      saveStoredTransactions(userId, updated);
    }
    setDraft(emptyDraft());
    setEditingId(null);
    setTransactionOpen(false);
  }

  async function removeTransaction(id: string) {
    const transaction = transactions.find((item) => item.id === id);
    if (transaction && !window.confirm(`Delete “${transaction.description}”? This cannot be undone.`)) return;
    if (isLocalUser(userId)) {
      const updated = transactions.filter((t) => t.id !== id);
      setTransactions(updated);
      if (userId) saveStoredTransactions(userId, updated);
      return;
    }
    try {
      const { error } = await supabase.from("transactions").delete().eq("id", id);
      if (error) throw error;
    } catch {}
    const updated = transactions.filter((transaction) => transaction.id !== id);
    setTransactions(updated);
    if (userId) saveStoredTransactions(userId, updated);
  }

  async function saveBudget(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!userId) return;
    const limit = Number(budgetLimit);
    if (!Number.isFinite(limit) || limit <= 0 || limit > 1_000_000_000) {
      setPageMessage("Enter a budget amount greater than zero.");
      return;
    }
    const monthVal = monthStart(month);
    const newBudget: FinanceBudget = {
      id: "b-" + Date.now().toString(36),
      month_start: monthVal,
      category: budgetCategory,
      limit_amount: limit,
    };
    if (isLocalUser(userId)) {
      const updated = [...budgets.filter((b) => b.month_start !== monthVal || b.category !== budgetCategory), newBudget];
      setBudgets(updated);
      saveStoredBudgets(userId, updated);
      setBudgetLimit("");
      return;
    }
    try {
      const { data, error } = await supabase.from("budgets").upsert({
        user_id: userId,
        month_start: monthVal,
        category: budgetCategory,
        limit_amount: limit,
      }, { onConflict: "user_id,month_start,category" }).select("id, month_start, category, limit_amount").single();
      if (error) throw error;
      if (data) {
        setBudgets((previous) => [...previous.filter((budget) => budget.month_start !== data.month_start || budget.category !== data.category), data as FinanceBudget]);
        setBudgetLimit("");
      }
    } catch {
      const updated = [...budgets.filter((b) => b.month_start !== monthVal || b.category !== budgetCategory), newBudget];
      setBudgets(updated);
      saveStoredBudgets(userId, updated);
      setBudgetLimit("");
    }
  }

  async function removeBudget(id: string) {
    if (isLocalUser(userId)) {
      const updated = budgets.filter((b) => b.id !== id);
      setBudgets(updated);
      if (userId) saveStoredBudgets(userId, updated);
      return;
    }
    try {
      const { error } = await supabase.from("budgets").delete().eq("id", id);
      if (error) throw error;
    } catch {}
    const updated = budgets.filter((budget) => budget.id !== id);
    setBudgets(updated);
    if (userId) saveStoredBudgets(userId, updated);
  }

  function editTransaction(transaction: FinanceTransaction) {
    setEditingId(transaction.id);
    setDraft({
      transaction_date: transaction.transaction_date,
      description: transaction.description,
      amount: String(transaction.amount),
      transaction_type: transaction.transaction_type,
      category: transaction.category === "Income" ? "" : transaction.category,
    });
    setTransactionOpen(true);
  }

  useEffect(() => {
    chatGeneration.current += 1;
    setChatMessages([]);
    setChatInput("");
    setChatError("");
    setChatBusy(false);
    clearTimeout(silenceTimerRef.current);
    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch {}
      recognitionRef.current = null;
    }
    recordingRef.current?.cancel();
    recordingRef.current = null;
    setRecording(false);
    setTranscribing(false);
    stopSpeaking();
  }, [userId, month]);

  useEffect(() => () => {
    clearTimeout(silenceTimerRef.current);
    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch {}
      recognitionRef.current = null;
    }
    recordingRef.current?.cancel();
    stopSpeaking();
  }, []);

  async function accessToken(): Promise<string | null> {
    try {
      const { data } = await supabase.auth.getSession();
      return data.session?.access_token ?? null;
    } catch {
      return null;
    }
  }

  function stopSpeaking() {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      try { window.speechSynthesis.cancel(); } catch {}
    }
    speechAbort.current?.abort();
    speechAbort.current = null;
    setSpeaking(false);
  }

  async function speakAnswer(text: string) {
    stopSpeaking();
    const cleanText = toSpokenText(text);
    if (!cleanText) return;

    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      try {
        const utterance = new SpeechSynthesisUtterance(cleanText);
        utterance.lang = settings.voiceLang && settings.voiceLang !== "auto" ? settings.voiceLang : "en-US";
        utterance.rate = settings.voiceRate || 1.0;
        utterance.pitch = 1.0;
        const voices = window.speechSynthesis.getVoices();
        const preferred = voices.find((v) => (v.lang.startsWith("en") || v.lang === "en_US") && (v.name.includes("Google") || v.name.includes("Natural") || v.name.includes("Microsoft"))) || voices.find((v) => v.lang.startsWith("en"));
        if (preferred) utterance.voice = preferred;

        utterance.onstart = () => setSpeaking(true);
        utterance.onend = () => setSpeaking(false);
        utterance.onerror = (e) => {
          if (e.error !== "canceled" && e.error !== "interrupted") {
            console.warn("Speech synthesis error", e);
          }
          setSpeaking(false);
        };
        setSpeaking(true);
        window.speechSynthesis.speak(utterance);
        return;
      } catch (err) {
        console.warn("speechSynthesis error", err);
      }
    }

    try {
      const token = await accessToken();
      if (!token) return;
      const controller = new AbortController();
      speechAbort.current = controller;
      setSpeaking(true);
      await speakText(cleanText, token, controller.signal);
    } catch {
      if (!speechAbort.current?.signal.aborted) {
        setChatError("The answer could not be read aloud.");
      }
    } finally {
      setSpeaking(false);
      speechAbort.current = null;
    }
  }

  async function stopVoiceInput(submit = true) {
    clearTimeout(silenceTimerRef.current);
    setRecording(false);

    // 1. If native SpeechRecognition is active
    if (recognitionRef.current) {
      const rec = recognitionRef.current;
      recognitionRef.current = null;
      try { rec.stop(); } catch {}
      const buffered = recognitionBufferRef.current.trim();
      recognitionBufferRef.current = "";
      if (submit && buffered) {
        setChatInput(buffered);
        await sendChat(buffered, true);
      }
      return;
    }

    // 2. If hardware recording is active
    if (recordingRef.current) {
      const active = recordingRef.current;
      recordingRef.current = null;
      const generation = chatGeneration.current;
      setTranscribing(true);
      try {
        const file = await active.stop();
        const token = (await accessToken()) || "local-token";
        const question = await transcribeRecording(file, token);
        if (generation !== chatGeneration.current) return;
        setTranscribing(false);
        if (question && question.trim()) {
          setChatInput(question.trim());
          if (submit) await sendChat(question.trim().slice(0, 500), true);
        } else if (submit && speechDetectedRef.current) {
          setChatError("We heard your voice! If you want to ask directly, pick a quick question below or type your question:");
        }
      } catch {
        if (generation === chatGeneration.current) {
          setChatError("We couldn't hear that clearly. Please try speaking again or type your question below:");
        }
      } finally {
        if (generation === chatGeneration.current) setTranscribing(false);
      }
    }
  }

  async function startFallbackRecording() {
    try {
      let silenceTimer: any = null;
      let heardSound = false;

      const rec = await startRecording((volume) => {
        if (volume > 0.02) {
          heardSound = true;
          speechDetectedRef.current = true;
          clearTimeout(silenceTimer);
          silenceTimer = setTimeout(() => {
            if (heardSound) {
              void stopVoiceInput(true);
            }
          }, 1800);
        }
      });

      recordingRef.current = rec;
      setRecording(true);
      setChatError("");
    } catch (err) {
      console.warn("Microphone access error:", err);
      recordingRef.current = null;
      setRecording(false);
      setChatError("Microphone access is needed to ask by voice. Please allow microphone permissions in your browser and try again.");
    }
  }

  async function toggleVoice() {
    if (transcribing || chatBusy) return;
    setChatError("");

    if (recording) {
      await stopVoiceInput(true);
      return;
    }

    stopSpeaking();
    setChatInput("");
    recognitionBufferRef.current = "";
    speechDetectedRef.current = false;
    clearTimeout(silenceTimerRef.current);

    const isOpera =
      typeof navigator !== "undefined" &&
      (navigator.userAgent.includes("OPR/") || navigator.userAgent.includes("Opera"));
    const isBrave =
      typeof navigator !== "undefined" &&
      (Boolean((navigator as any).brave) || navigator.userAgent.includes("Brave"));

    const SpeechRec =
      !isOpera &&
      !isBrave &&
      typeof window !== "undefined" &&
      ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

    if (SpeechRec) {
      try {
        const recognition = new SpeechRec();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang =
          settings.voiceLang && settings.voiceLang !== "auto"
            ? settings.voiceLang
            : (typeof navigator !== "undefined" ? navigator.language : "en-IN") || "en-IN";
        recognition.maxAlternatives = 1;

        recognition.onstart = () => {
          setRecording(true);
          setChatError("");
        };

        recognition.onresult = (event: any) => {
          let full = "";
          let isFinal = false;
          for (let i = 0; i < event.results.length; ++i) {
            full += event.results[i][0].transcript;
            if (event.results[i].isFinal) isFinal = true;
          }
          const spoken = full.trim();
          if (spoken) {
            speechDetectedRef.current = true;
            recognitionBufferRef.current = spoken;
            setChatInput(spoken);

            clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = setTimeout(() => {
              if (recognitionBufferRef.current.trim()) {
                void stopVoiceInput(true);
              }
            }, isFinal ? 1200 : 1800);
          }
        };

        recognition.onerror = (event: any) => {
          console.warn("Speech recognition event error:", event.error);
          if (event.error === "no-speech") {
            if (recognitionBufferRef.current.trim()) {
              void stopVoiceInput(true);
            }
            return;
          }
          if (event.error === "aborted") return;
          if (event.error === "not-allowed") {
            setChatError("Microphone access was denied. Please allow microphone permissions in your browser.");
            setRecording(false);
            recognitionRef.current = null;
            return;
          }
          if (event.error === "network" || event.error === "service-not-allowed") {
            if (recognitionBufferRef.current.trim()) {
              void stopVoiceInput(true);
              return;
            }
            try { recognition.abort(); } catch {}
            recognitionRef.current = null;
            void startFallbackRecording();
            return;
          }
        };

        recognition.onend = () => {
          if (recognitionBufferRef.current.trim()) {
            void stopVoiceInput(true);
          } else {
            setRecording(false);
            recognitionRef.current = null;
          }
        };

        recognitionRef.current = recognition;
        recognition.start();
        setRecording(true);
        return;
      } catch (err) {
        console.warn("SpeechRecognition init failed, using fallback:", err);
      }
    }

    await startFallbackRecording();
  }

  async function sendChat(spoken?: string, askedByVoice = false) {
    const message = (spoken ?? chatInput).trim();
    if (!message || chatBusy || !userId) return;
    const generation = chatGeneration.current;
    setChatBusy(true);
    setChatError("");
    setChatMessages((previous) => [...previous, { role: "you", text: message }]);
    setChatInput("");
    try {
      let replyText = "";
      if (isLocalUser(userId)) {
        const reply = personalFinanceReply(message, transactions, budgets, month);
        replyText = reply.text;
      } else {
        try {
          const reply = await askFinance({ data: { question: message, month } });
          replyText = reply.text;
        } catch {
          const reply = personalFinanceReply(message, transactions, budgets, month);
          replyText = reply.text;
        }
      }
      if (generation !== chatGeneration.current) return;
      setChatMessages((previous) => [...previous, { role: "assistant", text: replyText }]);
      if (speakAnswers || settings.autoSpeak || askedByVoice) void speakAnswer(replyText);
    } catch (error) {
      if (generation === chatGeneration.current) setChatError(error instanceof Error ? error.message : "Could not check your financial records. Please try again.");
    } finally {
      if (generation === chatGeneration.current) setChatBusy(false);
    }
  }

  if (!authReady) return <div className="grid min-h-screen place-items-center"><LoaderCircle className="size-6 animate-spin text-primary" /></div>;
  if (!session) return (
    <>
      <AuthScreen mode={authMode} setMode={(m) => { setAuthMode(m); setAuthMessage(""); }} name={authName} setName={setAuthName} email={email} setEmail={setEmail} password={password} setPassword={setPassword} confirmPassword={confirmPassword} setConfirmPassword={setConfirmPassword} busy={authBusy} message={authMessage} onSubmit={submitAuth} onSocial={socialSignIn} />
      <GoogleAccountChooser open={googleChooserOpen} onClose={() => setGoogleChooserOpen(false)} onSelect={handleSelectGoogleAccount} />
    </>
  );

  return (
    <CurrencyContext.Provider value={settings.currency}>
      <div className="finance-app min-h-screen bg-background text-foreground">
        <div className="app-frame flex min-h-screen">
          <aside className="side-rail hidden w-64 shrink-0 flex-col border-r border-border bg-card lg:flex">
          <div className="flex h-20 items-center gap-3 px-7">
            <div className="brand-mark grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground"><Landmark className="size-5" /></div>
            <div><p className="font-display text-lg font-semibold leading-tight">MoneyMind AI</p><p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">personal finance</p></div>
          </div>
          <div className="px-5 pt-6">
            <p className="nav-caption px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Workspace</p>
            <nav aria-label="Main navigation" className="space-y-1">
              <NavItem view="overview" active={activeView} onSelect={setActiveView} icon={<BarChart3 />} label="Overview" />
              <NavItem view="transactions" active={activeView} onSelect={setActiveView} icon={<Receipt />} label="Transactions" />
              <NavItem view="budgets" active={activeView} onSelect={setActiveView} icon={<Target />} label="Budgets" />
              <NavItem view="insights" active={activeView} onSelect={setActiveView} icon={<Sparkles />} label="Insights" />
              <NavItem view="modelLab" active={activeView} onSelect={setActiveView} icon={<Activity />} label="Model lab" />
              <NavItem view="assistant" active={activeView} onSelect={setActiveView} icon={<MessageCircle />} label="Finance assistant" />
              <NavItem view="settings" active={activeView} onSelect={setActiveView} icon={<Settings className="size-4" />} label="Settings" />
            </nav>
          </div>
          <div className="mt-auto px-5 pb-5">
            <div className="security-note flex gap-3 border-t border-border px-3 py-5 text-xs text-muted-foreground"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" /><p>Your account data is private and protected.</p></div>
            <div className="flex items-center gap-3 border-t border-border px-3 pt-4">
              <div className="avatar-chip grid size-9 shrink-0 place-items-center rounded-full bg-secondary text-sm font-semibold text-secondary-foreground">{(session.user.email ?? "A").slice(0, 1).toUpperCase()}</div>
      <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{session.user.user_metadata?.["full_name"] ?? session.user.email ?? "Your account"}</p><p className="text-xs text-muted-foreground">Personal account</p></div>
              <Button variant="ghost" size="icon" className="icon-button" type="button" title="Settings" aria-label="Settings" onClick={() => setActiveView("settings")}><Settings className="size-4" /></Button>
              <Button variant="ghost" size="icon" className="icon-button" type="button" title="Sign out" aria-label="Sign out" onClick={handleSignOut}><LogOut className="size-4" /></Button>
            </div>
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <header className="topbar sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur">
            <div className="mx-auto flex h-[72px] max-w-[1440px] items-center justify-between gap-4 px-4 sm:px-8 xl:px-10">
              <div className="flex min-w-0 items-center gap-3">
                <div className="brand-mark grid size-9 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground lg:hidden"><Landmark className="size-5" /></div>
                <div><p className="eyebrow hidden text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground sm:block">Personal finance workspace</p><h1 className="truncate font-display text-xl font-semibold sm:text-2xl">{viewTitle(activeView)}</h1></div>
              </div>
              <div className="flex shrink-0 items-center gap-2 sm:gap-3">
                <label className="month-control flex h-10 items-center gap-2 rounded-lg border border-border bg-card px-3 text-sm"><CalendarDays className="size-4 text-muted-foreground" /><input aria-label="Selected month" type="month" className="w-[108px] bg-transparent text-sm outline-none" value={month} onChange={(event) => setMonth(event.target.value)} /><ChevronDown className="hidden size-3 text-muted-foreground sm:block" /></label>
                <Button type="button" onClick={() => { setEditingId(null); setDraft(emptyDraft()); setTransactionOpen(true); }} className="h-10 gap-2 px-3 sm:px-4"><Plus className="size-4" /><span className="hidden sm:inline">Add transaction</span><span className="sm:hidden">Add</span></Button>
                <Button type="button" variant="ghost" size="icon" className="lg:hidden" title="Settings" aria-label="Settings" onClick={() => setActiveView("settings")}><Settings className="size-4" /></Button>
                <Button type="button" variant="ghost" size="icon" className="lg:hidden" title="Sign out" aria-label="Sign out" onClick={handleSignOut}><LogOut className="size-4" /></Button>
              </div>
            </div>
            <div className="mobile-nav flex gap-1 overflow-x-auto border-t border-border px-3 py-2 lg:hidden" aria-label="Main navigation">
              <NavItem view="overview" active={activeView} onSelect={setActiveView} icon={<BarChart3 />} label="Overview" compact />
              <NavItem view="transactions" active={activeView} onSelect={setActiveView} icon={<Receipt />} label="Transactions" compact />
              <NavItem view="budgets" active={activeView} onSelect={setActiveView} icon={<Target />} label="Budgets" compact />
              <NavItem view="insights" active={activeView} onSelect={setActiveView} icon={<Sparkles />} label="Insights" compact />
              <NavItem view="modelLab" active={activeView} onSelect={setActiveView} icon={<Activity />} label="Models" compact />
              <NavItem view="assistant" active={activeView} onSelect={setActiveView} icon={<MessageCircle />} label="Assistant" compact />
              <NavItem view="settings" active={activeView} onSelect={setActiveView} icon={<Settings className="size-4" />} label="Settings" compact />
            </div>
          </header>

          <div className="mx-auto max-w-[1440px] space-y-6 px-4 py-6 sm:px-8 sm:py-8 xl:px-10">
            {pageMessage && <div role="alert" className="flex items-center justify-between gap-3 border-l-2 border-destructive bg-destructive/5 px-4 py-3 text-sm text-destructive"><span>{pageMessage}</span><Button variant="ghost" size="icon" aria-label="Dismiss message" onClick={() => setPageMessage("")}><X className="size-4" /></Button></div>}
            {loading && <div className="flex items-center gap-2 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin" />Loading your finance data</div>}
            {!loading && transactions.length === 0 && <div className="border border-border bg-card px-4 py-3 text-sm text-muted-foreground">Your private workspace is ready. Add your first transaction to see your overview.</div>}

            {activeView === "overview" && <OverviewView month={month} transactions={transactions} selectedTransactions={selectedTransactions} income={income} expenses={expenses} balance={balance} chartData={chartData} budgets={monthlyBudgets} forecast={forecast} categories={categorySpend(transactions, month)} categoryForecast={categoryForecast} onNavigate={setActiveView} onAdd={() => { setEditingId(null); setDraft(emptyDraft()); setTransactionOpen(true); }} onEdit={editTransaction} onDelete={removeTransaction} />}
            {activeView === "transactions" && <TransactionsView month={month} transactions={visibleTransactions} search={search} setSearch={setSearch} filterType={filterType} setFilterType={setFilterType} filterCategory={filterCategory} setFilterCategory={setFilterCategory} onAdd={() => { setEditingId(null); setDraft(emptyDraft()); setTransactionOpen(true); }} onEdit={editTransaction} onDelete={removeTransaction} />}
            {activeView === "budgets" && <BudgetsView month={month} setMonth={setMonth} category={budgetCategory} setCategory={setBudgetCategory} limit={budgetLimit} setLimit={setBudgetLimit} budgets={monthlyBudgets} onSave={saveBudget} onDelete={removeBudget} />}
            {activeView === "insights" && <InsightsView insights={insights} month={month} />}
            {activeView === "modelLab" && <ModelLabView transactions={transactions} forecast={forecast} />}
            {activeView === "assistant" && <AssistantView messages={chatMessages} input={chatInput} setInput={setChatInput} onSend={(text) => sendChat(text)} busy={chatBusy} error={chatError} recording={recording} transcribing={transcribing} onVoice={toggleVoice} speakAnswers={speakAnswers} setSpeakAnswers={(value) => { setSpeakAnswers(value); if (!value) stopSpeaking(); }} speaking={speaking} onStopSpeaking={stopSpeaking} onSpeak={(text) => void speakAnswer(text)} />}
            {activeView === "settings" && <SettingsView settings={settings} onUpdateSettings={updateSettings} user={session.user} onUpdateProfileName={handleUpdateProfileName} onSignOut={handleSignOut} transactions={transactions} budgets={budgets} onImportData={handleImportData} onLoadDemoData={handleLoadDemoData} onClearTransactions={handleClearTransactions} onClearBudgets={handleClearBudgets} onResetAllData={handleResetAllData} />}
          </div>
        </main>
      </div>

      <TransactionDialog open={transactionOpen} setOpen={setTransactionOpen} draft={draft} setDraft={setDraft} editing={Boolean(editingId)} onSubmit={saveTransaction} />
    </div>
  </CurrencyContext.Provider>
  );
}

function viewTitle(view: View) {
  return ({ overview: "Overview", transactions: "Transactions", budgets: "Budgets", insights: "Insights", modelLab: "Model lab", assistant: "Finance assistant", settings: "Settings & Preferences" })[view];
}

function NavItem({ view, active, onSelect, icon, label, compact = false }: { view: View; active: View; onSelect: (view: View) => void; icon: ReactNode; label: string; compact?: boolean }) {
  const selected = view === active;
  return <Button type="button" variant="ghost" aria-current={selected ? "page" : undefined} onClick={() => onSelect(view)} className={`nav-item flex shrink-0 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors ${compact ? "h-9 gap-2 px-3" : "h-11 w-full"} ${selected ? "nav-item-active" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}>{icon}{label}</Button>;
}

function StatCard({ label, amount, tone, icon, foot }: { label: string; amount: number; tone: "income" | "expense" | "balance" | "neutral"; icon: ReactNode; foot: string }) {
  const CURRENCY = useCurrency();
  return <section className={`metric-panel min-w-0 border border-border bg-card p-5 sm:p-6 metric-${tone}`}><div className="flex items-start justify-between gap-2"><p className="text-sm text-muted-foreground">{label}</p><span className="metric-icon grid size-9 shrink-0 place-items-center rounded-lg">{icon}</span></div><p className="metric-number mt-5 truncate font-display text-2xl font-semibold sm:text-[30px]">{CURRENCY}{formatAmount(amount)}</p><p className="mt-2 text-xs text-muted-foreground">{foot}</p></section>;
}

function SectionHeading({ title, detail, action }: { title: string; detail?: string; action?: ReactNode }) {
  return <div className="mb-4 flex flex-wrap items-end justify-between gap-3"><div><h2 className="font-display text-lg font-semibold">{title}</h2>{detail && <p className="mt-1 text-sm text-muted-foreground">{detail}</p>}</div>{action}</div>;
}

function OverviewView({ month, transactions, selectedTransactions, income, expenses, balance, chartData, budgets, forecast, categories, categoryForecast, onNavigate, onAdd, onEdit, onDelete }: {
  month: string;
  transactions: FinanceTransaction[];
  selectedTransactions: FinanceTransaction[];
  income: number;
  expenses: number;
  balance: number;
  chartData: { month: string; income: number; expenses: number }[];
  budgets: ReturnType<typeof budgetStatus>;
  forecast: SpendingForecast;
  categories: ReturnType<typeof categorySpend>;
  categoryForecast: Record<string, number>;
  onNavigate: (view: View) => void;
  onAdd: () => void;
  onEdit: (transaction: FinanceTransaction) => void;
  onDelete: (id: string) => void;
}) {
  const CURRENCY = useCurrency();
  const pieColors = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];
  const nextEstimate = forecast.estimates[0];
  return <>
    <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="eyebrow text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{new Date(`${month}-01T00:00:00`).toLocaleDateString("en", { month: "long", year: "numeric" })}</p><h2 className="mt-2 font-display text-2xl font-semibold sm:text-3xl">Your money, in view.</h2><p className="mt-2 max-w-xl text-sm text-muted-foreground">A clear picture of what came in, what went out, and what’s ahead.</p></div><Button type="button" variant="outline" className="month-stepper inline-flex h-9 items-center gap-2 px-3 text-sm" onClick={() => onNavigate("transactions")}><Activity className="size-4 text-primary" />{selectedTransactions.length} entries <ArrowRight className="size-3" /></Button></div>

    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 sm:gap-4">
      <StatCard label="Monthly income" amount={income} tone="income" icon={<ArrowDownLeft />} foot={`${selectedTransactions.filter((transaction) => transaction.transaction_type === "income").length} deposits this month`} />
      <StatCard label="Monthly expenses" amount={expenses} tone="expense" icon={<ArrowUpRight />} foot={`${selectedTransactions.filter((transaction) => transaction.transaction_type === "expense").length} outgoing transactions`} />
      <StatCard label="Net this month" amount={income - expenses} tone="balance" icon={income >= expenses ? <TrendingUp /> : <TrendingDown />} foot="Income minus expenses" />
      <StatCard label="Available balance" amount={balance} tone="neutral" icon={<Wallet />} foot="Across all recorded months" />
    </div>

    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.75fr)_minmax(300px,0.85fr)]">
      <section className="data-section border border-border bg-card p-5 sm:p-6">
        <SectionHeading title="Cash flow" detail="Income and spending across recent months" action={<span className="chart-key text-xs text-muted-foreground"><i className="key-income" />Income <i className="key-expense" />Expenses</span>} />
        {chartData.every((row) => row.income === 0 && row.expenses === 0) ? <EmptyState icon={<BarChart3 />} title="Your cash flow starts here" detail="Record a transaction to start seeing month-by-month patterns." /> : <div className="chart-wrap h-[260px] w-full"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}><defs><linearGradient id="income-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--chart-income)" stopOpacity={0.22} /><stop offset="95%" stopColor="var(--chart-income)" stopOpacity={0.01} /></linearGradient><linearGradient id="expense-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--chart-expense)" stopOpacity={0.16} /><stop offset="95%" stopColor="var(--chart-expense)" stopOpacity={0.01} /></linearGradient></defs><CartesianGrid stroke="var(--chart-grid)" vertical={false} /><XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: "var(--chart-label)", fontSize: 11 }} dy={9} /><YAxis axisLine={false} tickLine={false} tick={{ fill: "var(--chart-label)", fontSize: 10 }} tickFormatter={(value: number) => formatAmount(value, true)} /><Tooltip formatter={(value) => `${CURRENCY}${formatAmount(Number(value))}`} contentStyle={{ borderRadius: 8, border: "1px solid var(--border)", background: "var(--popover)", color: "var(--popover-foreground)" }} /><Area type="monotone" dataKey="income" name="Income" stroke="var(--chart-income)" strokeWidth={2} fill="url(#income-fill)" /><Area type="monotone" dataKey="expenses" name="Expenses" stroke="var(--chart-expense)" strokeWidth={2} fill="url(#expense-fill)" /></AreaChart></ResponsiveContainer></div>}
      </section>
      <section className="data-section border border-border bg-card p-5 sm:p-6">
        <SectionHeading title="Spending mix" detail="This month by category" />
        {categories.length === 0 ? <EmptyState icon={<CreditCard />} title="No expenses yet" detail="Your category breakdown will appear here." /> : <><div className="relative mx-auto h-[180px] max-w-[300px]"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={categories} dataKey="amount" nameKey="category" innerRadius={54} outerRadius={78} paddingAngle={3} stroke="none">{categories.map((entry, index) => <Cell key={entry.category} fill={pieColors[index % pieColors.length]} />)}</Pie><Tooltip formatter={(value) => `${CURRENCY}${formatAmount(Number(value))}`} contentStyle={{ borderRadius: 8, border: "1px solid var(--border)", background: "var(--popover)", color: "var(--popover-foreground)" }} /></PieChart></ResponsiveContainer><div className="pointer-events-none absolute inset-0 grid place-content-center text-center"><span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Total spent</span><b className="font-display text-lg">{CURRENCY}{formatAmount(expenses, true)}</b></div></div><div className="mt-2 space-y-2">{categories.slice(0, 5).map((entry, index) => <div key={entry.category} className="flex items-center justify-between text-sm"><span className="flex items-center gap-2"><i className="category-dot" style={{ background: pieColors[index % pieColors.length] }} />{entry.category}</span><span className="tabular-nums">{CURRENCY}{formatAmount(entry.amount)}</span></div>)}</div></>}
      </section>
    </div>

    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.9fr)]">
      <section className="data-section border border-border bg-card p-5 sm:p-6"><SectionHeading title="Recent activity" detail="Your latest transactions" action={<Button variant="link" size="sm" onClick={() => onNavigate("transactions")}>View all</Button>} />{transactions.length === 0 ? <EmptyState icon={<Wallet />} title="No activity recorded" detail="Add an income or expense to get started." action={<Button size="sm" onClick={onAdd}><Plus className="size-4" />Add transaction</Button>} /> : <TransactionTable transactions={transactions.slice(0, 5)} onEdit={onEdit} onDelete={onDelete} compact />}</section>
      <section className="data-section border border-border bg-card p-5 sm:p-6"><SectionHeading title="Budget pulse" detail="Progress against monthly limits" action={<Button variant="link" size="sm" onClick={() => onNavigate("budgets")}>Manage</Button>} />{budgets.length === 0 ? <EmptyState icon={<Target />} title="Set a spending limit" detail="Create an overall or category budget for the month." action={<Button variant="outline" size="sm" onClick={() => onNavigate("budgets")}>Set a budget <ArrowRight className="size-4" /></Button>} /> : <div className="space-y-5">{budgets.slice(0, 3).map((budget) => <BudgetProgress key={budget.id} budget={budget} />)}</div>}</section>
    </div>

    <section className="forecast-strip grid gap-5 border border-border bg-secondary/60 p-5 sm:grid-cols-[minmax(0,1fr)_minmax(240px,0.65fr)] sm:items-center sm:p-6"><div className="flex gap-4"><span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground"><Sparkles className="size-5" /></span><div><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Spending estimate</p><h3 className="mt-1 font-display text-lg font-semibold">{nextEstimate ? `${CURRENCY}${formatAmount(nextEstimate.estimate)} expected next month` : "Your outlook is taking shape"}</h3><p className="mt-1 text-sm text-muted-foreground">{forecast.message}</p>{nextEstimate?.low !== null && nextEstimate?.high !== null && nextEstimate && <p className="mt-1 text-xs text-muted-foreground">Likely range {CURRENCY}{formatAmount(nextEstimate.low)}–{CURRENCY}{formatAmount(nextEstimate.high)} · {forecast.model} model</p>}</div></div><div className="flex flex-col gap-3 sm:items-end"><Button type="button" variant="link" size="sm" className="forecast-link inline-flex items-center gap-2 text-sm font-medium" onClick={() => onNavigate("insights")}>Explore insights <ArrowRight className="size-4" /></Button>{Object.entries(categoryForecast).filter(([, estimate]) => estimate > 0).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([category, estimate]) => <p key={category} className="text-xs text-muted-foreground">{category} outlook <span className="ml-2 font-medium tabular-nums text-foreground">{CURRENCY}{formatAmount(estimate)}</span></p>)}</div></section>
    <p className="flex items-start gap-2 text-xs text-muted-foreground"><CircleHelp className="mt-0.5 size-3.5 shrink-0" />Educational estimates only. Forecasts and insights are not professional financial advice.</p>
    {Object.keys(categoryForecast).length > 0 && <span className="sr-only">Category forecast available</span>}
  </>;
}

function BudgetProgress({ budget }: { budget: ReturnType<typeof budgetStatus>[number] }) {
  const CURRENCY = useCurrency();
  return <div><div className="mb-2 flex items-center justify-between gap-3"><span className="text-sm font-medium">{budget.category === "ALL" ? "Overall" : budget.category}</span><span className="text-xs tabular-nums text-muted-foreground">{CURRENCY}{formatAmount(budget.spent)} / {CURRENCY}{formatAmount(Number(budget.limit_amount))}</span></div><div className="budget-track h-2 overflow-hidden rounded-full bg-muted"><div className={`budget-fill h-full rounded-full ${budget.status}`} style={{ width: `${Math.min(budget.usedPct, 100)}%` }} /></div><p className={`mt-2 text-xs ${budget.status === "ok" ? "text-muted-foreground" : budget.status === "warning" ? "text-warning" : "text-destructive"}`}>{budget.status === "exceeded" ? `Over by ${CURRENCY}${formatAmount(-budget.remaining)}` : budget.status === "warning" ? `${Math.round(budget.usedPct)}% used · ${CURRENCY}${formatAmount(budget.remaining)} left` : `${CURRENCY}${formatAmount(budget.remaining)} remaining`}</p></div>;
}

function TransactionsView({ month, transactions, search, setSearch, filterType, setFilterType, filterCategory, setFilterCategory, onAdd, onEdit, onDelete }: {
  month: string;
  transactions: FinanceTransaction[];
  search: string;
  setSearch: (value: string) => void;
  filterType: string;
  setFilterType: (value: string) => void;
  filterCategory: string;
  setFilterCategory: (value: string) => void;
  onAdd: () => void;
  onEdit: (transaction: FinanceTransaction) => void;
  onDelete: (id: string) => void;
}) {
  return <>
    <div><p className="eyebrow text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{new Date(`${month}-01T00:00:00`).toLocaleDateString("en", { month: "long", year: "numeric" })}</p><h2 className="mt-2 font-display text-2xl font-semibold sm:text-3xl">Every detail, accounted for.</h2><p className="mt-2 text-sm text-muted-foreground">Your income and expenses, all in one place.</p></div>
    <section className="data-section border border-border bg-card">
      <div className="flex flex-wrap items-center gap-3 border-b border-border p-4 sm:p-5"><label className="relative min-w-[180px] flex-1"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input aria-label="Search descriptions or transaction IDs" placeholder="Search description or transaction ID" className="pl-9" value={search} onChange={(event) => setSearch(event.target.value)} /></label><Filter className="hidden size-4 text-muted-foreground sm:block" /><select aria-label="Filter by type" className="filter-select h-9 rounded-md border border-input bg-background px-3 text-sm" value={filterType} onChange={(event) => setFilterType(event.target.value)}><option value="all">All types</option><option value="income">Income</option><option value="expense">Expenses</option></select><select aria-label="Filter by category" className="filter-select h-9 rounded-md border border-input bg-background px-3 text-sm" value={filterCategory} onChange={(event) => setFilterCategory(event.target.value)}><option value="all">All categories</option>{CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}</select><span className="w-full text-xs text-muted-foreground sm:ml-auto sm:w-auto">{transactions.length} records</span></div>
      {transactions.length === 0 ? <div className="px-5 py-14"><EmptyState icon={<Search />} title="No matching transactions" detail="Try another month or adjust your filters." action={<Button size="sm" onClick={onAdd}><Plus className="size-4" />Add transaction</Button>} /></div> : <TransactionTable transactions={transactions} onEdit={onEdit} onDelete={onDelete} />}
    </section>
  </>;
}

function TransactionTable({ transactions, onEdit, onDelete, compact = false }: { transactions: FinanceTransaction[]; onEdit: (transaction: FinanceTransaction) => void; onDelete: (id: string) => void; compact?: boolean }) {
  const CURRENCY = useCurrency();
  return <div className="overflow-x-auto"><table className="finance-table w-full min-w-[820px] border-collapse text-left"><thead><tr><th>Date</th><th>Description</th><th>Transaction ID</th><th>Category</th><th className="text-right">Amount</th><th className="w-[82px]"></th></tr></thead><tbody>{transactions.map((transaction) => <tr key={transaction.id}><td className="whitespace-nowrap text-muted-foreground">{new Date(`${transaction.transaction_date}T00:00:00`).toLocaleDateString("en", { month: "short", day: "numeric", year: compact ? undefined : "numeric" })}</td><td><div className="flex min-w-0 items-center gap-3"><span className={`transaction-icon grid size-8 shrink-0 place-items-center rounded-full ${transaction.transaction_type}`} aria-hidden="true">{transaction.transaction_type === "income" ? <ArrowDownLeft className="size-4" /> : <ArrowUpRight className="size-4" />}</span><span className="max-w-[260px] truncate font-medium">{transaction.description}</span></div></td><td><code className="whitespace-nowrap text-xs text-muted-foreground" title={transaction.id}>{transaction.id}</code></td><td><span className="category-pill inline-flex items-center rounded-md px-2 py-1 text-xs">{transaction.category}</span></td><td className={`whitespace-nowrap text-right font-medium tabular-nums ${transaction.transaction_type === "income" ? "amount-positive" : ""}`}>{transaction.transaction_type === "income" ? "+" : "−"}{CURRENCY}{formatAmount(transaction.amount)}</td><td><div className="flex justify-end gap-1"><Button variant="ghost" size="icon" className="icon-button" title="Edit transaction" aria-label={`Edit ${transaction.description}`} onClick={() => onEdit(transaction)}><Pencil className="size-3.5" /></Button><Button variant="ghost" size="icon" className="icon-button destructive-icon" title="Delete transaction" aria-label={`Delete ${transaction.description}`} onClick={() => onDelete(transaction.id)}><Trash2 className="size-3.5" /></Button></div></td></tr>)}</tbody></table></div>;
}

function BudgetsView({ month, setMonth, category, setCategory, limit, setLimit, budgets, onSave, onDelete }: {
  month: string;
  setMonth: (value: string) => void;
  category: string;
  setCategory: (value: string) => void;
  limit: string;
  setLimit: (value: string) => void;
  budgets: ReturnType<typeof budgetStatus>;
  onSave: (event: FormEvent<HTMLFormElement>) => void;
  onDelete: (id: string) => void;
}) {
  const CURRENCY = useCurrency();
  return <>
    <div><p className="eyebrow text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Plan with intention</p><h2 className="mt-2 font-display text-2xl font-semibold sm:text-3xl">Make room for what matters.</h2><p className="mt-2 text-sm text-muted-foreground">Set a monthly limit and keep an eye on your pace.</p></div>
    <section className="data-section border border-border bg-card p-5 sm:p-6"><SectionHeading title="Create a budget" detail="Set an overall limit or focus on a category." /><form className="grid gap-4 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end" onSubmit={onSave}><div className="space-y-2"><Label htmlFor="budget-month">Month</Label><Input id="budget-month" type="month" value={month} onChange={(event) => setMonth(event.target.value)} required /></div><div className="space-y-2"><Label htmlFor="budget-category">Category</Label><select id="budget-category" className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value={category} onChange={(event) => setCategory(event.target.value)}><option value="ALL">Overall</option>{CATEGORIES.map((item) => <option key={item} value={item}>{item}</option>)}</select></div><div className="space-y-2"><Label htmlFor="budget-limit">Monthly limit</Label><div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">{CURRENCY}</span><Input id="budget-limit" className="pl-7" type="number" min="0.01" step="0.01" max="1000000000" placeholder="0.00" value={limit} onChange={(event) => setLimit(event.target.value)} required /></div></div><Button type="submit" className="h-9"><Plus className="size-4" />Save budget</Button></form></section>
    <section><SectionHeading title="Your monthly limits" detail={`${new Date(`${month}-01T00:00:00`).toLocaleDateString("en", { month: "long", year: "numeric" })} spending and progress`} />{budgets.length === 0 ? <div className="border border-dashed border-border bg-card px-5 py-12"><EmptyState icon={<Target />} title="No budgets set for this month" detail="Create a limit above and your progress will appear here." /></div> : <div className="grid gap-4 md:grid-cols-2">{budgets.map((budget) => <div key={budget.id} className="budget-card border border-border bg-card p-5"><div className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{budget.category === "ALL" ? "Overall budget" : "Category limit"}</p><h3 className="mt-2 font-display text-lg font-semibold">{budget.category === "ALL" ? "Monthly spending" : budget.category}</h3></div><button aria-label={`Delete ${budget.category} budget`} className="icon-button destructive-icon" type="button" onClick={() => onDelete(budget.id)}><Trash2 className="size-4" /></button></div><p className="mt-5 font-display text-2xl font-semibold">{CURRENCY}{formatAmount(Number(budget.limit_amount))}<span className="ml-2 font-sans text-sm font-normal text-muted-foreground">limit</span></p><div className="mt-4"><BudgetProgress budget={budget} /></div></div>)}</div>}</section>
  </>;
}

function ModelLabView({ transactions, forecast }: { transactions: FinanceTransaction[]; forecast: SpendingForecast }) {
  const [description, setDescription] = useState("swiggy dinner 450");
  const cleaned = cleanDescription(description);
  const prediction = predictExpense(description);
  const expenseCategories = new Set(transactions.filter((transaction) => transaction.transaction_type === "expense").map((transaction) => transaction.category));
  const modelNames: Record<string, string> = {
    linear: "Linear regression",
    polynomial: "Nonlinear regression (polynomial)",
    multilinear: "Multilinear regression",
    mean: "Mean baseline",
  };
  const modelRows = (forecast.candidates ?? []).map((candidate) => ({
    ...candidate,
    label: modelNames[candidate.model] ?? candidate.model,
  }));
  const bestModel = [...modelRows].sort((a, b) => a.rmse - b.rmse)[0];

  return <>
    <div>
      <p className="eyebrow text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Preprocessing · classification · regression</p>
      <h2 className="mt-2 font-display text-2xl font-semibold sm:text-3xl">See how the models work.</h2>
      <p className="mt-2 max-w-3xl text-sm text-muted-foreground">Explore a live description prediction and compare forecast algorithms using your own completed monthly records.</p>
    </div>

    <section className="data-section border border-border bg-card p-5 sm:p-6">
      <SectionHeading title="Transaction preprocessing" detail="Clean the description, then predict an expense category with the bundled TF-IDF model." />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.85fr)] lg:items-end">
        <div className="space-y-2">
          <Label htmlFor="model-description">Try a transaction description</Label>
          <Input id="model-description" maxLength={200} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="For example, grocery store 650" />
          <p className="text-xs text-muted-foreground">The prediction preview stays on this device and does not save a transaction.</p>
        </div>
        <div className="flex items-start gap-3 border-l-2 border-primary px-4 py-2">
          <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" />
          <div>
            <p className="text-xs text-muted-foreground">Predicted category</p>
            <p className="mt-1 font-display text-xl font-semibold">{prediction.category}</p>
            <p className="mt-1 text-xs text-muted-foreground">{prediction.knownWords ? `Model score ${(prediction.confidence * 100).toFixed(0)}%${prediction.lowConfidence ? " · low confidence" : ""}` : "No known model words · fallback category"}</p>
          </div>
        </div>
      </div>
      <div className="mt-6 grid gap-5 border-t border-border pt-5 md:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase text-muted-foreground">Cleaned text</p>
          <p className="mt-2 min-h-10 break-words text-sm">{cleaned || "Enter a description to see the cleaned text."}</p>
          <p className="mt-3 text-xs text-muted-foreground">Steps: lowercase → remove numbers and punctuation → normalize spaces → tokenize words and adjacent pairs.</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase text-muted-foreground">Feature preparation</p>
          <p className="mt-2 text-sm leading-relaxed">Known words become TF-IDF features, with term frequency, inverse document frequency, and vector normalization before the classifier scores categories.</p>
          <p className="mt-3 text-xs text-muted-foreground">Model categories: {CATEGORIES.join(" · ")}</p>
        </div>
      </div>
    </section>

    <section className="data-section border border-border bg-card p-5 sm:p-6">
      <SectionHeading title="Forecast model comparison" detail="Lower MAE and RMSE mean smaller errors on the validation months." action={bestModel ? <span className="text-xs text-muted-foreground">Lowest RMSE: <b className="font-medium text-foreground">{bestModel.label}</b></span> : undefined} />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <div>
          {modelRows.length > 0 ? <>
            <div className="chart-wrap h-[230px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={modelRows} layout="vertical" margin={{ top: 4, right: 18, left: 8, bottom: 4 }}>
                  <CartesianGrid stroke="var(--chart-grid)" horizontal={false} />
                  <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: "var(--chart-label)", fontSize: 10 }} />
                  <YAxis type="category" dataKey="label" width={155} axisLine={false} tickLine={false} tick={{ fill: "var(--chart-label)", fontSize: 10 }} />
                  <Tooltip formatter={(value) => formatAmount(Number(value))} contentStyle={{ borderRadius: 8, border: "1px solid var(--border)", background: "var(--popover)", color: "var(--popover-foreground)" }} />
                  <Bar dataKey="rmse" name="RMSE" fill="var(--chart-3)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">RMSE by model · amount units match your transactions</p>
          </> : <EmptyState icon={<BarChart3 />} title="More history needed" detail={forecast.message ?? "Add completed monthly transactions to compare forecast models."} />}
        </div>
        <div className="overflow-x-auto">
          <table className="finance-table w-full min-w-[430px] border-collapse text-left">
            <thead><tr><th>Model</th><th className="text-right">MAE</th><th className="text-right">RMSE</th><th className="text-right">R²</th></tr></thead>
            <tbody>{modelRows.length > 0 ? modelRows.map((row) => <tr key={row.model}><td className="font-medium">{row.label}</td><td className="text-right tabular-nums">{formatAmount(row.mae)}</td><td className="text-right tabular-nums">{formatAmount(row.rmse)}</td><td className="text-right tabular-nums">{row.r2 === null ? "—" : row.r2.toFixed(2)}</td></tr>) : <tr><td colSpan={4} className="py-6 text-sm text-muted-foreground">Validation metrics appear after there is enough completed history.</td></tr>}</tbody>
          </table>
        </div>
      </div>
      <div className="mt-5 border-t border-border pt-4 text-xs leading-relaxed text-muted-foreground">
        <p><b className="font-semibold text-foreground">Validation:</b> walk-forward testing trains on earlier completed months and checks predictions against later months. The selected forecast model is the one with the lowest RMSE.</p>
        <p className="mt-2"><b className="font-semibold text-foreground">Algorithms:</b> linear trend, nonlinear polynomial curve, multilinear regression using time, prior spending and recent income, plus a mean baseline.</p>
      </div>
    </section>

    <section className="data-section border border-border bg-card p-5 sm:p-6">
      <SectionHeading title="Your analysis data" detail="Only transactions from your signed-in account are used." />
      <div className="grid gap-5 sm:grid-cols-3">
        <div><p className="text-xs text-muted-foreground">Transactions</p><p className="mt-1 font-display text-2xl font-semibold">{transactions.length}</p></div>
        <div><p className="text-xs text-muted-foreground">Completed months in forecast</p><p className="mt-1 font-display text-2xl font-semibold">{forecast.monthsUsed}</p></div>
        <div><p className="text-xs text-muted-foreground">Expense categories present</p><p className="mt-1 font-display text-2xl font-semibold">{expenseCategories.size}</p></div>
      </div>
      <div className="mt-5 border-t border-border pt-4">
        <p className="text-xs font-semibold uppercase text-muted-foreground">Python analysis toolkit</p>
        <div className="mt-3 grid gap-4 md:grid-cols-3">
          <div><p className="text-sm font-medium">NumPy</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">Numerical arrays and feature calculations for model training.</p></div>
          <div><p className="text-sm font-medium">pandas</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">Tabular cleanup, missing-value checks, and monthly aggregation.</p></div>
          <div><p className="text-sm font-medium">Matplotlib</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">Python notebook plots for model diagnostics and evaluation.</p></div>
        </div>
        <p className="mt-4 text-xs leading-relaxed text-muted-foreground">This React interface runs its existing browser-safe model helpers and charts; the Python packages above are for a companion Python analysis workflow, not imports into the browser.</p>
      </div>
    </section>
    <p className="flex items-start gap-2 text-xs text-muted-foreground"><CircleHelp className="mt-0.5 size-3.5 shrink-0" />Model scores and spending forecasts are educational estimates, not professional financial advice.</p>
  </>;
}

function InsightsView({ insights, month }: { insights: { type: string; text: string }[]; month: string }) {
  const icons: Record<string, ReactNode> = { top_category: <BarChart3 />, increase: <TrendingUp />, decrease: <TrendingDown />, budget_exceeded: <Target />, budget_warning: <Target />, savings: <Wallet />, forecast: <Sparkles />, info: <Activity />, disclaimer: <CircleHelp /> };
  return <>
    <div><p className="eyebrow text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Patterns, not predictions</p><h2 className="mt-2 font-display text-2xl font-semibold sm:text-3xl">A little more perspective.</h2><p className="mt-2 text-sm text-muted-foreground">Signals and summaries from your {new Date(`${month}-01T00:00:00`).toLocaleDateString("en", { month: "long", year: "numeric" })} activity.</p></div>
    <div className="grid gap-4 md:grid-cols-2">{insights.map((item, index) => <article key={`${item.type}-${index}`} className={`insight-item flex gap-4 border border-border bg-card p-5 ${item.type}`}><span className="insight-icon grid size-10 shrink-0 place-items-center rounded-lg">{icons[item.type] ?? <Sparkles />}</span><div><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{insightLabel(item.type)}</p><p className="mt-2 text-sm leading-relaxed">{item.text}</p></div></article>)}</div>
    <p className="flex items-start gap-2 border-t border-border pt-4 text-xs text-muted-foreground"><CircleHelp className="mt-0.5 size-4 shrink-0" />Educational only — this information is not financial advice.</p>
  </>;
}

function insightLabel(type: string) {
  return ({ top_category: "Spending mix", increase: "Up from last month", decrease: "Down from last month", budget_exceeded: "Budget alert", budget_warning: "Budget watch", savings: "Savings note", forecast: "Spending outlook", info: "A note for you", disclaimer: "Important" } as Record<string, string>)[type] ?? "Insight";
}

function AssistantView({ messages, input, setInput, onSend, busy, error, recording, transcribing, onVoice, speakAnswers, setSpeakAnswers, speaking, onStopSpeaking, onSpeak }: { messages: { role: "you" | "assistant"; text: string }[]; input: string; setInput: (value: string) => void; onSend: (text?: string) => Promise<void>; busy: boolean; error: string; recording: boolean; transcribing: boolean; onVoice: () => Promise<void>; speakAnswers: boolean; setSpeakAnswers: (value: boolean) => void; speaking: boolean; onStopSpeaking: () => void; onSpeak: (text: string) => void }) {
  const quickQuestions = [
    "How much did I spend this month?",
    "What is my balance?",
    "Show my budget status",
    "What is my spending outlook?",
    "What was my highest expense?",
  ];

  return <>
    <div><p className="eyebrow text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Your financial picture</p><h2 className="mt-2 font-display text-2xl font-semibold sm:text-3xl">Personal finance assistant</h2></div>
    <section className="assistant-panel flex h-[640px] max-h-[80dvh] min-h-[420px] flex-col border border-border bg-card">
      <div className="flex items-center gap-3 border-b border-border px-5 py-4"><span className="grid size-9 place-items-center rounded-lg bg-secondary text-primary"><Landmark className="size-5" /></span><div className="min-w-0 flex-1"><p className="text-sm font-semibold">MoneyMind AI</p><p className="text-xs text-muted-foreground">Private records · ask by typing or voice</p></div>{speaking ? <Button type="button" variant="outline" size="sm" onClick={onStopSpeaking}><Square className="size-3.5" />Stop voice</Button> : <Button type="button" variant={speakAnswers ? "default" : "outline"} size="sm" aria-pressed={speakAnswers} onClick={() => setSpeakAnswers(!speakAnswers)}>{speakAnswers ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}<span className="hidden sm:inline">{speakAnswers ? "Voice answers on" : "Voice answers off"}</span></Button>}</div>
      <Conversation><ConversationContent className="gap-5 p-5">
        <Message from="assistant"><MessageContent><MessageResponse>Hi! What would you like to know about your spending, savings, budgets, or expense outlook?</MessageResponse><div className="mt-3 flex flex-wrap gap-2">{quickQuestions.map((question) => <button key={question} type="button" disabled={busy || recording} className="inline-flex items-center rounded-full border border-border bg-secondary/80 px-3 py-1 text-xs font-medium text-secondary-foreground transition-colors hover:bg-primary hover:text-primary-foreground disabled:opacity-50" onClick={() => { setInput(question); void onSend(question); }}><Sparkles className="mr-1.5 size-3" />{question}</button>)}</div></MessageContent></Message>
        {messages.map((message, index) => <Message key={`${message.role}-${index}`} from={message.role === "you" ? "user" : "assistant"}><MessageContent className={message.role === "you" ? "group-[.is-user]:bg-primary group-[.is-user]:text-primary-foreground" : ""}><MessageResponse>{message.text}</MessageResponse>{message.role === "assistant" && <button type="button" className="mt-1 inline-flex w-fit items-center gap-1 text-xs text-muted-foreground hover:text-primary" onClick={() => onSpeak(message.text)} disabled={speaking}><Volume2 className="size-3.5" />Listen</button>}</MessageContent></Message>)}
        {recording && (
          <div role="status" className="flex items-center justify-between gap-2 rounded-lg border border-primary/30 bg-primary/10 px-3.5 py-2.5 text-sm text-primary">
            <div className="flex items-center gap-2.5">
              <span className="relative flex size-3">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-75" />
                <span className="relative inline-flex size-3 rounded-full bg-destructive" />
              </span>
              <span className="font-medium">Listening to your voice… speak your question</span>
            </div>
            <span className="text-xs text-muted-foreground">Auto-sends on pause or tap stop button</span>
          </div>
        )}
        {transcribing && (
          <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
            <LoaderCircle className="size-4 animate-spin text-primary" />
            Transcribing your voice question…
          </p>
        )}
        {busy && (
          <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
            <LoaderCircle className="size-4 animate-spin text-primary" />
            Checking your financial records…
          </p>
        )}
        {error && (
          <div role="alert" className="rounded-lg border border-destructive/20 bg-destructive/10 p-3.5 text-sm text-destructive">
            <p className="font-medium">{error}</p>
            <div className="mt-2.5 flex flex-wrap gap-2">
              {quickQuestions.map((question) => (
                <button
                  key={question}
                  type="button"
                  className="inline-flex items-center rounded-md border border-border bg-card px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-primary hover:text-primary-foreground"
                  onClick={() => {
                    setInput(question);
                    void onSend(question);
                  }}
                >
                  <Sparkles className="mr-1 size-3 text-primary" />
                  {question}
                </button>
              ))}
            </div>
          </div>
        )}
      </ConversationContent><ConversationScrollButton aria-label="Scroll to latest answer" /></Conversation>
      <div className="border-t border-border p-4">
        <PromptInput onSubmit={() => onSend()}>
          <PromptInputTextarea
            aria-label="Ask the assistant"
            placeholder={
              recording
                ? "Listening… your words appear here in real time"
                : transcribing
                ? "Transcribing your question…"
                : "Ask about your spending, balance, budgets, or outlook…"
            }
            maxLength={500}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            disabled={busy || transcribing}
          />
          <PromptInputFooter className="justify-end gap-2">
            <Button
              type="button"
              size="icon-sm"
              variant={recording ? "destructive" : "outline"}
              aria-label={recording ? "Stop listening and send" : "Ask by voice"}
              aria-pressed={recording}
              disabled={busy || transcribing}
              onClick={() => void onVoice()}
            >
              {recording ? <Square className="size-4" /> : <Mic className="size-4" />}
            </Button>
            <PromptInputSubmit
              aria-label="Send question"
              status={busy ? "submitted" : "ready"}
              disabled={busy || recording || transcribing || !input.trim()}
            />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </section>
    <p className="text-xs text-muted-foreground">Based on recorded transactions, not professional financial advice.</p>
  </>;
}

function EmptyState({ icon, title, detail, action }: { icon: ReactNode; title: string; detail: string; action?: ReactNode }) {
  return <div className="empty-state flex min-h-[160px] flex-col items-center justify-center text-center"><span className="mb-3 grid size-10 place-items-center rounded-xl bg-secondary text-primary">{icon}</span><h3 className="text-sm font-semibold">{title}</h3><p className="mt-1 max-w-[280px] text-xs leading-relaxed text-muted-foreground">{detail}</p>{action && <div className="mt-4">{action}</div>}</div>;
}

function TransactionDialog({ open, setOpen, draft, setDraft, editing, onSubmit }: {
  open: boolean;
  setOpen: (open: boolean) => void;
  draft: TransactionDraft;
  setDraft: (draft: TransactionDraft) => void;
  editing: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const CURRENCY = useCurrency();
  const prediction = draft.description.trim() && draft.transaction_type === "expense" ? predictExpense(draft.description) : null;
  if (!open) return null;
  const patch = (values: Partial<TransactionDraft>) => setDraft({ ...draft, ...values });
  return <div className="dialog-backdrop fixed inset-0 z-50 grid place-items-center overflow-y-auto p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}><section role="dialog" aria-modal="true" aria-labelledby="transaction-dialog-title" className="transaction-dialog w-full max-w-lg border border-border bg-card p-5 shadow-xl sm:p-7"><div className="flex items-start justify-between gap-4"><div><p className="eyebrow text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">Transaction entry</p><h2 id="transaction-dialog-title" className="mt-2 font-display text-xl font-semibold">{editing ? "Edit transaction" : "Add a transaction"}</h2><p className="mt-1 text-sm text-muted-foreground">Keep your records accurate and up to date.</p></div><button className="icon-button" aria-label="Close transaction form" type="button" onClick={() => setOpen(false)}><X className="size-4" /></button></div><form className="mt-6 space-y-4" onSubmit={onSubmit}><div className="space-y-2"><Label htmlFor="transaction-type">Type</Label><div className="segmented-control grid grid-cols-2 rounded-lg border border-border bg-muted p-1"><button type="button" className={draft.transaction_type === "expense" ? "selected" : ""} onClick={() => patch({ transaction_type: "expense", category: "" })}><ArrowUpRight className="size-4" />Expense</button><button type="button" className={draft.transaction_type === "income" ? "selected" : ""} onClick={() => patch({ transaction_type: "income", category: "" })}><ArrowDownLeft className="size-4" />Income</button></div></div><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="transaction-date">Date</Label><Input id="transaction-date" type="date" value={draft.transaction_date} onChange={(event) => patch({ transaction_date: event.target.value })} required /></div><div className="space-y-2"><Label htmlFor="transaction-amount">Amount</Label><div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">{CURRENCY}</span><Input id="transaction-amount" className="pl-7" type="number" inputMode="decimal" min="0.01" step="0.01" max="1000000000" placeholder="0.00" value={draft.amount} onChange={(event) => patch({ amount: event.target.value })} required /></div></div></div><div className="space-y-2"><Label htmlFor="transaction-description">Description</Label><Input id="transaction-description" placeholder="e.g. groceries, salary, metro pass" maxLength={200} value={draft.description} onChange={(event) => patch({ description: event.target.value })} required /></div>{draft.transaction_type === "expense" && <div className="space-y-2"><Label htmlFor="transaction-category">Category</Label><select id="transaction-category" className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value={draft.category} onChange={(event) => patch({ category: event.target.value })}><option value="">Automatic suggestion ({prediction?.category ?? "Other"})</option>{CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}</select>{prediction && <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Sparkles className="size-3 text-primary" />{prediction.knownWords ? `Suggested: ${prediction.category} · ${Math.round(prediction.confidence * 100)}% confidence${prediction.lowConfidence ? " · please review" : ""}` : "No familiar terms — this will be filed as Other."}</p>}</div>}<div className="flex justify-end gap-2 border-t border-border pt-4"><Button variant="outline" type="button" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit"><Check className="size-4" />{editing ? "Save changes" : "Save transaction"}</Button></div></form></section></div>;
}

function AuthScreen({ mode, setMode, name, setName, email, setEmail, password, setPassword, confirmPassword, setConfirmPassword, busy, message, onSubmit, onSocial }: {
  mode: "login" | "register";
  setMode: (mode: "login" | "register") => void;
  name: string;
  setName: (value: string) => void;
  email: string;
  setEmail: (value: string) => void;
  password: string;
  setPassword: (value: string) => void;
  confirmPassword: string;
  setConfirmPassword: (value: string) => void;
  busy: boolean;
  message: string;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onSocial: (provider: "google") => void;
}) {
  return <main className="auth-screen grid min-h-screen lg:grid-cols-[minmax(0,1fr)_minmax(440px,0.76fr)]"><section className="auth-story relative hidden min-h-screen flex-col justify-between overflow-hidden p-12 lg:flex xl:p-16"><div className="auth-story-art" aria-hidden="true"><div className="art-grid" /><div className="art-column art-column-one" /><div className="art-column art-column-two" /><div className="art-column art-column-three" /><div className="art-column art-column-four" /><div className="art-trend"><svg viewBox="0 0 580 230" role="presentation"><path d="M3 190 C80 188 100 155 152 166 S225 120 280 138 S354 80 403 108 S483 52 577 22" /><path className="trend-area" d="M3 190 C80 188 100 155 152 166 S225 120 280 138 S354 80 403 108 S483 52 577 22 L577 230 L3 230Z" /></svg><span className="trend-label">cash flow</span></div><span className="art-caption">A clearer view of every rupee.</span></div><div className="relative z-10 flex items-center gap-3"><div className="grid size-10 place-items-center rounded-xl bg-primary text-primary-foreground"><Landmark className="size-5" /></div><div><p className="font-display text-xl font-semibold">MoneyMind AI</p><p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">personal finance</p></div></div><div className="relative z-10 max-w-xl pb-8"><span className="mb-5 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-primary"><Sparkles className="size-4" />Make sense of your money</span><h1 className="font-display text-5xl font-semibold leading-[1.08] xl:text-6xl">Everyday finance,<br />a little more <span className="text-primary">in focus.</span></h1><p className="mt-6 max-w-md text-base leading-relaxed text-muted-foreground">A calm place to track spending, set a budget, and see what’s changing.</p><p className="mt-10 flex items-center gap-2 text-xs text-muted-foreground"><ShieldCheck className="size-4 text-success" />Private to your account, always.</p></div><p className="relative z-10 text-xs text-muted-foreground">Educational only · Not professional financial advice</p></section><section className="flex min-h-screen flex-col justify-center px-5 py-10 sm:px-10 lg:px-14 xl:px-20"><div className="mx-auto w-full max-w-[400px]"><div className="mb-10 flex items-center gap-3 lg:hidden"><div className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground"><Landmark className="size-5" /></div><p className="font-display text-xl font-semibold">MoneyMind AI</p></div><p className="auth-eyebrow text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">Your personal finance space</p><h2 className="mt-3 font-display text-3xl font-semibold">{mode === "login" ? "Welcome back." : "Start with a clear view."}</h2><p className="mt-2 text-sm leading-relaxed text-muted-foreground">{mode === "login" ? "Sign in to pick up where you left off." : "Create an account to start organizing your finances."}</p><div className="mt-7"><Button variant="outline" type="button" className="h-11 w-full" disabled={busy} onClick={() => onSocial("google")}><GoogleMark />Continue with Google</Button></div><div className="auth-divider my-6 flex items-center gap-3 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground"><span />or continue with email<span /></div><form className="space-y-4" onSubmit={onSubmit}>{mode === "register" && <div className="space-y-2"><Label htmlFor="auth-name">Name</Label><Input id="auth-name" autoComplete="name" maxLength={80} value={name} onChange={(event) => setName(event.target.value)} required /></div>}<div className="space-y-2"><Label htmlFor="auth-email">Email</Label><Input id="auth-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></div><div className="space-y-2"><Label htmlFor="auth-password">Password</Label><Input id="auth-password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={8} maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} required /></div>{mode === "register" && <div className="space-y-2"><Label htmlFor="auth-confirm-password">Re-enter password</Label><Input id="auth-confirm-password" type="password" autoComplete="new-password" minLength={8} maxLength={128} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} aria-invalid={confirmPassword.length > 0 && confirmPassword !== password} required />{confirmPassword.length > 0 && confirmPassword !== password && <p className="text-xs text-destructive">Passwords don't match.</p>}</div>}{message && <p role="status" className={`auth-message border-l-2 px-3 py-2 text-sm ${message.includes("successfully") ? "border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium" : "border-primary bg-secondary/70 text-secondary-foreground"}`}>{message}</p>}<Button type="submit" className="h-11 w-full" disabled={busy}>{busy && <LoaderCircle className="size-4 animate-spin" />}{mode === "login" ? "Sign in" : "Create account"}<ArrowRight className="size-4" /></Button></form><p className="mt-6 text-center text-sm text-muted-foreground">{mode === "login" ? "New here?" : "Already have an account?"} <button className="font-semibold text-primary hover:underline" type="button" onClick={() => setMode(mode === "login" ? "register" : "login")}>{mode === "login" ? "Create an account" : "Sign in"}</button></p><p className="mt-8 flex items-center justify-center gap-2 text-center text-xs text-muted-foreground"><ShieldCheck className="size-4 text-success" />Your financial information stays private to your account.</p><p className="mt-6 text-center text-[11px] text-muted-foreground">By continuing, you agree to use this app for educational purposes only.</p></div></section></main>;
}

function GoogleAccountChooser({
  open,
  onClose,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (name: string, email: string) => void;
}) {
  const [accounts, setAccounts] = useState<GoogleAccount[]>([]);
  const [addingNew, setAddingNew] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [addError, setAddError] = useState("");

  useEffect(() => {
    if (open) {
      setAccounts(getStoredGoogleAccounts());
      setAddingNew(false);
      setNewEmail("");
      setNewName("");
      setAddError("");
    }
  }, [open]);

  if (!open) return null;

  const colors = ["#4285F4", "#0F9D58", "#EA4335", "#F4B400", "#9C27B0", "#009688"];

  function submitNewAccount(e: FormEvent) {
    e.preventDefault();
    const cleanEmail = newEmail.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      setAddError("Please enter a valid Google email address.");
      return;
    }
    const cleanName = newName.trim() || cleanEmail.split("@")[0];
    onSelect(cleanName, cleanEmail);
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="google-chooser-title"
        className="w-full max-w-[420px] rounded-2xl border border-border bg-card p-6 shadow-2xl sm:p-7 animate-in zoom-in-95"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GoogleMark />
            <span className="text-xs font-medium text-muted-foreground">Sign in with Google</span>
          </div>
          <button
            type="button"
            className="icon-button"
            aria-label="Close account picker"
            onClick={onClose}
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="mt-5 text-center">
          <h2 id="google-chooser-title" className="font-display text-2xl font-semibold text-foreground">
            Choose an account
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            to continue to <span className="font-medium text-foreground">MoneyMind AI</span>
          </p>
        </div>

        {!addingNew ? (
          <div className="mt-6 space-y-2">
            <div className="divide-y divide-border overflow-hidden rounded-xl border border-border">
              {accounts.map((acc, index) => {
                const initial = (acc.name || acc.email || "G").charAt(0).toUpperCase();
                const color = colors[index % colors.length];
                return (
                  <button
                    key={acc.email}
                    type="button"
                    className="flex w-full items-center gap-3.5 bg-card px-4 py-3 text-left transition-colors hover:bg-muted/70"
                    onClick={() => onSelect(acc.name, acc.email)}
                  >
                    <span
                      className="grid size-10 shrink-0 place-items-center rounded-full text-sm font-semibold text-white shadow-xs"
                      style={{ backgroundColor: color }}
                    >
                      {initial}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{acc.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{acc.email}</p>
                    </div>
                  </button>
                );
              })}

              <button
                type="button"
                className="flex w-full items-center gap-3.5 bg-card px-4 py-3 text-left transition-colors hover:bg-muted/70"
                onClick={() => setAddingNew(true)}
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-full border border-dashed border-border bg-muted text-muted-foreground">
                  <Plus className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">Use another account</p>
                  <p className="text-xs text-muted-foreground">Sign in with a different Google email</p>
                </div>
              </button>
            </div>
          </div>
        ) : (
          <form className="mt-6 space-y-4" onSubmit={submitNewAccount}>
            <div className="space-y-2">
              <Label htmlFor="google-email">Google Email address</Label>
              <Input
                id="google-email"
                type="email"
                placeholder="e.g. yourname@gmail.com"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                autoFocus
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="google-name">Display Name (optional)</Label>
              <Input
                id="google-name"
                placeholder="e.g. Akhil"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>
            {addError && <p className="text-xs text-destructive">{addError}</p>}
            <div className="flex gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => setAddingNew(false)}
              >
                Back
              </Button>
              <Button type="submit" className="flex-1">
                Continue
              </Button>
            </div>
          </form>
        )}

        <div className="mt-6 border-t border-border pt-4 text-center">
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            To continue, Google will share your name and email with MoneyMind AI.
          </p>
        </div>
      </div>
    </div>
  );
}

function GoogleMark() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4"><path fill="#4285F4" d="M21.35 12.23c0-.72-.06-1.42-.18-2.09H12v3.96h5.23a4.48 4.48 0 0 1-1.94 2.94v2.42h3.14c1.83-1.68 2.92-4.15 2.92-7.23Z" /><path fill="#34A853" d="M12 21.75c2.63 0 4.84-.87 6.46-2.35l-3.14-2.42c-.87.58-1.98.93-3.32.93-2.55 0-4.71-1.72-5.49-4.03H3.27v2.49A9.75 9.75 0 0 0 12 21.75Z" /><path fill="#FBBC05" d="M6.51 13.88a5.86 5.86 0 0 1 0-3.76V7.63H3.27a9.75 9.75 0 0 0 0 8.74l3.24-2.49Z" /><path fill="#EA4335" d="M12 6.09c1.43 0 2.72.49 3.73 1.47l2.8-2.8C16.84 3.18 14.63 2.25 12 2.25a9.75 9.75 0 0 0-8.73 5.38l3.24 2.49C7.29 7.81 9.45 6.09 12 6.09Z" /></svg>;
}
