import { useEffect, useMemo, useState } from "react";
import {
  AccountProfile,
  Budget,
  BudgetCategory,
  Transaction,
  ViewId,
} from "./types/finance";
import {
  DEFAULT_ACCOUNT,
  INITIAL_BUDGETS,
  INITIAL_TRANSACTIONS,
} from "./lib/seedData";
import { getAvailableMonths } from "./lib/finance";
import {
  applyTheme,
  getWorkspaceSettings,
  saveWorkspaceSettings,
  type WorkspaceSettings,
} from "./lib/workspace-settings";
import { STORAGE_PREFIX, upsertSavedAccount } from "./lib/accounts";
import { Sidebar } from "./components/Sidebar";
import { OverviewView } from "./components/OverviewView";
import { TransactionsView } from "./components/TransactionsView";
import { BudgetsView } from "./components/BudgetsView";
import { InsightsForecastView } from "./components/InsightsForecastView";
import { ModelLabView } from "./components/ModelLabView";
import { AssistantView } from "./components/AssistantView";
import { SettingsView } from "./components/SettingsView";
import { AuthScreen } from "./components/AuthScreen";
import { initFirebaseAuthListener, signOutGoogle } from "./lib/firebaseAuth";

function loadStoredData<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export default function App() {
  const [account, setAccount] = useState<AccountProfile>(() =>
    loadStoredData(`${STORAGE_PREFIX}:account`, DEFAULT_ACCOUNT),
  );
  const [showAuth, setShowAuth] = useState(true);

  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    const initialAccount = loadStoredData(`${STORAGE_PREFIX}:account`, DEFAULT_ACCOUNT);
    return loadStoredData(
      `${STORAGE_PREFIX}:${initialAccount.id}:tx`,
      initialAccount.id === DEFAULT_ACCOUNT.id ? INITIAL_TRANSACTIONS : [],
    );
  });
  const [budgets, setBudgets] = useState<Budget[]>(() => {
    const initialAccount = loadStoredData(`${STORAGE_PREFIX}:account`, DEFAULT_ACCOUNT);
    return loadStoredData(
      `${STORAGE_PREFIX}:${initialAccount.id}:bdg`,
      INITIAL_BUDGETS,
    );
  });

  const [settings, setSettings] = useState<WorkspaceSettings>(getWorkspaceSettings);
  const [activeView, setActiveView] = useState<ViewId>("overview");
  const [openAddTxOnTransactions, setOpenAddTxOnTransactions] = useState(false);

  const availableMonths = useMemo(() => getAvailableMonths(transactions), [transactions]);
  const [selectedMonth, setSelectedMonth] = useState<string>(
    () => availableMonths[0] ?? "2026-11",
  );

  // Keep selected month valid if transactions change
  useEffect(() => {
    if (
      selectedMonth !== "all" &&
      availableMonths.length > 0 &&
      !availableMonths.includes(selectedMonth)
    ) {
      setSelectedMonth(availableMonths[0]);
    }
  }, [availableMonths, selectedMonth]);

  // Apply and listen to system theme changes when settings.theme === "system"
  useEffect(() => {
    applyTheme(settings.theme);
    if (settings.theme !== "system" || typeof window === "undefined" || !window.matchMedia) {
      return;
    }
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const listener = () => applyTheme("system");
    mq.addEventListener("change", listener);
    return () => mq.removeEventListener("change", listener);
  }, [settings.theme]);

  useEffect(() => {
    return initFirebaseAuthListener();
  }, []);

  // Persist active account and its isolated ledger
  useEffect(() => {
    try {
      localStorage.setItem(`${STORAGE_PREFIX}:account`, JSON.stringify(account));
      localStorage.setItem(
        `${STORAGE_PREFIX}:${account.id}:tx`,
        JSON.stringify(transactions),
      );
      localStorage.setItem(
        `${STORAGE_PREFIX}:${account.id}:bdg`,
        JSON.stringify(budgets),
      );
    } catch {
      // ignore storage quota errors
    }
  }, [account, transactions, budgets]);

  const handleUpdateSettings = (next: WorkspaceSettings) => {
    setSettings(next);
    saveWorkspaceSettings(next);
    applyTheme(next.theme);
  };

  const isCurrentlyDark = useMemo(() => {
    if (settings.theme === "dark") return true;
    if (settings.theme === "light") return false;
    return (
      typeof window !== "undefined" &&
      Boolean(window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches)
    );
  }, [settings.theme]);

  const handleAuthenticate = (profile: AccountProfile) => {
    upsertSavedAccount(profile);
    setAccount(profile);
    const storedTx = loadStoredData<Transaction[]>(
      `${STORAGE_PREFIX}:${profile.id}:tx`,
      profile.id === DEFAULT_ACCOUNT.id ? INITIAL_TRANSACTIONS : [],
    );
    const storedBdg = loadStoredData<Budget[]>(
      `${STORAGE_PREFIX}:${profile.id}:bdg`,
      INITIAL_BUDGETS,
    );
    setTransactions(storedTx);
    setBudgets(storedBdg);
    setActiveView("overview");
    setShowAuth(false);
  };

  const handleOpenAuth = () => {
    void signOutGoogle();
    setShowAuth(true);
  };

  const handleUpdateProfileName = (name: string) => {
    setAccount((prev) => {
      const next = { ...prev, name };
      upsertSavedAccount(next);
      return next;
    });
  };

  const handleAddTransaction = (tx: Omit<Transaction, "id">) => {
    const nextNum = 2025 + transactions.length;
    const newTx: Transaction = {
      ...tx,
      id: `TXN-${nextNum}`,
    };
    setTransactions((prev) => [newTx, ...prev]);
    const monthKey = tx.date.slice(0, 7);
    if (monthKey && selectedMonth !== "all") {
      setSelectedMonth(monthKey);
    }
  };

  const handleUpdateTransaction = (updated: Transaction) => {
    setTransactions((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
  };

  const handleDeleteTransaction = (id: string) => {
    setTransactions((prev) => prev.filter((t) => t.id !== id));
  };

  const handleImportTransactions = (imported: Transaction[]) => {
    setTransactions((prev) => {
      const existingIds = new Set(prev.map((p) => p.id));
      const uniqueNew = imported.filter((item) => !existingIds.has(item.id));
      return [...uniqueNew, ...prev];
    });
  };

  const handleImportData = (newTransactions: Transaction[], newBudgets: Budget[]) => {
    if (newTransactions.length > 0) {
      handleImportTransactions(newTransactions);
    }
    if (newBudgets.length > 0) {
      setBudgets((prev) => {
        const merged = [...newBudgets, ...prev];
        return Array.from(new Map(merged.map((b) => [b.category, b])).values());
      });
    }
  };

  const handleSaveBudget = (
    category: BudgetCategory,
    monthlyLimit: number,
    existingId?: string,
  ) => {
    setBudgets((prev) => {
      if (existingId) {
        return prev.map((b) =>
          b.id === existingId ? { ...b, category, monthlyLimit } : b,
        );
      }
      const sameCategory = prev.find((b) => b.category === category);
      if (sameCategory) {
        return prev.map((b) =>
          b.id === sameCategory.id ? { ...b, monthlyLimit } : b,
        );
      }
      return [
        ...prev,
        {
          id: `BDG-${100 + prev.length + 1}`,
          category,
          monthlyLimit,
        },
      ];
    });
  };

  const handleDeleteBudget = (id: string) => {
    setBudgets((prev) => prev.filter((b) => b.id !== id));
  };

  if (showAuth) {
    return (
      <AuthScreen
        currentAccount={account}
        onAuthenticate={handleAuthenticate}
      />
    );
  }

  return (
    <div className="finance-app min-h-screen flex flex-col md:flex-row bg-background text-foreground">
      <Sidebar
        activeView={activeView}
        onSelectView={(v) => {
          setActiveView(v);
          setOpenAddTxOnTransactions(false);
        }}
        availableMonths={availableMonths}
        selectedMonth={selectedMonth}
        onSelectMonth={setSelectedMonth}
        isDark={isCurrentlyDark}
        onToggleTheme={() =>
          handleUpdateSettings({
            ...settings,
            theme: isCurrentlyDark ? "light" : "dark",
          })
        }
        account={account}
        onOpenAuth={handleOpenAuth}
      />

      <main className="flex-1 min-w-0 px-4 sm:px-8 py-6 sm:py-8 max-w-6xl">
        {activeView === "overview" && (
          <OverviewView
            transactions={transactions}
            budgets={budgets}
            selectedMonth={selectedMonth}
            currency={settings.currency}
            dateFormat={settings.dateFormat}
            onOpenAddTransaction={() => {
              setActiveView("transactions");
              setOpenAddTxOnTransactions(true);
            }}
            onNavigate={setActiveView}
          />
        )}

        {activeView === "transactions" && (
          <TransactionsView
            transactions={transactions}
            selectedMonth={selectedMonth}
            currency={settings.currency}
            dateFormat={settings.dateFormat}
            onAddTransaction={handleAddTransaction}
            onUpdateTransaction={handleUpdateTransaction}
            onDeleteTransaction={handleDeleteTransaction}
            onImportTransactions={handleImportTransactions}
            externalDialogOpen={openAddTxOnTransactions}
            onCloseExternalDialog={() => setOpenAddTxOnTransactions(false)}
          />
        )}

        {activeView === "budgets" && (
          <BudgetsView
            transactions={transactions}
            budgets={budgets}
            selectedMonth={selectedMonth}
            currency={settings.currency}
            onSaveBudget={handleSaveBudget}
            onDeleteBudget={handleDeleteBudget}
          />
        )}

        {activeView === "insights" && (
          <InsightsForecastView
            transactions={transactions}
            budgets={budgets}
            selectedMonth={selectedMonth}
            currency={settings.currency}
            onNavigate={setActiveView}
          />
        )}

        {activeView === "model-lab" && (
          <ModelLabView transactions={transactions} currency={settings.currency} />
        )}

        {activeView === "assistant" && (
          <AssistantView
            account={account}
            transactions={transactions}
            budgets={budgets}
            selectedMonth={selectedMonth}
            settings={settings}
          />
        )}

        {activeView === "settings" && (
          <SettingsView
            settings={settings}
            onUpdateSettings={handleUpdateSettings}
            account={account}
            onUpdateProfileName={handleUpdateProfileName}
            onOpenAuth={handleOpenAuth}
            transactions={transactions}
            budgets={budgets}
            onImportData={handleImportData}
            onLoadDemoData={() => {
              setTransactions(INITIAL_TRANSACTIONS);
              setBudgets(INITIAL_BUDGETS);
            }}
            onClearTransactions={() => setTransactions([])}
            onClearBudgets={() => setBudgets([])}
            onResetAllData={() => {
              setTransactions([]);
              setBudgets([]);
            }}
          />
        )}
      </main>
    </div>
  );
}
