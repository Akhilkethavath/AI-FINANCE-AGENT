export type TransactionType = "income" | "expense";

export type CategoryName =
  | "Bills"
  | "Education"
  | "Entertainment"
  | "Food"
  | "Health"
  | "Shopping"
  | "Transport"
  | "Other"
  | "Salary"
  | "Freelance"
  | "Investment"
  | "Refund";

export type BudgetCategory = "ALL" | CategoryName;

export interface Transaction {
  id: string;
  type: TransactionType;
  date: string; // YYYY-MM-DD
  description: string;
  category: CategoryName;
  amount: number;
  note?: string;
}

export interface Budget {
  id: string;
  category: BudgetCategory;
  monthlyLimit: number;
}

export interface AccountProfile {
  id: string;
  name: string;
  email: string;
  currency: string;
}

export type ViewId =
  | "overview"
  | "transactions"
  | "budgets"
  | "insights"
  | "model-lab"
  | "assistant"
  | "settings";

export type ChatRoleId = "advisor" | "strategist" | "analyst";

export type GeminiModelId = "gemini-4-hydrogen" | "gemini-3.1-flash-lite";

export interface ChatMessage {
  id: string;
  role: "user" | "model";
  text: string;
  timestamp: string;
  model?: GeminiModelId;
}
