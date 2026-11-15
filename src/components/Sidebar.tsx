import React from "react";
import {
  LayoutDashboard,
  ArrowLeftRight,
  Wallet,
  TrendingUp,
  FlaskConical,
  MessageSquareText,
  Settings,
  Sun,
  Moon,
  LogOut,
  Landmark,
} from "lucide-react";
import { AccountProfile, ViewId } from "../types/finance";
import { formatMonthLabel } from "../lib/finance";

interface SidebarProps {
  activeView: ViewId;
  onSelectView: (view: ViewId) => void;
  availableMonths: string[];
  selectedMonth: string;
  onSelectMonth: (month: string) => void;
  isDark: boolean;
  onToggleTheme: () => void;
  account: AccountProfile;
  onOpenAuth: () => void;
}

const NAV_ITEMS: Array<{
  id: ViewId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "transactions", label: "Transactions", icon: ArrowLeftRight },
  { id: "budgets", label: "Budgets", icon: Wallet },
  { id: "insights", label: "Insights & Forecast", icon: TrendingUp },
  { id: "model-lab", label: "Model Lab", icon: FlaskConical },
  { id: "assistant", label: "AI Assistant", icon: MessageSquareText },
  { id: "settings", label: "Settings", icon: Settings },
];

export const Sidebar: React.FC<SidebarProps> = ({
  activeView,
  onSelectView,
  availableMonths,
  selectedMonth,
  onSelectMonth,
  isDark,
  onToggleTheme,
  account,
  onOpenAuth,
}) => {
  return (
    <>
      {/* Desktop Left Navigation Rail */}
      <aside className="side-rail hidden md:flex md:w-64 md:shrink-0 md:flex-col border-r border-border">
        <div className="px-5 py-5 border-b border-border flex items-center gap-3">
          <div className="brand-mark grid h-9 w-9 place-items-center rounded-lg bg-primary text-primary-foreground shrink-0">
            <Landmark className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="font-semibold text-base tracking-tight text-foreground truncate">
              MoneyMind AI
            </div>
            <div className="text-[11px] uppercase tracking-[0.1em] text-muted-foreground truncate">
              Personal Finance
            </div>
          </div>
        </div>

        <div className="px-4 pt-4 pb-2">
          <label
            htmlFor="month-scope-desktop"
            className="block text-[11px] font-medium text-muted-foreground mb-1.5"
          >
            Reporting period
          </label>
          <select
            id="month-scope-desktop"
            value={selectedMonth}
            onChange={(e) => onSelectMonth(e.target.value)}
            className="w-full rounded-md border border-input bg-card px-3 py-2 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {availableMonths.map((m) => (
              <option key={m} value={m}>
                {formatMonthLabel(m)}
              </option>
            ))}
            <option value="all">All recorded months</option>
          </select>
        </div>

        <nav className="flex-1 px-3 py-3 space-y-1" aria-label="Primary navigation">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectView(item.id)}
                className={`nav-item w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap shrink-0 text-left ${
                  active
                    ? "nav-item-active"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/70"
                }`}
              >
                <Icon className="shrink-0" />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-border space-y-3">
          <button
            type="button"
            onClick={onToggleTheme}
            className="w-full flex items-center justify-between px-3 py-2 rounded-md border border-border bg-card text-xs font-medium text-foreground hover:bg-muted transition-colors whitespace-nowrap"
          >
            <span>{isDark ? "Light appearance" : "Dark appearance"}</span>
            {isDark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
          </button>

          <div className="flex items-center justify-between gap-2 pt-1">
            <div className="min-w-0">
              <div className="text-xs font-semibold text-foreground truncate">{account.name}</div>
              <div className="text-[11px] text-muted-foreground truncate">{account.email}</div>
            </div>
            <button
              type="button"
              onClick={onOpenAuth}
              title="Switch account or sign out"
              aria-label="Switch account or sign out"
              className="icon-button shrink-0"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Compact Header + Navigation */}
      <div className="md:hidden border-b border-border bg-card">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="brand-mark grid h-8 w-8 place-items-center rounded-md bg-primary text-primary-foreground shrink-0">
              <Landmark className="h-4 w-4" />
            </div>
            <span className="font-semibold text-sm text-foreground truncate">MoneyMind AI</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <select
              aria-label="Reporting period"
              value={selectedMonth}
              onChange={(e) => onSelectMonth(e.target.value)}
              className="rounded-md border border-input bg-background px-2 py-1.5 text-xs font-medium text-foreground"
            >
              {availableMonths.map((m) => (
                <option key={m} value={m}>
                  {formatMonthLabel(m)}
                </option>
              ))}
              <option value="all">All months</option>
            </select>
            <button
              type="button"
              onClick={onToggleTheme}
              aria-label="Toggle theme"
              className="icon-button"
            >
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={onOpenAuth}
              aria-label="Account sign in"
              className="icon-button"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>

        <nav
          className="mobile-nav flex overflow-x-auto border-t border-border px-2"
          aria-label="Mobile navigation"
        >
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectView(item.id)}
                className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                  active ? "nav-item-active" : "text-muted-foreground"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </>
  );
};
