import React, { useRef, useState, type ChangeEvent } from "react";
import {
  User,
  Sun,
  Moon,
  Monitor,
  Download,
  Upload,
  RotateCcw,
  Trash2,
  Check,
  Globe,
  Palette,
  Volume2,
  Sparkles,
  ShieldCheck,
  FileSpreadsheet,
  FileJson,
  AlertTriangle,
  Info,
} from "lucide-react";
import {
  CURRENCY_OPTIONS,
  VOICE_LANG_OPTIONS,
  exportDataAsJson,
  exportTransactionsAsCsv,
  parseJsonBackup,
  parseCsvTransactions,
  type WorkspaceSettings,
} from "../lib/workspace-settings";
import type { AccountProfile, Budget, Transaction } from "../types/finance";

export interface SettingsViewProps {
  settings: WorkspaceSettings;
  onUpdateSettings: (newSettings: WorkspaceSettings) => void;
  account: AccountProfile;
  onUpdateProfileName: (name: string) => void;
  onOpenAuth: () => void;
  transactions: Transaction[];
  budgets: Budget[];
  onImportData: (transactions: Transaction[], budgets: Budget[]) => void;
  onLoadDemoData: () => void;
  onClearTransactions: () => void;
  onClearBudgets: () => void;
  onResetAllData: () => void;
}

type SettingsTab = "general" | "appearance" | "voice" | "profile" | "data" | "about";
type ConfirmAction = "demo" | "clear-tx" | "clear-bdg" | "reset-all" | null;

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  onUpdateSettings,
  account,
  onUpdateProfileName,
  onOpenAuth,
  transactions,
  budgets,
  onImportData,
  onLoadDemoData,
  onClearTransactions,
  onClearBudgets,
  onResetAllData,
}) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>("general");
  const [displayName, setDisplayName] = useState(account.name);
  const [savedMessage, setSavedMessage] = useState("");
  const [importError, setImportError] = useState("");
  const [importSuccess, setImportSuccess] = useState("");
  const [pendingConfirm, setPendingConfirm] = useState<ConfirmAction>(null);
  const [customCurrency, setCustomCurrency] = useState(
    CURRENCY_OPTIONS.some((c) => c.symbol === settings.currency) ? "" : settings.currency,
  );
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const showToast = (msg: string) => {
    setSavedMessage(msg);
    window.setTimeout(() => setSavedMessage(""), 3000);
  };

  const handleCurrencyChange = (newCurrency: string) => {
    onUpdateSettings({ ...settings, currency: newCurrency });
    showToast(`Currency changed to ${newCurrency}`);
  };

  const handleCustomCurrencySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = customCurrency.trim();
    if (trimmed) {
      onUpdateSettings({ ...settings, currency: trimmed });
      showToast(`Custom currency set to ${trimmed}`);
    }
  };

  const handleThemeChange = (newTheme: "light" | "dark" | "system") => {
    onUpdateSettings({ ...settings, theme: newTheme });
    showToast(`Theme switched to ${newTheme}`);
  };

  const handleVoiceLangChange = (newLang: string) => {
    onUpdateSettings({ ...settings, voiceLang: newLang });
    showToast("Voice recognition language updated");
  };

  const handleAutoSpeakToggle = (checked: boolean) => {
    onUpdateSettings({ ...settings, autoSpeak: checked });
    showToast(checked ? "Auto voice answers enabled" : "Auto voice answers disabled");
  };

  const handleVoiceRateChange = (rate: number) => {
    onUpdateSettings({ ...settings, voiceRate: rate });
    showToast(`Speech rate set to ${rate}x`);
  };

  const handleTestVoice = () => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const text = "Hello! MoneyMind AI voice assistant is configured and ready.";
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = settings.voiceRate || 1.0;
      if (settings.voiceLang && settings.voiceLang !== "auto") {
        utterance.lang = settings.voiceLang;
      }
      window.speechSynthesis.speak(utterance);
    }
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = displayName.trim();
    if (trimmed) {
      onUpdateProfileName(trimmed);
      showToast("Profile name saved");
    }
  };

  const handleFileImport = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportError("");
    setImportSuccess("");

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = String(event.target?.result || "");
        if (file.name.endsWith(".json")) {
          const parsed = parseJsonBackup(content);
          if (parsed.transactions.length === 0 && parsed.budgets.length === 0) {
            setImportError("No valid transactions or budgets found in this JSON file.");
            return;
          }
          onImportData(parsed.transactions, parsed.budgets);
          setImportSuccess(
            `Imported ${parsed.transactions.length} transactions and ${parsed.budgets.length} budgets.`,
          );
        } else if (file.name.endsWith(".csv")) {
          const txs = parseCsvTransactions(content);
          if (txs.length === 0) {
            setImportError(
              "No valid transactions found in this CSV file. Ensure columns include Date, Description, and Amount.",
            );
            return;
          }
          onImportData(txs, []);
          setImportSuccess(`Imported ${txs.length} transactions from CSV.`);
        } else {
          setImportError("Unsupported file type. Please upload a .json or .csv backup file.");
        }
      } catch (err) {
        setImportError(err instanceof Error ? err.message : "Failed to parse backup file.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Configuration
          </p>
          <h1 className="mt-1 text-2xl sm:text-3xl font-semibold tracking-tight text-foreground">
            Settings
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Personalize your MoneyMind AI currency, appearance, voice assistant, and ledger backups.
          </p>
        </div>

        {savedMessage && (
          <div className="inline-flex items-center gap-2 rounded-md border border-primary/25 bg-secondary px-3 py-1.5 text-xs font-medium text-primary">
            <Check className="h-3.5 w-3.5" />
            <span>{savedMessage}</span>
          </div>
        )}
      </div>

      {/* Tabs navigation */}
      <div className="border-b border-border">
        <div className="flex gap-2 overflow-x-auto pb-px">
          <TabButton
            active={activeTab === "general"}
            onClick={() => setActiveTab("general")}
            icon={<Globe className="h-4 w-4" />}
            label="General & Currency"
          />
          <TabButton
            active={activeTab === "appearance"}
            onClick={() => setActiveTab("appearance")}
            icon={<Palette className="h-4 w-4" />}
            label="Appearance"
          />
          <TabButton
            active={activeTab === "voice"}
            onClick={() => setActiveTab("voice")}
            icon={<Volume2 className="h-4 w-4" />}
            label="AI & Voice"
          />
          <TabButton
            active={activeTab === "profile"}
            onClick={() => setActiveTab("profile")}
            icon={<User className="h-4 w-4" />}
            label="Profile & Account"
          />
          <TabButton
            active={activeTab === "data"}
            onClick={() => setActiveTab("data")}
            icon={<Download className="h-4 w-4" />}
            label="Data & Backup"
          />
          <TabButton
            active={activeTab === "about"}
            onClick={() => setActiveTab("about")}
            icon={<Info className="h-4 w-4" />}
            label="About"
          />
        </div>
      </div>

      {/* Tab 1: General & Currency */}
      {activeTab === "general" && (
        <div className="grid gap-6 md:grid-cols-2">
          <section className="data-section border border-border bg-card p-6">
            <div className="flex items-center gap-3 pb-4">
              <span className="grid h-10 w-10 place-items-center rounded-lg bg-secondary text-primary">
                <Globe className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-lg font-semibold text-foreground">Primary Currency</h2>
                <p className="text-xs text-muted-foreground">
                  Select the currency symbol used across balances, budgets, and Gemini answers.
                </p>
              </div>
            </div>

            <div className="mt-2 space-y-4">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {CURRENCY_OPTIONS.map((cur) => {
                  const isSelected = settings.currency === cur.symbol;
                  return (
                    <button
                      key={cur.code}
                      type="button"
                      onClick={() => handleCurrencyChange(cur.symbol)}
                      className={`flex items-center justify-between rounded-lg border p-3 text-left transition-colors ${
                        isSelected
                          ? "border-primary bg-secondary text-primary font-medium ring-1 ring-primary"
                          : "border-border bg-background hover:bg-muted text-foreground"
                      }`}
                    >
                      <span className="text-sm">{cur.label}</span>
                      {isSelected && <Check className="h-4 w-4 text-primary shrink-0" />}
                    </button>
                  );
                })}
              </div>

              <form onSubmit={handleCustomCurrencySubmit} className="pt-3 border-t border-border">
                <label htmlFor="custom-curr" className="block text-xs text-muted-foreground">
                  Or enter custom currency symbol:
                </label>
                <div className="mt-1.5 flex gap-2">
                  <input
                    id="custom-curr"
                    value={customCurrency}
                    onChange={(e) => setCustomCurrency(e.target.value)}
                    placeholder="e.g. kr, CHF, R$, ₩"
                    className="h-9 w-40 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <button
                    type="submit"
                    className="h-9 rounded-md border border-border bg-background px-3 text-xs font-medium text-foreground hover:bg-muted"
                  >
                    Set Custom
                  </button>
                </div>
              </form>

              <div className="rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground">
                <p className="font-medium text-foreground">Live Amount Preview:</p>
                <p className="mt-1 text-base font-semibold text-foreground tabular-nums">
                  {settings.currency} 25,450.00
                </p>
              </div>
            </div>
          </section>

          <section className="data-section border border-border bg-card p-6">
            <div className="flex items-center gap-3 pb-4">
              <span className="grid h-10 w-10 place-items-center rounded-lg bg-secondary text-primary">
                <Sparkles className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-lg font-semibold text-foreground">Workspace Defaults</h2>
                <p className="text-xs text-muted-foreground">
                  Control date formatting and local classifier behavior.
                </p>
              </div>
            </div>

            <div className="mt-2 space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="date-format" className="block text-sm font-medium text-foreground">
                  Date Display Format
                </label>
                <select
                  id="date-format"
                  value={settings.dateFormat}
                  onChange={(e) => {
                    const fmt = e.target.value as WorkspaceSettings["dateFormat"];
                    onUpdateSettings({ ...settings, dateFormat: fmt });
                    showToast(`Date format set to ${fmt}`);
                  }}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="YYYY-MM-DD">YYYY-MM-DD (2026-11-14)</option>
                  <option value="DD/MM/YYYY">DD/MM/YYYY (14/11/2026)</option>
                  <option value="MM/DD/YYYY">MM/DD/YYYY (11/14/2026)</option>
                </select>
              </div>

              <div className="space-y-2 pt-2">
                <p className="text-sm font-medium text-foreground">Automatic Suggestions</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  The bundled TF-IDF model evaluates merchant keywords locally in real time as you
                  type new transactions, with optional Gemini 3.1 Flash-Lite classification on click.
                </p>
                <div className="flex items-center gap-2 rounded-lg bg-muted/50 p-3 text-xs text-foreground">
                  <ShieldCheck className="h-4 w-4 text-success shrink-0" />
                  <span>Deterministic ledger math stays 100% reproducible.</span>
                </div>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* Tab 2: Appearance */}
      {activeTab === "appearance" && (
        <section className="data-section border border-border bg-card p-6">
          <div className="flex items-center gap-3 pb-4">
            <span className="grid h-10 w-10 place-items-center rounded-lg bg-secondary text-primary">
              <Palette className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-lg font-semibold text-foreground">Theme &amp; Appearance</h2>
              <p className="text-xs text-muted-foreground">
                Choose between crisp daylight, rich OKLCH dark slate, or follow your OS preference.
              </p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <button
              type="button"
              onClick={() => handleThemeChange("light")}
              className={`flex flex-col items-start rounded-xl border p-5 text-left transition-colors ${
                settings.theme === "light"
                  ? "border-primary bg-secondary/70 ring-2 ring-primary"
                  : "border-border bg-card hover:bg-muted/60"
              }`}
            >
              <div className="flex w-full items-center justify-between">
                <div className="grid h-10 w-10 place-items-center rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400">
                  <Sun className="h-5 w-5" />
                </div>
                {settings.theme === "light" && <Check className="h-4 w-4 text-primary" />}
              </div>
              <h3 className="mt-4 font-semibold text-sm text-foreground">Light Mode</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Crisp daylight palette with clear contrast.
              </p>
            </button>

            <button
              type="button"
              onClick={() => handleThemeChange("dark")}
              className={`flex flex-col items-start rounded-xl border p-5 text-left transition-colors ${
                settings.theme === "dark"
                  ? "border-primary bg-secondary/70 ring-2 ring-primary"
                  : "border-border bg-card hover:bg-muted/60"
              }`}
            >
              <div className="flex w-full items-center justify-between">
                <div className="grid h-10 w-10 place-items-center rounded-lg bg-indigo-500/15 text-indigo-600 dark:text-indigo-400">
                  <Moon className="h-5 w-5" />
                </div>
                {settings.theme === "dark" && <Check className="h-4 w-4 text-primary" />}
              </div>
              <h3 className="mt-4 font-semibold text-sm text-foreground">Dark Mode</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Subtle OKLCH dark slate for low-light environments.
              </p>
            </button>

            <button
              type="button"
              onClick={() => handleThemeChange("system")}
              className={`flex flex-col items-start rounded-xl border p-5 text-left transition-colors ${
                settings.theme === "system"
                  ? "border-primary bg-secondary/70 ring-2 ring-primary"
                  : "border-border bg-card hover:bg-muted/60"
              }`}
            >
              <div className="flex w-full items-center justify-between">
                <div className="grid h-10 w-10 place-items-center rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                  <Monitor className="h-5 w-5" />
                </div>
                {settings.theme === "system" && <Check className="h-4 w-4 text-primary" />}
              </div>
              <h3 className="mt-4 font-semibold text-sm text-foreground">System Default</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Synchronizes automatically with your OS preference.
              </p>
            </button>
          </div>
        </section>
      )}

      {/* Tab 3: AI & Voice */}
      {activeTab === "voice" && (
        <div className="grid gap-6 md:grid-cols-2">
          <section className="data-section border border-border bg-card p-6">
            <div className="flex items-center gap-3 pb-4">
              <span className="grid h-10 w-10 place-items-center rounded-lg bg-secondary text-primary">
                <Volume2 className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-lg font-semibold text-foreground">
                  Speech Recognition Language
                </h2>
                <p className="text-xs text-muted-foreground">
                  Select your spoken accent or preferred dictation locale.
                </p>
              </div>
            </div>

            <div className="mt-2 space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="voice-lang" className="block text-sm font-medium text-foreground">
                  Language / Locale
                </label>
                <select
                  id="voice-lang"
                  value={settings.voiceLang}
                  onChange={(e) => handleVoiceLangChange(e.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {VOICE_LANG_OPTIONS.map((opt) => (
                    <option key={opt.code} value={opt.code}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">
                  The AI Assistant microphone prioritizes this locale when listening.
                </p>
              </div>

              <div className="border-t border-border pt-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-foreground">Read Answers Aloud</p>
                    <p className="text-xs text-muted-foreground">
                      Automatically synthesize speech when assistant answers finish streaming.
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={settings.autoSpeak}
                    aria-label="Toggle automatic speech answers"
                    onClick={() => handleAutoSpeakToggle(!settings.autoSpeak)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors ${
                      settings.autoSpeak ? "bg-primary" : "bg-muted"
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-card shadow-sm transition-transform ${
                        settings.autoSpeak ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>
          </section>

          <section className="data-section border border-border bg-card p-6">
            <div className="flex items-center gap-3 pb-4">
              <span className="grid h-10 w-10 place-items-center rounded-lg bg-secondary text-primary">
                <Sparkles className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-lg font-semibold text-foreground">Speech Synthesis Voice</h2>
                <p className="text-xs text-muted-foreground">
                  Tune playback rate and preview audio output.
                </p>
              </div>
            </div>

            <div className="mt-2 space-y-4">
              <div>
                <p className="text-sm font-medium text-foreground">Voice Speed</p>
                <div className="mt-2 flex gap-2">
                  {[0.8, 1.0, 1.25].map((rate) => (
                    <button
                      key={rate}
                      type="button"
                      onClick={() => handleVoiceRateChange(rate)}
                      className={`flex-1 rounded-md border py-2 text-xs font-medium transition-colors ${
                        (settings.voiceRate || 1.0) === rate
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-background text-foreground hover:bg-muted"
                      }`}
                    >
                      {rate === 0.8 ? "0.8x Slower" : rate === 1.0 ? "1.0x Normal" : "1.25x Faster"}
                    </button>
                  ))}
                </div>
              </div>

              <div className="border-t border-border pt-4">
                <button
                  type="button"
                  onClick={handleTestVoice}
                  className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-3.5 py-2 text-xs font-medium text-foreground hover:bg-muted"
                >
                  <Volume2 className="h-4 w-4 text-primary" />
                  <span>Test Voice Audio</span>
                </button>
                <p className="mt-2 text-xs text-muted-foreground">
                  Plays a sample phrase through your browser&apos;s native speech synthesizer.
                </p>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* Tab 4: Profile & Account */}
      {activeTab === "profile" && (
        <section className="data-section border border-border bg-card p-6 max-w-2xl">
          <div className="flex items-center gap-3 pb-4">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-primary text-base font-semibold text-primary-foreground">
              {(displayName || account.email || "U").slice(0, 1).toUpperCase()}
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                {displayName || account.email}
              </h2>
              <p className="text-xs text-muted-foreground">{account.email}</p>
            </div>
          </div>

          <form onSubmit={handleSaveProfile} className="mt-4 space-y-4 border-t border-border pt-4">
            <div className="space-y-1.5">
              <label htmlFor="display-name" className="block text-xs font-medium text-muted-foreground">
                Display Name
              </label>
              <input
                id="display-name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g. Akhil K."
                maxLength={50}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="account-email" className="block text-xs font-medium text-muted-foreground">
                Active Account Email
              </label>
              <input
                id="account-email"
                value={account.email}
                disabled
                className="w-full rounded-md border border-input bg-muted px-3 py-2 text-sm text-muted-foreground cursor-not-allowed"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <button
                type="submit"
                className="rounded-md bg-primary px-4 py-2 text-xs font-medium text-primary-foreground hover:opacity-95"
              >
                Save Profile Name
              </button>

              <button
                type="button"
                onClick={onOpenAuth}
                className="rounded-md border border-border bg-background px-4 py-2 text-xs font-medium text-foreground hover:bg-muted"
              >
                Switch Account / Sign Out
              </button>
            </div>
          </form>
        </section>
      )}

      {/* Tab 5: Data & Backup */}
      {activeTab === "data" && (
        <div className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Export Section */}
            <section className="data-section border border-border bg-card p-6">
              <div className="flex items-center gap-3 pb-4">
                <span className="grid h-10 w-10 place-items-center rounded-lg bg-secondary text-primary">
                  <Download className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="text-lg font-semibold text-foreground">Export Workspace</h2>
                  <p className="text-xs text-muted-foreground">
                    Download full backups of your transactions and budgets.
                  </p>
                </div>
              </div>

              <div className="mt-2 space-y-3">
                <button
                  type="button"
                  onClick={() => exportDataAsJson(transactions, budgets, account.name)}
                  className="flex w-full items-center gap-3 rounded-lg border border-border bg-background p-3 text-left hover:bg-muted transition-colors"
                >
                  <FileJson className="h-4 w-4 text-primary shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-foreground">
                      Download Full JSON Backup
                    </p>
                    <p className="text-[11px] text-muted-foreground tabular-nums">
                      Contains {transactions.length} transactions and {budgets.length} budgets
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => exportTransactionsAsCsv(transactions)}
                  className="flex w-full items-center gap-3 rounded-lg border border-border bg-background p-3 text-left hover:bg-muted transition-colors"
                >
                  <FileSpreadsheet className="h-4 w-4 text-success shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-foreground">Export CSV Spreadsheet</p>
                    <p className="text-[11px] text-muted-foreground">
                      Compatible with Excel, Google Sheets, and Python pandas
                    </p>
                  </div>
                </button>
              </div>
            </section>

            {/* Import Section */}
            <section className="data-section border border-border bg-card p-6">
              <div className="flex items-center gap-3 pb-4">
                <span className="grid h-10 w-10 place-items-center rounded-lg bg-secondary text-primary">
                  <Upload className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="text-lg font-semibold text-foreground">Import Backup File</h2>
                  <p className="text-xs text-muted-foreground">
                    Restore previously exported JSON or CSV files into your active account.
                  </p>
                </div>
              </div>

              <div className="mt-2 space-y-3">
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".json,.csv"
                  className="hidden"
                  onChange={handleFileImport}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-border bg-background text-xs font-medium text-foreground hover:bg-muted transition-colors"
                >
                  <Upload className="h-4 w-4" />
                  <span>Select .json or .csv File</span>
                </button>

                {importSuccess && (
                  <div className="rounded-lg border border-success/30 bg-success/10 p-3 text-xs text-success">
                    {importSuccess}
                  </div>
                )}

                {importError && (
                  <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
                    {importError}
                  </div>
                )}
              </div>
            </section>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <section className="data-section border border-border bg-card p-6">
              <div className="flex items-center gap-3 pb-2">
                <span className="grid h-10 w-10 place-items-center rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400">
                  <RotateCcw className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="text-lg font-semibold text-foreground">Sample Demo Data</h2>
                  <p className="text-xs text-muted-foreground">
                    Restore multi-month MoneyMind AI sample records and budgets.
                  </p>
                </div>
              </div>

              <p className="mt-2 text-xs text-muted-foreground">
                Useful when testing walk-forward forecast models, budget pacing alerts, and AI Q&amp;A.
              </p>

              <div className="mt-4">
                {pendingConfirm === "demo" ? (
                  <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-muted/60 p-2.5 text-xs">
                    <span className="text-foreground font-medium">Replace current ledger with demo records?</span>
                    <button
                      type="button"
                      onClick={() => {
                        onLoadDemoData();
                        setPendingConfirm(null);
                        showToast("Sample demo data loaded");
                      }}
                      className="rounded bg-primary px-2.5 py-1 text-primary-foreground font-medium"
                    >
                      Confirm
                    </button>
                    <button
                      type="button"
                      onClick={() => setPendingConfirm(null)}
                      className="rounded border border-border bg-card px-2.5 py-1 text-foreground"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setPendingConfirm("demo")}
                    className="rounded-md border border-border bg-background px-3.5 py-2 text-xs font-medium text-foreground hover:bg-muted"
                  >
                    Load Sample Transactions &amp; Budgets
                  </button>
                )}
              </div>
            </section>

            <section className="data-section border border-destructive/35 bg-destructive/5 p-6">
              <div className="flex items-center gap-3 pb-2">
                <span className="grid h-10 w-10 place-items-center rounded-lg bg-destructive/15 text-destructive">
                  <AlertTriangle className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="text-lg font-semibold text-destructive">Danger Zone</h2>
                  <p className="text-xs text-muted-foreground">
                    Irreversible actions on your active account records.
                  </p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setPendingConfirm("clear-tx")}
                  className="inline-flex items-center gap-1.5 rounded-md border border-destructive/30 bg-card px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Clear Transactions</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPendingConfirm("clear-bdg")}
                  className="inline-flex items-center gap-1.5 rounded-md border border-destructive/30 bg-card px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Clear Budgets</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPendingConfirm("reset-all")}
                  className="inline-flex items-center gap-1.5 rounded-md bg-destructive px-3 py-1.5 text-xs font-medium text-destructive-foreground hover:opacity-95"
                >
                  <span>Reset Entire Workspace</span>
                </button>
              </div>

              {pendingConfirm && pendingConfirm !== "demo" && (
                <div className="mt-3 flex flex-wrap items-center gap-2 rounded-md border border-destructive/40 bg-card p-2.5 text-xs">
                  <span className="text-destructive font-medium">
                    {pendingConfirm === "clear-tx"
                      ? "Delete all transactions?"
                      : pendingConfirm === "clear-bdg"
                        ? "Delete all budgets?"
                        : "Delete all transactions and budgets?"}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      if (pendingConfirm === "clear-tx") {
                        onClearTransactions();
                        showToast("All transactions cleared");
                      } else if (pendingConfirm === "clear-bdg") {
                        onClearBudgets();
                        showToast("All budgets cleared");
                      } else {
                        onResetAllData();
                        showToast("Workspace reset to blank state");
                      }
                      setPendingConfirm(null);
                    }}
                    className="rounded bg-destructive px-2.5 py-1 text-destructive-foreground font-medium"
                  >
                    Yes, delete
                  </button>
                  <button
                    type="button"
                    onClick={() => setPendingConfirm(null)}
                    className="rounded border border-border bg-background px-2.5 py-1 text-foreground"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </section>
          </div>
        </div>
      )}

      {/* Tab 6: About */}
      {activeTab === "about" && (
        <section className="data-section border border-border bg-card p-6 max-w-2xl">
          <div className="flex items-center gap-3 pb-4">
            <span className="grid h-10 w-10 place-items-center rounded-lg bg-secondary text-primary">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-lg font-semibold text-foreground">MoneyMind AI</h2>
              <p className="text-xs text-muted-foreground">
                Personal Finance Workspace · Deterministic Analytics + Grounded Gemini AI
              </p>
            </div>
          </div>

          <div className="mt-2 space-y-3 text-xs leading-relaxed text-muted-foreground border-t border-border pt-4">
            <p>
              MoneyMind AI combines strict per-account ledger aggregation, local TF-IDF expense
              classification, walk-forward forecast evaluation, and multi-turn Gemini conversations
              strictly grounded in your verified records.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div className="rounded-lg bg-muted/60 p-3">
                <p className="font-semibold text-foreground">Category Classifier</p>
                <p className="mt-0.5">
                  Bundled 516-feature n-gram TF-IDF model + optional Gemini 3.1 Flash-Lite
                </p>
              </div>
              <div className="rounded-lg bg-muted/60 p-3">
                <p className="font-semibold text-foreground">Voice Interface</p>
                <p className="mt-0.5">Native browser Web Speech API with configurable locale &amp; rate</p>
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
};

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 border-b-2 px-3 py-2.5 text-xs font-medium whitespace-nowrap shrink-0 transition-colors sm:text-sm ${
        active
          ? "border-primary text-primary font-semibold"
          : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
