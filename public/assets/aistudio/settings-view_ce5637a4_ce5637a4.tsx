import { useState, useRef, type ChangeEvent } from "react";
import {
  Settings,
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  CURRENCY_OPTIONS,
  VOICE_LANG_OPTIONS,
  exportDataAsJson,
  exportTransactionsAsCsv,
  parseJsonBackup,
  parseCsvTransactions,
  type WorkspaceSettings,
} from "@/lib/workspace-settings";
import type { FinanceBudget, FinanceTransaction } from "@/lib/finance";

export interface SettingsViewProps {
  settings: WorkspaceSettings;
  onUpdateSettings: (newSettings: WorkspaceSettings) => void;
  user: {
    id?: string;
    email?: string;
    user_metadata?: Record<string, any>;
  };
  onUpdateProfileName: (name: string) => void;
  onSignOut: () => void;
  transactions: FinanceTransaction[];
  budgets: FinanceBudget[];
  onImportData: (transactions: FinanceTransaction[], budgets: FinanceBudget[]) => void;
  onLoadDemoData: () => void;
  onClearTransactions: () => void;
  onClearBudgets: () => void;
  onResetAllData: () => void;
}

type SettingsTab = "general" | "appearance" | "voice" | "profile" | "data" | "about";

export function SettingsView({
  settings,
  onUpdateSettings,
  user,
  onUpdateProfileName,
  onSignOut,
  transactions,
  budgets,
  onImportData,
  onLoadDemoData,
  onClearTransactions,
  onClearBudgets,
  onResetAllData,
}: SettingsViewProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>("general");
  const [displayName, setDisplayName] = useState(
    user.user_metadata?.["full_name"] || user.user_metadata?.["name"] || ""
  );
  const [savedMessage, setSavedMessage] = useState("");
  const [importError, setImportError] = useState("");
  const [importSuccess, setImportSuccess] = useState("");
  const [customCurrency, setCustomCurrency] = useState(
    CURRENCY_OPTIONS.some((c) => c.symbol === settings.currency) ? "" : settings.currency
  );
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const showToast = (msg: string) => {
    setSavedMessage(msg);
    setTimeout(() => setSavedMessage(""), 3000);
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
    showToast(checked ? "Voice answers enabled" : "Voice answers disabled");
  };

  const handleVoiceRateChange = (rate: number) => {
    onUpdateSettings({ ...settings, voiceRate: rate });
    showToast(`Speech rate set to ${rate}x`);
  };

  const handleTestVoice = () => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const text = "Hello! MoneyMind AI voice assistant is working properly.";
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
      showToast("Profile name saved successfully");
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
            `Imported ${parsed.transactions.length} transactions and ${parsed.budgets.length} budgets successfully!`
          );
        } else if (file.name.endsWith(".csv")) {
          const txs = parseCsvTransactions(content);
          if (txs.length === 0) {
            setImportError("No valid transactions found in this CSV file. Ensure columns include Date, Description, and Amount.");
            return;
          }
          onImportData(txs, []);
          setImportSuccess(`Imported ${txs.length} transactions successfully!`);
        } else {
          setImportError("Unsupported file type. Please upload a .json or .csv backup file.");
        }
      } catch (err) {
        setImportError(err instanceof Error ? err.message : "Failed to parse backup file.");
      }
    };
    reader.readAsText(file);
    if (e.target) e.target.value = "";
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Configuration
          </p>
          <h2 className="mt-2 font-display text-2xl font-semibold sm:text-3xl">Settings & Preferences</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Personalize your MoneyMind AI workspace, currency, theme, voice assistant, and backups.
          </p>
        </div>

        {savedMessage && (
          <div className="inline-flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary animate-in fade-in">
            <Check className="size-3.5" />
            {savedMessage}
          </div>
        )}
      </div>

      {/* Tabs navigation */}
      <div className="border-b border-border">
        <div className="flex gap-2 overflow-x-auto pb-px">
          <TabButton
            active={activeTab === "general"}
            onClick={() => setActiveTab("general")}
            icon={<Globe className="size-4" />}
            label="General & Currency"
          />
          <TabButton
            active={activeTab === "appearance"}
            onClick={() => setActiveTab("appearance")}
            icon={<Palette className="size-4" />}
            label="Appearance"
          />
          <TabButton
            active={activeTab === "voice"}
            onClick={() => setActiveTab("voice")}
            icon={<Volume2 className="size-4" />}
            label="AI & Voice"
          />
          <TabButton
            active={activeTab === "profile"}
            onClick={() => setActiveTab("profile")}
            icon={<User className="size-4" />}
            label="Profile & Account"
          />
          <TabButton
            active={activeTab === "data"}
            onClick={() => setActiveTab("data")}
            icon={<Download className="size-4" />}
            label="Data & Backup"
          />
          <TabButton
            active={activeTab === "about"}
            onClick={() => setActiveTab("about")}
            icon={<Info className="size-4" />}
            label="About"
          />
        </div>
      </div>

      {/* Tab 1: General & Currency */}
      {activeTab === "general" && (
        <div className="grid gap-6 md:grid-cols-2">
          <section className="rounded-xl border border-border bg-card p-6 shadow-xs">
            <div className="flex items-center gap-3 pb-4">
              <span className="grid size-10 place-items-center rounded-lg bg-primary/10 text-primary">
                <Globe className="size-5" />
              </span>
              <div>
                <h3 className="font-display text-lg font-semibold">Primary Currency</h3>
                <p className="text-xs text-muted-foreground">Select the currency symbol used across balances and charts.</p>
              </div>
            </div>

            <div className="mt-4 space-y-4">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {CURRENCY_OPTIONS.map((cur) => {
                  const isSelected = settings.currency === cur.symbol;
                  return (
                    <button
                      key={cur.code}
                      type="button"
                      onClick={() => handleCurrencyChange(cur.symbol)}
                      className={`flex items-center justify-between rounded-lg border p-3 text-left transition-all ${
                        isSelected
                          ? "border-primary bg-primary/5 text-primary font-medium ring-1 ring-primary"
                          : "border-border bg-background hover:bg-muted text-foreground"
                      }`}
                    >
                      <span className="text-sm">{cur.label}</span>
                      {isSelected && <Check className="size-4 text-primary" />}
                    </button>
                  );
                })}
              </div>

              <form onSubmit={handleCustomCurrencySubmit} className="pt-2 border-t border-border">
                <Label htmlFor="custom-curr" className="text-xs text-muted-foreground">
                  Or enter custom currency symbol:
                </Label>
                <div className="mt-1.5 flex gap-2">
                  <Input
                    id="custom-curr"
                    value={customCurrency}
                    onChange={(e) => setCustomCurrency(e.target.value)}
                    placeholder="e.g. kr, CHF, R$, ₩"
                    className="h-9 w-36"
                  />
                  <Button type="submit" size="sm" variant="outline">
                    Set Custom
                  </Button>
                </div>
              </form>

              <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
                <p className="font-medium text-foreground">Live Amount Preview:</p>
                <p className="mt-1 text-base font-semibold text-foreground">
                  {settings.currency} 25,450.00
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-border bg-card p-6 shadow-xs">
            <div className="flex items-center gap-3 pb-4">
              <span className="grid size-10 place-items-center rounded-lg bg-primary/10 text-primary">
                <Sparkles className="size-5" />
              </span>
              <div>
                <h3 className="font-display text-lg font-semibold">Workspace Defaults</h3>
                <p className="text-xs text-muted-foreground">Control formatting and default entry dates.</p>
              </div>
            </div>

            <div className="mt-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="date-format" className="text-sm">Date Display Format</Label>
                <select
                  id="date-format"
                  value={settings.dateFormat}
                  onChange={(e) => {
                    const fmt = e.target.value as WorkspaceSettings["dateFormat"];
                    onUpdateSettings({ ...settings, dateFormat: fmt });
                    showToast(`Date format set to ${fmt}`);
                  }}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="YYYY-MM-DD">YYYY-MM-DD (2026-11-15)</option>
                  <option value="DD/MM/YYYY">DD/MM/YYYY (15/11/2026)</option>
                  <option value="MM/DD/YYYY">MM/DD/YYYY (11/15/2026)</option>
                </select>
              </div>

              <div className="space-y-2 pt-2">
                <p className="text-sm font-medium">Automatic Suggestions</p>
                <p className="text-xs text-muted-foreground">
                  Category predictions evaluate description keywords in real-time as you type transactions.
                </p>
                <div className="flex items-center gap-2 rounded-lg bg-muted/40 p-3 text-xs">
                  <ShieldCheck className="size-4 text-success" />
                  <span>All category suggestions run 100% locally in your browser.</span>
                </div>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* Tab 2: Appearance */}
      {activeTab === "appearance" && (
        <section className="rounded-xl border border-border bg-card p-6 shadow-xs">
          <div className="flex items-center gap-3 pb-4">
            <span className="grid size-10 place-items-center rounded-lg bg-primary/10 text-primary">
              <Palette className="size-5" />
            </span>
            <div>
              <h3 className="font-display text-lg font-semibold">Theme & Appearance</h3>
              <p className="text-xs text-muted-foreground">
                Choose between bright daylight, rich dark mode, or follow your operating system.
              </p>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {/* Light Option */}
            <button
              type="button"
              onClick={() => handleThemeChange("light")}
              className={`group flex flex-col items-start rounded-xl border p-5 text-left transition-all ${
                settings.theme === "light"
                  ? "border-primary bg-primary/5 ring-2 ring-primary"
                  : "border-border bg-card hover:bg-muted/60"
              }`}
            >
              <div className="flex w-full items-center justify-between">
                <div className="grid size-10 place-items-center rounded-lg bg-amber-500/10 text-amber-600">
                  <Sun className="size-5" />
                </div>
                {settings.theme === "light" && <Check className="size-4 text-primary" />}
              </div>
              <h4 className="mt-4 font-semibold text-sm">Light Mode</h4>
              <p className="mt-1 text-xs text-muted-foreground">Crisp daylight palette with clear contrast.</p>
            </button>

            {/* Dark Option */}
            <button
              type="button"
              onClick={() => handleThemeChange("dark")}
              className={`group flex flex-col items-start rounded-xl border p-5 text-left transition-all ${
                settings.theme === "dark"
                  ? "border-primary bg-primary/5 ring-2 ring-primary"
                  : "border-border bg-card hover:bg-muted/60"
              }`}
            >
              <div className="flex w-full items-center justify-between">
                <div className="grid size-10 place-items-center rounded-lg bg-indigo-500/10 text-indigo-400">
                  <Moon className="size-5" />
                </div>
                {settings.theme === "dark" && <Check className="size-4 text-primary" />}
              </div>
              <h4 className="mt-4 font-semibold text-sm">Dark Mode</h4>
              <p className="mt-1 text-xs text-muted-foreground">Subtle OKLCH dark slate for low-light environments.</p>
            </button>

            {/* System Option */}
            <button
              type="button"
              onClick={() => handleThemeChange("system")}
              className={`group flex flex-col items-start rounded-xl border p-5 text-left transition-all ${
                settings.theme === "system"
                  ? "border-primary bg-primary/5 ring-2 ring-primary"
                  : "border-border bg-card hover:bg-muted/60"
              }`}
            >
              <div className="flex w-full items-center justify-between">
                <div className="grid size-10 place-items-center rounded-lg bg-emerald-500/10 text-emerald-500">
                  <Monitor className="size-5" />
                </div>
                {settings.theme === "system" && <Check className="size-4 text-primary" />}
              </div>
              <h4 className="mt-4 font-semibold text-sm">System Default</h4>
              <p className="mt-1 text-xs text-muted-foreground">Synchronizes automatically with your OS preference.</p>
            </button>
          </div>
        </section>
      )}

      {/* Tab 3: AI & Voice */}
      {activeTab === "voice" && (
        <div className="grid gap-6 md:grid-cols-2">
          <section className="rounded-xl border border-border bg-card p-6 shadow-xs">
            <div className="flex items-center gap-3 pb-4">
              <span className="grid size-10 place-items-center rounded-lg bg-primary/10 text-primary">
                <Volume2 className="size-5" />
              </span>
              <div>
                <h3 className="font-display text-lg font-semibold">Speech Recognition Language</h3>
                <p className="text-xs text-muted-foreground">Select your spoken accent or native dialect.</p>
              </div>
            </div>

            <div className="mt-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="voice-lang">Language / Locale</Label>
                <select
                  id="voice-lang"
                  value={settings.voiceLang}
                  onChange={(e) => handleVoiceLangChange(e.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  {VOICE_LANG_OPTIONS.map((opt) => (
                    <option key={opt.code} value={opt.code}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">
                  The microphone will prioritize this language model for speech recognition.
                </p>
              </div>

              <div className="border-t border-border pt-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium">Read Answers Aloud</p>
                    <p className="text-xs text-muted-foreground">
                      Automatically synthesize speech when receiving assistant answers.
                    </p>
                  </div>
                  <Switch
                    checked={settings.autoSpeak}
                    onCheckedChange={handleAutoSpeakToggle}
                  />
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-border bg-card p-6 shadow-xs">
            <div className="flex items-center gap-3 pb-4">
              <span className="grid size-10 place-items-center rounded-lg bg-primary/10 text-primary">
                <Sparkles className="size-5" />
              </span>
              <div>
                <h3 className="font-display text-lg font-semibold">Speech Synthesis Voice</h3>
                <p className="text-xs text-muted-foreground">Tune speech playback rate and test audio.</p>
              </div>
            </div>

            <div className="mt-4 space-y-4">
              <div>
                <Label className="text-sm">Voice Speed</Label>
                <div className="mt-2 flex gap-2">
                  {[0.8, 1.0, 1.25].map((rate) => (
                    <button
                      key={rate}
                      type="button"
                      onClick={() => handleVoiceRateChange(rate)}
                      className={`flex-1 rounded-md border py-2 text-xs font-medium transition-colors ${
                        (settings.voiceRate || 1.0) === rate
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-background hover:bg-muted"
                      }`}
                    >
                      {rate === 0.8 ? "0.8x Slower" : rate === 1.0 ? "1.0x Normal" : "1.25x Faster"}
                    </button>
                  ))}
                </div>
              </div>

              <div className="border-t border-border pt-4">
                <Button type="button" variant="outline" size="sm" onClick={handleTestVoice} className="gap-2">
                  <Volume2 className="size-4" />
                  Test Voice Audio
                </Button>
                <p className="mt-2 text-xs text-muted-foreground">
                  Plays a quick sample through your browser's native speech synthesizer.
                </p>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* Tab 4: Profile & Account */}
      {activeTab === "profile" && (
        <section className="rounded-xl border border-border bg-card p-6 shadow-xs max-w-2xl">
          <div className="flex items-center gap-3 pb-4">
            <div className="avatar-chip grid size-12 shrink-0 place-items-center rounded-full bg-primary text-base font-semibold text-primary-foreground">
              {(displayName || user.email || "U").slice(0, 1).toUpperCase()}
            </div>
            <div>
              <h3 className="font-display text-lg font-semibold">
                {displayName || user.email || "Your Account"}
              </h3>
              <p className="text-xs text-muted-foreground">{user.email || "Local private account"}</p>
            </div>
          </div>

          <form onSubmit={handleSaveProfile} className="mt-6 space-y-4 border-t border-border pt-4">
            <div className="space-y-2">
              <Label htmlFor="display-name">Display Name</Label>
              <Input
                id="display-name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g. Akhil"
                maxLength={50}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="account-email">Email Address</Label>
              <Input
                id="account-email"
                value={user.email || ""}
                disabled
                className="bg-muted text-muted-foreground cursor-not-allowed"
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <Button type="submit" size="sm">
                Save Profile Name
              </Button>

              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={onSignOut}
              >
                Sign Out
              </Button>
            </div>
          </form>
        </section>
      )}

      {/* Tab 5: Data & Backup */}
      {activeTab === "data" && (
        <div className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Export Section */}
            <section className="rounded-xl border border-border bg-card p-6 shadow-xs">
              <div className="flex items-center gap-3 pb-4">
                <span className="grid size-10 place-items-center rounded-lg bg-primary/10 text-primary">
                  <Download className="size-5" />
                </span>
                <div>
                  <h3 className="font-display text-lg font-semibold">Export Workspace</h3>
                  <p className="text-xs text-muted-foreground">
                    Download full backups of your transactions and budgets.
                  </p>
                </div>
              </div>

              <div className="mt-4 space-y-3">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full justify-start gap-2 h-11"
                  onClick={() => exportDataAsJson(transactions, budgets, displayName || user.email)}
                >
                  <FileJson className="size-4 text-primary" />
                  <div className="text-left">
                    <p className="text-xs font-semibold">Download Full JSON Backup</p>
                    <p className="text-[11px] text-muted-foreground">
                      Contains {transactions.length} transactions and {budgets.length} budgets
                    </p>
                  </div>
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  className="w-full justify-start gap-2 h-11"
                  onClick={() => exportTransactionsAsCsv(transactions)}
                >
                  <FileSpreadsheet className="size-4 text-emerald-500" />
                  <div className="text-left">
                    <p className="text-xs font-semibold">Export CSV Spreadsheet</p>
                    <p className="text-[11px] text-muted-foreground">
                      Compatible with Microsoft Excel, Google Sheets, and Numbers
                    </p>
                  </div>
                </Button>
              </div>
            </section>

            {/* Import Section */}
            <section className="rounded-xl border border-border bg-card p-6 shadow-xs">
              <div className="flex items-center gap-3 pb-4">
                <span className="grid size-10 place-items-center rounded-lg bg-primary/10 text-primary">
                  <Upload className="size-5" />
                </span>
                <div>
                  <h3 className="font-display text-lg font-semibold">Import Backup File</h3>
                  <p className="text-xs text-muted-foreground">
                    Restore previously exported JSON or CSV files into your workspace.
                  </p>
                </div>
              </div>

              <div className="mt-4 space-y-3">
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".json,.csv"
                  className="hidden"
                  onChange={handleFileImport}
                />
                <Button
                  type="button"
                  variant="outline"
                  className="w-full justify-center gap-2 h-11"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="size-4" />
                  Select .json or .csv File
                </Button>

                {importSuccess && (
                  <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-3 text-xs text-emerald-600 dark:text-emerald-400">
                    {importSuccess}
                  </div>
                )}

                {importError && (
                  <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-xs text-destructive">
                    {importError}
                  </div>
                )}
              </div>
            </section>
          </div>

          {/* Sample Data & Reset Section */}
          <div className="grid gap-6 md:grid-cols-2">
            <section className="rounded-xl border border-border bg-card p-6 shadow-xs">
              <div className="flex items-center gap-3 pb-2">
                <span className="grid size-10 place-items-center rounded-lg bg-amber-500/10 text-amber-600">
                  <RotateCcw className="size-5" />
                </span>
                <div>
                  <h3 className="font-display text-lg font-semibold">Sample Demo Data</h3>
                  <p className="text-xs text-muted-foreground">
                    Populate your workspace with realistic transactions to test charts.
                  </p>
                </div>
              </div>

              <p className="mt-3 text-xs text-muted-foreground">
                Helpful when exploring graphs, spending estimates, and educational machine learning models.
              </p>

              <div className="mt-4">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (window.confirm("Load sample demo data? This will add standard sample transactions.")) {
                      onLoadDemoData();
                      showToast("Sample data loaded successfully");
                    }
                  }}
                >
                  Load Sample Transactions & Budgets
                </Button>
              </div>
            </section>

            {/* Danger Zone */}
            <section className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 shadow-xs">
              <div className="flex items-center gap-3 pb-2">
                <span className="grid size-10 place-items-center rounded-lg bg-destructive/10 text-destructive">
                  <AlertTriangle className="size-5" />
                </span>
                <div>
                  <h3 className="font-display text-lg font-semibold text-destructive">Danger Zone</h3>
                  <p className="text-xs text-muted-foreground">Irreversible actions on your workspace records.</p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:bg-destructive/10"
                  onClick={() => {
                    if (window.confirm("Are you sure you want to delete ALL transactions? This cannot be undone.")) {
                      onClearTransactions();
                      showToast("All transactions cleared");
                    }
                  }}
                >
                  <Trash2 className="size-3.5 mr-1" />
                  Clear Transactions
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:bg-destructive/10"
                  onClick={() => {
                    if (window.confirm("Are you sure you want to delete ALL budgets?")) {
                      onClearBudgets();
                      showToast("All budgets cleared");
                    }
                  }}
                >
                  <Trash2 className="size-3.5 mr-1" />
                  Clear Budgets
                </Button>

                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    if (window.confirm("Reset entire workspace? All transactions and budgets will be deleted.")) {
                      onResetAllData();
                      showToast("Workspace reset to blank state");
                    }
                  }}
                >
                  Reset Entire Workspace
                </Button>
              </div>
            </section>
          </div>
        </div>
      )}

      {/* Tab 6: About */}
      {activeTab === "about" && (
        <section className="rounded-xl border border-border bg-card p-6 shadow-xs max-w-2xl">
          <div className="flex items-center gap-3 pb-4">
            <span className="grid size-10 place-items-center rounded-lg bg-primary/10 text-primary">
              <ShieldCheck className="size-5" />
            </span>
            <div>
              <h3 className="font-display text-lg font-semibold">MoneyMind AI</h3>
              <p className="text-xs text-muted-foreground">Version 2.1.0 · Personal Finance Workspace</p>
            </div>
          </div>

          <div className="mt-4 space-y-3 text-xs leading-relaxed text-muted-foreground border-t border-border pt-4">
            <p>
              MoneyMind AI provides intuitive personal finance tracking, budget alerts, educational machine learning forecasting, and voice assistance.
            </p>
            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="font-semibold text-foreground">Storage Model</p>
                <p className="mt-0.5">Private client-first with instant offline cache & cloud sync</p>
              </div>
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="font-semibold text-foreground">Voice Recognition</p>
                <p className="mt-0.5">Native browser Web Speech API (zero keys required)</p>
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

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
      className={`inline-flex items-center gap-2 border-b-2 px-3 py-2.5 text-xs font-medium transition-all sm:text-sm ${
        active
          ? "border-primary text-primary font-semibold"
          : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
