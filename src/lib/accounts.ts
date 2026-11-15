import { AccountProfile } from "../types/finance";

export const STORAGE_PREFIX = "moneymind_v2";
const ACCOUNTS_REGISTRY_KEY = `${STORAGE_PREFIX}:accounts_registry`;

export interface StoredAccountRecord extends AccountProfile {
  password?: string;
  provider?: "email" | "google";
}

export function normalizeAccountId(email: string): string {
  return email
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "default-user";
}

function readRegistry(): StoredAccountRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(ACCOUNTS_REGISTRY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as StoredAccountRecord[]) : [];
  } catch {
    return [];
  }
}

function writeRegistry(accounts: StoredAccountRecord[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(ACCOUNTS_REGISTRY_KEY, JSON.stringify(accounts));
  } catch {
    // ignore storage errors
  }
}

export function findSavedAccount(email: string): StoredAccountRecord | undefined {
  const clean = email.trim().toLowerCase();
  if (!clean) return undefined;
  return readRegistry().find((a) => a.email.toLowerCase() === clean);
}

export function registerAccount(input: {
  name: string;
  email: string;
  password: string;
  currency?: string;
}): StoredAccountRecord {
  const cleanEmail = input.email.trim().toLowerCase();
  const record: StoredAccountRecord = {
    id: normalizeAccountId(cleanEmail),
    name: input.name.trim() || cleanEmail.split("@")[0],
    email: cleanEmail,
    currency: input.currency || "₹",
    password: input.password,
    provider: "email",
  };
  const list = readRegistry();
  const idx = list.findIndex((a) => a.email.toLowerCase() === cleanEmail);
  if (idx >= 0) {
    list[idx] = { ...list[idx], ...record };
  } else {
    list.push(record);
  }
  writeRegistry(list);
  return record;
}

export function upsertSavedAccount(
  profile: AccountProfile,
  provider?: "email" | "google",
): StoredAccountRecord {
  const cleanEmail = profile.email.trim().toLowerCase();
  const list = readRegistry();
  const idx = list.findIndex(
    (a) => a.email.toLowerCase() === cleanEmail || a.id === profile.id,
  );
  const existing = idx >= 0 ? list[idx] : undefined;
  const merged: StoredAccountRecord = {
    ...existing,
    ...profile,
    email: cleanEmail || profile.email,
    provider: provider ?? existing?.provider ?? "email",
  };
  if (idx >= 0) {
    list[idx] = merged;
  } else {
    list.push(merged);
  }
  writeRegistry(list);
  return merged;
}
