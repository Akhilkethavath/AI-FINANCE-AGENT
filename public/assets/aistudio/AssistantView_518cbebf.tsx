import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Send,
  RotateCcw,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Bot,
  User,
  ShieldCheck,
} from "lucide-react";
import {
  AccountProfile,
  Budget,
  ChatMessage,
  ChatRoleId,
  GeminiModelId,
  Transaction,
} from "../types/finance";
import {
  buildFinanceContextSummary,
  calculateMonthMetrics,
  formatCurrency,
  formatMonthLabel,
} from "../lib/finance";
import type { WorkspaceSettings } from "../lib/workspace-settings";

interface AssistantViewProps {
  account: AccountProfile;
  transactions: Transaction[];
  budgets: Budget[];
  selectedMonth: string;
  settings: WorkspaceSettings;
}

const ROLE_OPTIONS: Array<{ id: ChatRoleId; label: string; description: string }> = [
  {
    id: "advisor",
    label: "Personal Finance Advisor",
    description: "Balanced guidance grounded in your live income, expenses, and transactions.",
  },
  {
    id: "strategist",
    label: "Budget & Cashflow Strategist",
    description: "Focused on category limits, pacing warnings, and savings rate improvement.",
  },
  {
    id: "analyst",
    label: "Data & Forecast Analyst",
    description: "Explains month-over-month deltas, variance, and walk-forward forecasts.",
  },
];

interface SpeechRecognitionAlternativeLike {
  transcript: string;
}
interface SpeechRecognitionResultLike {
  0: SpeechRecognitionAlternativeLike;
}
interface SpeechRecognitionEventLike {
  results: ArrayLike<SpeechRecognitionResultLike>;
}
interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

export const AssistantView: React.FC<AssistantViewProps> = ({
  account,
  transactions,
  budgets,
  selectedMonth,
  settings,
}) => {
  const [roleId, setRoleId] = useState<ChatRoleId>("advisor");
  const [model, setModel] = useState<GeminiModelId>("gemini-4-hydrogen");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const [autoSpeakLocal, setAutoSpeakLocal] = useState(settings.autoSpeak);

  const threadEndRef = useRef<HTMLDivElement | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    setAutoSpeakLocal(settings.autoSpeak);
  }, [settings.autoSpeak]);

  const currency = settings.currency || "₹";

  const starterPrompts = useMemo(
    () => [
      "Summarize my income, expenses, and savings rate for this period.",
      "Which budget categories are closest to their monthly limit?",
      "Break down my top 3 expense categories and cite transaction IDs.",
      `How can I realistically raise my monthly savings by ${formatCurrency(2500, currency)}?`,
    ],
    [currency],
  );

  const financeContext = useMemo(
    () =>
      buildFinanceContextSummary(
        account.name,
        account.email,
        transactions,
        budgets,
        selectedMonth,
        currency,
      ),
    [account.name, account.email, transactions, budgets, selectedMonth, currency],
  );

  const metrics = useMemo(
    () => calculateMonthMetrics(transactions, selectedMonth),
    [transactions, selectedMonth],
  );

  // Clear in-memory conversation on account or month transitions to avoid stale/cross-account answers
  useEffect(() => {
    setMessages([]);
    setErrorMsg(null);
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      setSpeakingMessageId(null);
    }
  }, [account.id, selectedMonth]);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isStreaming]);

  const speakTextMessage = (msgId: string, text: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window) || !text.trim()) return;
    window.speechSynthesis.cancel();
    const cleanSpoken = text.replace(/[#*_`]/g, " ").replace(/\s+/g, " ").trim();
    const utterance = new SpeechSynthesisUtterance(cleanSpoken);
    utterance.rate = settings.voiceRate || 1.0;
    if (settings.voiceLang && settings.voiceLang !== "auto") {
      utterance.lang = settings.voiceLang;
    }
    utterance.onend = () => setSpeakingMessageId(null);
    utterance.onerror = () => setSpeakingMessageId(null);
    setSpeakingMessageId(msgId);
    window.speechSynthesis.speak(utterance);
  };

  const sendMessage = async (textOverride?: string) => {
    const promptText = (textOverride ?? input).trim();
    if (!promptText || isStreaming) return;

    setErrorMsg(null);
    const userMsg: ChatMessage = {
      id: `msg-u-${Date.now()}`,
      role: "user",
      text: promptText,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    const assistantMsgId = `msg-m-${Date.now() + 1}`;
    const placeholderAssistant: ChatMessage = {
      id: assistantMsgId,
      role: "model",
      text: "",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      model,
    };

    const nextHistory = [...messages, userMsg];
    setMessages([...nextHistory, placeholderAssistant]);
    if (!textOverride) setInput("");
    setIsStreaming(true);

    try {
      const response = await fetch("/api/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextHistory.map((m) => ({ role: m.role, text: m.text })),
          roleId,
          model,
          financeContext,
        }),
      });

      if (!response.ok) {
        const errBody = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(errBody.error || `Request failed with status ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("Streaming response is not available in this browser.");
      }

      const decoder = new TextDecoder();
      let buffer = "";
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const payloadStr = line.slice(6).trim();
          if (!payloadStr) continue;
          const payload = JSON.parse(payloadStr) as {
            text?: string;
            error?: string;
            done?: boolean;
          };

          if (payload.error) {
            throw new Error(payload.error);
          }

          if (payload.text) {
            accumulated += payload.text;
            setMessages((prev) =>
              prev.map((m) => (m.id === assistantMsgId ? { ...m, text: accumulated } : m)),
            );
          }
        }
      }

      if (autoSpeakLocal && accumulated.trim()) {
        speakTextMessage(assistantMsgId, accumulated);
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unable to reach the Gemini assistant right now.";
      setErrorMsg(message);
      setMessages((prev) => prev.filter((m) => m.id !== assistantMsgId || m.text.length > 0));
    } finally {
      setIsStreaming(false);
    }
  };

  const handleToggleVoiceInput = () => {
    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
      return;
    }

    const win = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };
    const SpeechRec = win.SpeechRecognition || win.webkitSpeechRecognition;
    if (!SpeechRec) {
      setErrorMsg("Voice input is not supported in this browser.");
      return;
    }

    const rec = new SpeechRec();
    rec.lang =
      settings.voiceLang && settings.voiceLang !== "auto"
        ? settings.voiceLang
        : navigator.language || "en-IN";
    rec.interimResults = false;
    rec.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript ?? "";
      if (transcript) {
        setInput((prev) => (prev ? `${prev} ${transcript}` : transcript));
      }
    };
    rec.onerror = () => setIsListening(false);
    rec.onend = () => setIsListening(false);
    recognitionRef.current = rec;
    setIsListening(true);
    rec.start();
  };

  const handleReadAloud = (msg: ChatMessage) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    if (speakingMessageId === msg.id) {
      window.speechSynthesis.cancel();
      setSpeakingMessageId(null);
      return;
    }
    speakTextMessage(msg.id, msg.text);
  };

  const periodLabel =
    selectedMonth === "all" ? "All Recorded Months" : formatMonthLabel(selectedMonth);

  const activeRole = ROLE_OPTIONS.find((r) => r.id === roleId) ?? ROLE_OPTIONS[0];

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground">
            AI Assistant
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Multi-turn Gemini conversation grounded strictly in your verified ledger records
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <div className="segmented-control inline-flex items-center gap-1 rounded-lg bg-muted p-1">
            <button
              type="button"
              onClick={() => setModel("gemini-4-hydrogen")}
              className={`px-3 py-1 text-xs font-medium whitespace-nowrap ${
                model === "gemini-4-hydrogen" ? "selected" : ""
              }`}
            >
              Gemini 4 Hydrogen
            </button>
            <button
              type="button"
              onClick={() => setModel("gemini-3.1-flash-lite")}
              className={`px-3 py-1 text-xs font-medium whitespace-nowrap ${
                model === "gemini-3.1-flash-lite" ? "selected" : ""
              }`}
            >
              3.1 Flash-Lite
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              const next = !autoSpeakLocal;
              setAutoSpeakLocal(next);
              if (!next && typeof window !== "undefined" && "speechSynthesis" in window) {
                window.speechSynthesis.cancel();
                setSpeakingMessageId(null);
              }
            }}
            aria-pressed={autoSpeakLocal}
            className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
              autoSpeakLocal
                ? "border-primary bg-secondary text-primary"
                : "border-border bg-card text-foreground hover:bg-muted"
            }`}
          >
            {autoSpeakLocal ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
            <span>{autoSpeakLocal ? "Auto-voice on" : "Auto-voice off"}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setMessages([]);
              setErrorMsg(null);
            }}
            disabled={messages.length === 0 || isStreaming}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-2 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50 whitespace-nowrap shrink-0"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>New Thread</span>
          </button>
        </div>
      </header>

      {/* Main Split: Grounding & Role Panel + Multi-Turn Chat Thread */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Context & Role Panel */}
        <aside className="lg:col-span-4 space-y-4">
          <div className="assistant-panel border border-border bg-card p-5 space-y-3">
            <div className="text-xs font-semibold text-foreground">Assistant Role</div>
            <div className="space-y-2">
              {ROLE_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setRoleId(opt.id)}
                  className={`w-full text-left rounded-md border p-3 transition-colors ${
                    roleId === opt.id
                      ? "border-primary bg-secondary/70"
                      : "border-border bg-background hover:bg-muted/50"
                  }`}
                >
                  <div className="text-xs font-semibold text-foreground">{opt.label}</div>
                  <div className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                    {opt.description}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="assistant-panel border border-border bg-card p-5 space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
              <ShieldCheck className="h-4 w-4 text-primary" />
              <span>Verified Grounding Context</span>
            </div>
            <div className="text-xs text-muted-foreground space-y-1.5 tabular-nums">
              <div className="flex justify-between">
                <span>Account</span>
                <span className="font-medium text-foreground truncate max-w-[160px]">
                  {account.name}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Period</span>
                <span className="font-medium text-foreground">{periodLabel}</span>
              </div>
              <div className="flex justify-between">
                <span>Income</span>
                <span className="font-medium text-foreground">
                  {formatCurrency(metrics.income, currency)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Expenses</span>
                <span className="font-medium text-foreground">
                  {formatCurrency(metrics.expenses, currency)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Net Balance</span>
                <span className="font-medium text-foreground">
                  {formatCurrency(metrics.balance, currency)}
                </span>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground pt-1 border-t border-border leading-relaxed">
              Figures are computed deterministically from your ledger and injected into each turn so
              Gemini never invents amounts.
            </p>
          </div>
        </aside>

        {/* Right Scrollable Multi-Turn Conversation */}
        <section className="lg:col-span-8 assistant-panel border border-border bg-card flex flex-col h-[620px]">
          <div className="px-5 py-3.5 border-b border-border flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-foreground truncate">
                {activeRole.label}
              </div>
              <div className="text-xs text-muted-foreground truncate">
                {model === "gemini-4-hydrogen"
                  ? "Using gemini-4-hydrogen · Deep conversational reasoning"
                  : "Using gemini-3.1-flash-lite · Low-latency quick answers"}
              </div>
            </div>
            <div className="text-xs text-muted-foreground tabular-nums shrink-0">
              {messages.length} {messages.length === 1 ? "message" : "messages"}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col justify-center items-center text-center max-w-md mx-auto space-y-4 py-6">
                <div className="grid h-11 w-11 place-items-center rounded-lg bg-secondary text-primary">
                  <Bot className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-foreground">
                    Ask about your {periodLabel} ledger
                  </h2>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    Conversation history is maintained across turns and scoped to your active account
                    and reporting month.
                  </p>
                </div>
                <div className="w-full space-y-2 pt-2">
                  {starterPrompts.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => sendMessage(prompt)}
                      className="w-full text-left rounded-md border border-border bg-background px-3.5 py-2.5 text-xs text-foreground hover:bg-muted transition-colors"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((msg) => {
                const isUser = msg.role === "user";
                return (
                  <div
                    key={msg.id}
                    className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}
                  >
                    {!isUser && (
                      <div className="grid h-8 w-8 place-items-center rounded-md bg-secondary text-primary shrink-0 mt-0.5">
                        <Bot className="h-4 w-4" />
                      </div>
                    )}

                    <div
                      className={`assistant-bubble max-w-[85%] px-4 py-3 text-sm leading-relaxed ${
                        isUser
                          ? "bg-primary text-primary-foreground"
                          : "border border-border bg-background text-foreground"
                      }`}
                    >
                      <div className="whitespace-pre-wrap break-words">
                        {msg.text || (isStreaming ? "Analyzing your ledger..." : "")}
                      </div>

                      <div
                        className={`flex items-center justify-between gap-3 mt-2 pt-1.5 text-[11px] ${
                          isUser ? "text-primary-foreground/75" : "text-muted-foreground"
                        }`}
                      >
                        <span className="tabular-nums">
                          {msg.timestamp}
                          {!isUser && msg.model ? ` · ${msg.model}` : ""}
                        </span>

                        {!isUser && msg.text && (
                          <button
                            type="button"
                            onClick={() => handleReadAloud(msg)}
                            aria-label={
                              speakingMessageId === msg.id ? "Stop reading aloud" : "Read aloud"
                            }
                            className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
                          >
                            {speakingMessageId === msg.id ? (
                              <>
                                <VolumeX className="h-3.5 w-3.5" />
                                <span>Stop</span>
                              </>
                            ) : (
                              <>
                                <Volume2 className="h-3.5 w-3.5" />
                                <span>Listen</span>
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </div>

                    {isUser && (
                      <div className="grid h-8 w-8 place-items-center rounded-md bg-muted text-foreground shrink-0 mt-0.5">
                        <User className="h-4 w-4" />
                      </div>
                    )}
                  </div>
                );
              })
            )}
            <div ref={threadEndRef} />
          </div>

          {errorMsg && (
            <div className="mx-5 mb-2 rounded-md border border-destructive/40 bg-destructive/10 px-3.5 py-2 text-xs text-destructive">
              {errorMsg}
            </div>
          )}

          {/* Composer */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendMessage();
            }}
            className="p-4 border-t border-border flex items-center gap-2.5"
          >
            <button
              type="button"
              onClick={handleToggleVoiceInput}
              aria-label={isListening ? "Stop voice input" : "Start voice input"}
              title={isListening ? "Stop voice input" : "Speak question"}
              className={`icon-button border border-border shrink-0 ${
                isListening ? "bg-destructive/15 text-destructive" : "bg-background"
              }`}
            >
              {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </button>

            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about spending, budgets, transaction IDs, or next month's forecast..."
              disabled={isStreaming}
              className="flex-1 rounded-md border border-input bg-background px-3.5 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />

            <button
              type="submit"
              disabled={!input.trim() || isStreaming}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-95 disabled:opacity-50 whitespace-nowrap shrink-0"
            >
              <Send className="h-3.5 w-3.5" />
              <span>{isStreaming ? "Thinking..." : "Send"}</span>
            </button>
          </form>
        </section>
      </div>
    </div>
  );
};
