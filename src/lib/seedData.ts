import { AccountProfile, Budget, CategoryName, Transaction } from "../types/finance";

export const EXPENSE_CATEGORIES: CategoryName[] = [
  "Bills",
  "Education",
  "Entertainment",
  "Food",
  "Health",
  "Shopping",
  "Transport",
  "Other",
];

export const INCOME_CATEGORIES: CategoryName[] = [
  "Salary",
  "Freelance",
  "Investment",
  "Refund",
  "Other",
];

export const ALL_CATEGORIES: CategoryName[] = [
  "Bills",
  "Education",
  "Entertainment",
  "Food",
  "Health",
  "Shopping",
  "Transport",
  "Salary",
  "Freelance",
  "Investment",
  "Refund",
  "Other",
];

export const CATEGORY_COLORS: Record<CategoryName, string> = {
  Bills: "#0f766e",
  Education: "#2563eb",
  Entertainment: "#9333ea",
  Food: "#d97706",
  Health: "#16a34a",
  Shopping: "#db2777",
  Transport: "#0284c7",
  Other: "#64748b",
  Salary: "#15803d",
  Freelance: "#0d9488",
  Investment: "#4f46e5",
  Refund: "#65a30d",
};

export const DEFAULT_ACCOUNT: AccountProfile = {
  id: "akhil-demo",
  name: "Akhil K.",
  email: "akhil@moneymind.ai",
  currency: "₹",
};

export const INITIAL_BUDGETS: Budget[] = [
  { id: "BDG-101", category: "ALL", monthlyLimit: 52000 },
  { id: "BDG-102", category: "Bills", monthlyLimit: 24000 },
  { id: "BDG-103", category: "Food", monthlyLimit: 11000 },
  { id: "BDG-104", category: "Transport", monthlyLimit: 5500 },
  { id: "BDG-105", category: "Shopping", monthlyLimit: 7000 },
  { id: "BDG-106", category: "Entertainment", monthlyLimit: 3500 },
  { id: "BDG-107", category: "Health", monthlyLimit: 3000 },
];

export const INITIAL_TRANSACTIONS: Transaction[] = [
  // November 2026
  { id: "TXN-2024", type: "income", date: "2026-11-01", description: "Monthly Tech Payroll Deposit", category: "Salary", amount: 92000, note: "Primary employer salary" },
  { id: "TXN-2023", type: "expense", date: "2026-11-02", description: "House Rent & Maintenance Transfer", category: "Bills", amount: 18500, note: "Apartment monthly rent" },
  { id: "TXN-2022", type: "expense", date: "2026-11-04", description: "BigBasket Weekly Groceries", category: "Food", amount: 3420 },
  { id: "TXN-2021", type: "expense", date: "2026-11-05", description: "BESCOM Electricity Bill", category: "Bills", amount: 2180 },
  { id: "TXN-2020", type: "expense", date: "2026-11-06", description: "ACT Fibernet Broadband", category: "Bills", amount: 1199 },
  { id: "TXN-2019", type: "expense", date: "2026-11-07", description: "Uber Airport & Office Rides", category: "Transport", amount: 1480 },
  { id: "TXN-2018", type: "income", date: "2026-11-08", description: "UI Consulting Sprint Invoice", category: "Freelance", amount: 14500, note: "Client milestone 2" },
  { id: "TXN-2017", type: "expense", date: "2026-11-09", description: "Swiggy Dinner Bowl", category: "Food", amount: 640 },
  { id: "TXN-2016", type: "expense", date: "2026-11-10", description: "Apollo Pharmacy Medicines & Checkup", category: "Health", amount: 1850 },
  { id: "TXN-2015", type: "expense", date: "2026-11-11", description: "Myntra Winter Jacket Purchase", category: "Shopping", amount: 4290 },
  { id: "TXN-2014", type: "expense", date: "2026-11-12", description: "Metro Card Topup & Fuel", category: "Transport", amount: 1950 },
  { id: "TXN-2013", type: "expense", date: "2026-11-13", description: "PVR IMAX Movie Night & Netflix", category: "Entertainment", amount: 1649 },
  { id: "TXN-2012", type: "expense", date: "2026-11-14", description: "Zomato Weekend Team Lunch", category: "Food", amount: 2890 },
  { id: "TXN-2011", type: "expense", date: "2026-11-14", description: "Udemy Systems Engineering Course", category: "Education", amount: 1499 },

  // October 2026
  { id: "TXN-2010", type: "income", date: "2026-10-01", description: "Monthly Tech Payroll Deposit", category: "Salary", amount: 92000 },
  { id: "TXN-2009", type: "expense", date: "2026-10-02", description: "House Rent & Maintenance Transfer", category: "Bills", amount: 18500 },
  { id: "TXN-2008", type: "expense", date: "2026-10-05", description: "Blinkit Groceries & Fruits", category: "Food", amount: 4120 },
  { id: "TXN-2007", type: "expense", date: "2026-10-08", description: "Airtel Postpaid & Broadband", category: "Bills", amount: 1899 },
  { id: "TXN-2006", type: "expense", date: "2026-10-12", description: "Indian Oil Petrol & Ola Cabs", category: "Transport", amount: 4100 },
  { id: "TXN-2005", type: "expense", date: "2026-10-15", description: "Amazon Books & Electronics Order", category: "Shopping", amount: 6450 },
  { id: "TXN-2004", type: "expense", date: "2026-10-18", description: "Swiggy & Chai Point Snacks", category: "Food", amount: 3890 },
  { id: "TXN-2003", type: "expense", date: "2026-10-22", description: "Cult Fit Gym Membership", category: "Health", amount: 2200 },
  { id: "TXN-2002", type: "expense", date: "2026-10-26", description: "Spotify & BookMyShow Concert Tickets", category: "Entertainment", amount: 2950 },

  // September 2026
  { id: "TXN-2001", type: "income", date: "2026-09-01", description: "Monthly Tech Payroll Deposit", category: "Salary", amount: 88000 },
  { id: "TXN-2000", type: "income", date: "2026-09-14", description: "Quarterly Index Fund Dividend", category: "Investment", amount: 5200 },
  { id: "TXN-1999", type: "expense", date: "2026-09-02", description: "House Rent & Maintenance Transfer", category: "Bills", amount: 18500 },
  { id: "TXN-1998", type: "expense", date: "2026-09-06", description: "Tata Power Electricity & Gas", category: "Bills", amount: 2650 },
  { id: "TXN-1997", type: "expense", date: "2026-09-10", description: "BigBasket Monthly Provisions", category: "Food", amount: 5400 },
  { id: "TXN-1996", type: "expense", date: "2026-09-16", description: "IRCTC Train Ticket & Auto", category: "Transport", amount: 3450 },
  { id: "TXN-1995", type: "expense", date: "2026-09-20", description: "Croma Headphones & Phone Cover", category: "Shopping", amount: 4800 },
  { id: "TXN-1994", type: "expense", date: "2026-09-24", description: "Practo Dental Checkup", category: "Health", amount: 1600 },
  { id: "TXN-1993", type: "expense", date: "2026-09-27", description: "Starbucks Coffee & Zomato Dinner", category: "Food", amount: 2740 },

  // August 2026
  { id: "TXN-1992", type: "income", date: "2026-08-01", description: "Monthly Tech Payroll Deposit", category: "Salary", amount: 88000 },
  { id: "TXN-1991", type: "expense", date: "2026-08-02", description: "House Rent & Maintenance Transfer", category: "Bills", amount: 18500 },
  { id: "TXN-1990", type: "expense", date: "2026-08-07", description: "BESCOM Power & Jio Fiber", category: "Bills", amount: 2980 },
  { id: "TXN-1989", type: "expense", date: "2026-08-11", description: "Groceries & Restaurant Dinner", category: "Food", amount: 6900 },
  { id: "TXN-1988", type: "expense", date: "2026-08-17", description: "Rapido & Metro Daily Commute", category: "Transport", amount: 3100 },
  { id: "TXN-1987", type: "expense", date: "2026-08-21", description: "Decathlon Running Shoes", category: "Shopping", amount: 3999 },
  { id: "TXN-1986", type: "expense", date: "2026-08-25", description: "Cloud Certification Exam Fee", category: "Education", amount: 4500 },

  // July 2026
  { id: "TXN-1985", type: "income", date: "2026-07-01", description: "Monthly Tech Payroll Deposit", category: "Salary", amount: 88000 },
  { id: "TXN-1984", type: "expense", date: "2026-07-02", description: "House Rent & Maintenance Transfer", category: "Bills", amount: 18500 },
  { id: "TXN-1983", type: "expense", date: "2026-07-09", description: "Utilities Water & Broadband", category: "Bills", amount: 2450 },
  { id: "TXN-1982", type: "expense", date: "2026-07-14", description: "BigBasket & Swiggy Orders", category: "Food", amount: 6250 },
  { id: "TXN-1981", type: "expense", date: "2026-07-19", description: "Uber Rides & Petrol", category: "Transport", amount: 2850 },
  { id: "TXN-1980", type: "expense", date: "2026-07-24", description: "Flipkart Home Decor & Stationery", category: "Shopping", amount: 3200 },
  { id: "TXN-1979", type: "expense", date: "2026-07-28", description: "Hotstar Subscription & Movies", category: "Entertainment", amount: 1499 },
];
