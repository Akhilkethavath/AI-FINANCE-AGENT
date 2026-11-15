import React, { useState } from "react";
import { Loader2, CheckCircle2 } from "lucide-react";
import { AccountProfile } from "../types/finance";
import {
  findSavedAccount,
  normalizeAccountId,
  registerAccount,
  upsertSavedAccount,
} from "../lib/accounts";
import { signInWithGooglePopup } from "../lib/firebaseAuth";

interface AuthScreenProps {
  currentAccount: AccountProfile;
  onAuthenticate: (profile: AccountProfile) => void;
}

function GoogleLogo({ className = "h-4 w-4 shrink-0" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

export const AuthScreen: React.FC<AuthScreenProps> = ({
  currentAccount,
  onAuthenticate,
}) => {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [suggestSignup, setSuggestSignup] = useState(false);
  const [suggestSignin, setSuggestSignin] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleContinueWithGoogle = async () => {
    setError(null);
    setNotice(null);
    setSuggestSignup(false);
    setSuggestSignin(false);
    setGoogleLoading(true);
    try {
      const googleUser = await signInWithGooglePopup();
      const existing = findSavedAccount(googleUser.email);
      const profile: AccountProfile = {
        id: existing?.id || normalizeAccountId(googleUser.email),
        name: googleUser.name,
        email: googleUser.email,
        currency: existing?.currency || currentAccount.currency || "₹",
      };
      upsertSavedAccount(profile, "google");
      onAuthenticate(profile);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Google sign-in failed. Please try again.",
      );
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setSuggestSignup(false);
    setSuggestSignin(false);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    const existing = findSavedAccount(cleanEmail);

    if (mode === "signup") {
      if (existing?.password) {
        setError(`An account for ${cleanEmail} already exists. Please sign in instead.`);
        setSuggestSignin(true);
        return;
      }
      if (password !== confirmPassword) {
        setError("Passwords do not match. Please re-enter the same password.");
        return;
      }
      const displayName = name.trim() || cleanEmail.split("@")[0] || "Account Holder";
      registerAccount({
        name: displayName,
        email: cleanEmail,
        password,
        currency: currentAccount.currency || "₹",
      });
      setMode("signin");
      setName("");
      setEmail(cleanEmail);
      setPassword("");
      setConfirmPassword("");
      setNotice(`Account created for ${cleanEmail}. Now sign in to open your workspace.`);
      return;
    }

    if (!existing) {
      setError(`No account found for ${cleanEmail}. Please create an account first, then sign in.`);
      setSuggestSignup(true);
      return;
    }

    if (existing.provider === "google" && !existing.password) {
      setError(
        "This email uses Google Sign-In. Use Continue with Google, or set a password under Create Account.",
      );
      return;
    }

    if (existing.password && existing.password !== password) {
      setError("Incorrect password for this account. Please try again.");
      return;
    }

    const profile: AccountProfile = {
      id: existing.id || normalizeAccountId(cleanEmail),
      name:
        existing.name ||
        (cleanEmail === currentAccount.email ? currentAccount.name : cleanEmail.split("@")[0]),
      email: cleanEmail,
      currency: existing.currency || currentAccount.currency || "₹",
    };
    upsertSavedAccount(profile, "email");
    onAuthenticate(profile);
  };

  return (
    <div className="auth-screen min-h-screen grid grid-cols-1 lg:grid-cols-2">
      {/* Left Editorial Story Panel */}
      <div className="auth-story relative hidden lg:flex flex-col justify-between p-12 border-r border-border overflow-hidden">
        <div className="auth-story-art" aria-hidden="true">
          <div className="art-grid" />
          <div className="art-column art-column-one" />
          <div className="art-column art-column-two" />
          <div className="art-column art-column-three" />
          <div className="art-column art-column-four" />
          <div className="art-trend">
            <svg viewBox="0 0 400 180" preserveAspectRatio="none">
              <path d="M 0 150 Q 90 135, 170 110 T 320 55 T 400 22" />
              <path
                className="trend-area"
                d="M 0 150 Q 90 135, 170 110 T 320 55 T 400 22 L 400 180 L 0 180 Z"
              />
            </svg>
          </div>
        </div>

        <div className="relative z-10 flex items-center gap-3">
          <img
            src="/assets/aistudio/image_0b060783_0b060783.png"
            alt="MoneyMind AI logo"
            referrerPolicy="no-referrer"
            className="h-10 w-10 rounded-xl object-cover shadow-xs shrink-0"
          />
          <div>
            <div className="text-lg font-semibold text-foreground">MoneyMind AI</div>
            <div className="text-xs text-muted-foreground">Personal Finance Workspace</div>
          </div>
        </div>

        <div className="relative z-10 max-w-md space-y-4 my-auto">
          <h1 className="text-4xl font-semibold tracking-tight text-foreground leading-tight">
            Deterministic ledger math, paired with grounded AI clarity.
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Every account keeps an isolated transaction ledger, category budgets, local TF-IDF
            expense classification, walk-forward forecasting, and a grounded Gemini assistant.
          </p>
        </div>

        <div className="relative z-10 text-xs text-muted-foreground">
          Private per-account workspace · Deterministic calculations
        </div>
      </div>

      {/* Right Auth Form */}
      <div className="flex flex-col justify-center p-6 sm:p-12 lg:p-16">
        <div className="w-full max-w-md mx-auto space-y-6">
          <div className="flex items-center gap-3.5">
            <img
              src="/assets/aistudio/image_0b060783_0b060783.png"
              alt="MoneyMind AI logo"
              referrerPolicy="no-referrer"
              className="h-11 w-11 rounded-xl object-cover shadow-xs shrink-0"
            />
            <div>
              <h2 className="text-2xl font-semibold text-foreground">
                {mode === "signin" ? "MoneyMind AI" : "Create Account"}
              </h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                {mode === "signin"
                  ? "Sign in to access your personal finance workspace."
                  : "Create an account, then sign in to open your workspace."}
              </p>
            </div>
          </div>

          <div className="segmented-control grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
            <button
              type="button"
              onClick={() => {
                setMode("signin");
                setError(null);
                setNotice(null);
                setSuggestSignup(false);
                setSuggestSignin(false);
              }}
              className={mode === "signin" ? "selected font-medium" : ""}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("signup");
                setError(null);
                setNotice(null);
                setSuggestSignup(false);
                setSuggestSignin(false);
              }}
              className={mode === "signup" ? "selected font-medium" : ""}
            >
              Create Account
            </button>
          </div>

          {notice && (
            <div className="flex items-start gap-2 rounded-md border border-primary/30 bg-secondary px-4 py-2.5 text-xs text-primary">
              <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{notice}</span>
            </div>
          )}

          {error && (
            <div className="auth-message border border-destructive/40 bg-destructive/10 px-4 py-2.5 text-xs text-destructive space-y-2">
              <div>{error}</div>
              {suggestSignup && (
                <button
                  type="button"
                  onClick={() => {
                    setMode("signup");
                    setPassword("");
                    setConfirmPassword("");
                    setError(null);
                    setSuggestSignup(false);
                  }}
                  className="font-semibold underline text-foreground hover:text-primary"
                >
                  Create an account now
                </button>
              )}
              {suggestSignin && (
                <button
                  type="button"
                  onClick={() => {
                    setMode("signin");
                    setPassword("");
                    setConfirmPassword("");
                    setError(null);
                    setSuggestSignin(false);
                  }}
                  className="font-semibold underline text-foreground hover:text-primary"
                >
                  Go to Sign In
                </button>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={handleContinueWithGoogle}
            disabled={googleLoading}
            className="w-full inline-flex items-center justify-center gap-3 rounded-md border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-60"
          >
            {googleLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <GoogleLogo />}
            <span>{googleLoading ? "Opening Google accounts..." : "Continue with Google"}</span>
          </button>

          <div className="auth-divider flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            <div>or continue with email</div>
            <span className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "signup" && (
              <div>
                <label
                  htmlFor="auth-name"
                  className="block text-xs font-medium text-muted-foreground mb-1.5"
                >
                  Full Name
                </label>
                <input
                  id="auth-name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your full name"
                  className="w-full rounded-md border border-input bg-card px-3.5 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            )}

            <div>
              <label
                htmlFor="auth-email"
                className="block text-xs font-medium text-muted-foreground mb-1.5"
              >
                Email Address
              </label>
              <input
                id="auth-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-md border border-input bg-card px-3.5 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div>
              <label
                htmlFor="auth-password"
                className="block text-xs font-medium text-muted-foreground mb-1.5"
              >
                Password
              </label>
              <input
                id="auth-password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                className="w-full rounded-md border border-input bg-card px-3.5 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            {mode === "signup" && (
              <div>
                <label
                  htmlFor="auth-confirm-password"
                  className="block text-xs font-medium text-muted-foreground mb-1.5"
                >
                  Re-enter Password
                </label>
                <input
                  id="auth-confirm-password"
                  type="password"
                  required
                  minLength={6}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm your password"
                  className="w-full rounded-md border border-input bg-card px-3.5 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            )}

            <button
              type="submit"
              className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-95 transition-opacity"
            >
              {mode === "signin" ? "Sign In" : "Create Account"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
