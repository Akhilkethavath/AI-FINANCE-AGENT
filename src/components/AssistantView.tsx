import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Send,
  RotateCcw,
  Mic,
  MicOff,
  Square,
  Volume2,
  VolumeX,
  Bot,
  User,
  ShieldCheck,
  Loader2,
  RefreshCw,
  AlertCircle,
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
  isFinal?: boolean;
  0: SpeechRecognitionAlternativeLike;
}
interface SpeechRecognitionEventLike {
  resultIndex?: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
}
interface SpeechRecognitionErrorEventLike {
  error?: string;
  message?: string;
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort?: () => void;
}

type VoiceStatus = "idle" | "listening-browser" | "recording-gemini" | "transcribing";
type VoiceEnginePref = "auto" | "gemini";

function normalizeErrorMessage(raw: string): string {
  let text = (raw || "").trim();
  for (let i = 0; i < 3; i++) {
    if (!text.startsWith("{")) break;
    try {
      const parsed = JSON.parse(text) as {
        error?: { message?: string; code?: number; status?: string };
        message?: string;
      };
      const next = parsed.error?.message || parsed.message;
      if (next && next.trim()) {
        text = next.trim();
      } else {
        break;
      }
    } catch {
      break;
    }
  }
  if (/503|UNAVAILABLE|high demand|overloaded/i.test(text)) {
    return "The AI model is experiencing high demand right now. Please retry or switch to 3.1 Flash-Lite.";
  }
  if (/429|RESOURCE_EXHAUSTED|rate limit/i.test(text)) {
    return "Rate limit reached temporarily. Please wait a few seconds and retry.";
  }
  return text || "Unable to reach the AI assistant right now.";
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      const base64 = result.includes(",") ? result.split(",").pop() || "" : result;
      resolve(base64);
    };
    reader.onerror = () => reject(new Error("Failed to read recorded audio."));
    reader.readAsDataURL(blob);
  });
}

function pickRecorderMimeType(): string {
  if (typeof MediaRecorder === "undefined" || typeof MediaRecorder.isTypeSupported !== "function") {
    return "audio/webm";
  }
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
    "audio/ogg",
  ];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) || "audio/webm";
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
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
  const [fallbackNotice, setFallbackNotice] = useState<string | null>(null);
  const [failedPrompt, setFailedPrompt] = useState<string | null>(null);

  const [voiceStatus, setVoiceStatus] = useState<VoiceStatus>("idle");
  const [voiceEnginePref, setVoiceEnginePref] = useState<VoiceEnginePref>(() => {
    if (typeof window === "undefined") return "auto";
    const win = window as unknown as {
      SpeechRecognition?: unknown;
      webkitSpeechRecognition?: unknown;
    };
    return win.SpeechRecognition || win.webkitSpeechRecognition ? "auto" : "gemini";
  });
  const [interimTranscript, setInterimTranscript] = useState("");
  const [recordingSeconds, setRecordingSeconds] = useState(0);

  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const [autoSpeakLocal, setAutoSpeakLocal] = useState(settings.autoSpeak);

  const threadEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const voiceBaseInputRef = useRef<string>("");
  const browserSpeechHadResultRef = useRef<boolean>(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<number | null>(null);
  const cancelRecordingRef = useRef<boolean>(false);

  const hasBrowserSpeech = useMemo(() => {
    if (typeof window === "undefined") return false;
    const win = window as unknown as {
      SpeechRecognition?: unknown;
      webkitSpeechRecognition?: unknown;
    };
    return Boolean(win.SpeechRecognition || win.webkitSpeechRecognition);
  }, []);

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

  const stopAllVoiceCapture = useCallback((cancelTranscription = true) => {
    if (recordingTimerRef.current !== null) {
      window.clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }

    if (recognitionRef.current) {
      const rec = recognitionRef.current;
      recognitionRef.current = null;
      rec.onresult = null;
      rec.onerror = null;
      rec.onend = null;
      try {
        rec.abort ? rec.abort() : rec.stop();
      } catch {
        // ignore stop errors
      }
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      cancelRecordingRef.current = cancelTranscription;
      try {
        mediaRecorderRef.current.stop();
      } catch {
        // ignore
      }
    }

    if (cancelTranscription && mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }

    if (cancelTranscription) {
      setVoiceStatus("idle");
      setInterimTranscript("");
      setRecordingSeconds(0);
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopAllVoiceCapture(true);
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, [stopAllVoiceCapture]);

  // Clear in-memory conversation on account or month transitions to avoid stale/cross-account answers
  useEffect(() => {
    stopAllVoiceCapture(true);
    setMessages([]);
    setErrorMsg(null);
    setFallbackNotice(null);
    setFailedPrompt(null);
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      setSpeakingMessageId(null);
    }
  }, [account.id, selectedMonth, stopAllVoiceCapture]);

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

  const sendMessage = async (
    textOverride?: string,
    options?: { modelOverride?: GeminiModelId; isRetry?: boolean },
  ) => {
    const promptText = (textOverride ?? input).trim();
    if (!promptText || isStreaming) return;

    const targetModel = options?.modelOverride ?? model;
    if (options?.modelOverride) {
      setModel(options.modelOverride);
    }

    setErrorMsg(null);
    setFallbackNotice(null);
    setFailedPrompt(null);

    const lastMessage = messages[messages.length - 1];
    const reuseLastUserMessage =
      Boolean(options?.isRetry) &&
      lastMessage?.role === "user" &&
      lastMessage.text.trim() === promptText;

    const userMsg: ChatMessage = reuseLastUserMessage
      ? lastMessage
      : {
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
      model: targetModel,
    };

    const nextHistory = reuseLastUserMessage ? [...messages] : [...messages, userMsg];
    setMessages([...nextHistory, placeholderAssistant]);
    if (!textOverride && !options?.isRetry) setInput("");
    setIsStreaming(true);

    try {
      const response = await fetch("/api/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextHistory.map((m) => ({ role: m.role, text: m.text })),
          roleId,
          model: targetModel,
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
            modelUsed?: GeminiModelId;
            fallbackFrom?: string;
          };

          if (payload.modelUsed) {
            setMessages((prev) =>
              prev.map((m) => (m.id === assistantMsgId ? { ...m, model: payload.modelUsed } : m)),
            );
            if (payload.fallbackFrom) {
              setFallbackNotice(
                `${payload.fallbackFrom} was busy — answered automatically with ${payload.modelUsed}.`,
              );
            }
          }

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
      const rawMessage =
        err instanceof Error ? err.message : "Unable to reach the Gemini assistant right now.";
      setErrorMsg(normalizeErrorMessage(rawMessage));
      setFailedPrompt(promptText);
      setMessages((prev) => prev.filter((m) => m.id !== assistantMsgId || m.text.length > 0));
    } finally {
      setIsStreaming(false);
    }
  };

  const startGeminiAudioRecording = async () => {
    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices ||
      typeof navigator.mediaDevices.getUserMedia !== "function" ||
      typeof MediaRecorder === "undefined"
    ) {
      setErrorMsg("Microphone recording is not supported in this browser.");
      setVoiceStatus("idle");
      return;
    }

    setErrorMsg(null);
    setInterimTranscript("");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const mimeType = pickRecorderMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];
      cancelRecordingRef.current = false;

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        if (recordingTimerRef.current !== null) {
          window.clearInterval(recordingTimerRef.current);
          recordingTimerRef.current = null;
        }
        stream.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
        mediaRecorderRef.current = null;

        if (cancelRecordingRef.current) {
          audioChunksRef.current = [];
          setVoiceStatus("idle");
          setRecordingSeconds(0);
          return;
        }

        const recordedType = recorder.mimeType || mimeType || "audio/webm";
        const audioBlob = new Blob(audioChunksRef.current, { type: recordedType });
        audioChunksRef.current = [];

        if (audioBlob.size < 256) {
          setVoiceStatus("idle");
          setRecordingSeconds(0);
          setErrorMsg("Recording was too short. Please hold or speak for at least a second.");
          return;
        }

        setVoiceStatus("transcribing");
        try {
          const audioBase64 = await blobToBase64(audioBlob);
          const response = await fetch("/api/transcribe-audio", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              audioBase64,
              mimeType: recordedType,
              language: settings.voiceLang,
            }),
          });
          const data = (await response.json().catch(() => ({}))) as {
            transcript?: string;
            error?: string;
          };
          if (!response.ok) {
            throw new Error(data.error || "Unable to transcribe audio.");
          }
          const transcript = (data.transcript || "").trim();
          if (!transcript) {
            setErrorMsg("No clear speech was detected in the recording. Please try again.");
          } else {
            setInput((prev) => (prev.trim() ? `${prev.trim()} ${transcript}` : transcript));
            inputRef.current?.focus();
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Audio transcription failed.";
          setErrorMsg(normalizeErrorMessage(msg));
        } finally {
          setVoiceStatus("idle");
          setRecordingSeconds(0);
        }
      };

      recorder.start(250);
      setRecordingSeconds(0);
      setVoiceStatus("recording-gemini");
      recordingTimerRef.current = window.setInterval(() => {
        setRecordingSeconds((prev) => {
          if (prev >= 59) {
            // Auto-stop at 60s to keep payload lean
            recorder.stop();
            return 60;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (err) {
      const errName = (err as { name?: string })?.name || "";
      if (errName === "NotAllowedError" || errName === "PermissionDeniedError") {
        setErrorMsg("Microphone permission was denied. Allow microphone access in browser settings.");
      } else if (errName === "NotFoundError") {
        setErrorMsg("No microphone device was found on this system.");
      } else {
        setErrorMsg("Unable to access the microphone. Check browser permissions and try again.");
      }
      setVoiceStatus("idle");
    }
  };

  const startBrowserSpeechRecognition = () => {
    const win = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };
    const SpeechRec = win.SpeechRecognition || win.webkitSpeechRecognition;
    if (!SpeechRec) {
      void startGeminiAudioRecording();
      return;
    }

    setErrorMsg(null);
    voiceBaseInputRef.current = input.trim();
    browserSpeechHadResultRef.current = false;
    setInterimTranscript("");

    const rec = new SpeechRec();
    rec.lang =
      settings.voiceLang && settings.voiceLang !== "auto"
        ? settings.voiceLang
        : navigator.language || "en-IN";
    rec.continuous = true;
    rec.interimResults = true;

    let committedFinal = "";

    rec.onresult = (event) => {
      browserSpeechHadResultRef.current = true;
      let finalChunk = "";
      let interimChunk = "";

      const startIdx = event.resultIndex ?? 0;
      for (let i = startIdx; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result?.[0]?.transcript ?? "";
        if (!transcript) continue;
        if (result.isFinal) {
          finalChunk += transcript;
        } else {
          interimChunk += transcript;
        }
      }

      if (finalChunk.trim()) {
        committedFinal = committedFinal
          ? `${committedFinal.trim()} ${finalChunk.trim()}`
          : finalChunk.trim();
        const prefix = voiceBaseInputRef.current;
        setInput(prefix ? `${prefix} ${committedFinal}` : committedFinal);
      }
      setInterimTranscript(interimChunk.trim());
    };

    rec.onerror = (event) => {
      const code = event?.error || "";
      recognitionRef.current = null;
      setInterimTranscript("");

      if (code === "aborted") {
        setVoiceStatus("idle");
        return;
      }

      if (code === "not-allowed") {
        setVoiceStatus("idle");
        setErrorMsg("Microphone permission denied. Allow mic access in your browser to use voice input.");
        return;
      }

      if (code === "audio-capture") {
        setVoiceStatus("idle");
        setErrorMsg("No working microphone was detected.");
        return;
      }

      if (code === "no-speech") {
        setVoiceStatus("idle");
        if (!browserSpeechHadResultRef.current) {
          setErrorMsg("No speech detected. Speak clearly or switch to Gemini Audio mode.");
        }
        return;
      }

      // Network / service-not-allowed happens in sandboxed iframes or unsupported Chromium builds:
      // automatically switch to Gemini Audio Recorder + gemini-3.5-transcribe.
      if (code === "network" || code === "service-not-allowed") {
        setVoiceEnginePref("gemini");
        setVoiceStatus("idle");
        void startGeminiAudioRecording();
        return;
      }

      setVoiceStatus("idle");
      setErrorMsg("Voice recognition interrupted. Try speaking again or switch to Gemini Audio.");
    };

    rec.onend = () => {
      if (recognitionRef.current === rec) {
        recognitionRef.current = null;
        setVoiceStatus("idle");
        setInterimTranscript("");
        inputRef.current?.focus();
      }
    };

    try {
      recognitionRef.current = rec;
      setVoiceStatus("listening-browser");
      rec.start();
    } catch {
      recognitionRef.current = null;
      setVoiceStatus("idle");
      void startGeminiAudioRecording();
    }
  };

  const handleToggleVoiceInput = () => {
    if (voiceStatus === "transcribing") return;

    if (voiceStatus === "listening-browser") {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          stopAllVoiceCapture(true);
        }
      }
      setVoiceStatus("idle");
      setInterimTranscript("");
      return;
    }

    if (voiceStatus === "recording-gemini") {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        cancelRecordingRef.current = false;
        mediaRecorderRef.current.stop();
      }
      return;
    }

    if (voiceEnginePref === "gemini" || !hasBrowserSpeech) {
      void startGeminiAudioRecording();
    } else {
      startBrowserSpeechRecognition();
    }
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
  const isVoiceActive = voiceStatus !== "idle";

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
              setFallbackNotice(null);
              setFailedPrompt(null);
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
            <div className="flex items-center gap-2 shrink-0">
              {hasBrowserSpeech && (
                <button
                  type="button"
                  disabled={isVoiceActive}
                  onClick={() =>
                    setVoiceEnginePref((prev) => (prev === "auto" ? "gemini" : "auto"))
                  }
                  title="Switch between live browser dictation and Gemini Audio transcription"
                  className="rounded-md border border-border bg-background px-2.5 py-1 text-[11px] font-medium text-muted-foreground hover:text-foreground disabled:opacity-50"
                >
                  Mic: {voiceEnginePref === "gemini" ? "Gemini Voice" : "Browser Live"}
                </button>
              )}
              <div className="text-xs text-muted-foreground tabular-nums">
                {messages.length} {messages.length === 1 ? "message" : "messages"}
              </div>
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

          {fallbackNotice && !errorMsg && (
            <div className="mx-5 mb-2 rounded-md border border-border bg-muted/60 px-3.5 py-2 text-xs text-muted-foreground flex items-center justify-between gap-2">
              <span>{fallbackNotice}</span>
              <button
                type="button"
                onClick={() => setFallbackNotice(null)}
                className="text-[11px] font-medium text-foreground hover:underline shrink-0"
              >
                Dismiss
              </button>
            </div>
          )}

          {errorMsg && (
            <div className="mx-5 mb-2 rounded-md border border-destructive/40 bg-destructive/10 px-3.5 py-2.5 text-xs text-destructive flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-start gap-2 min-w-0 flex-1">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{errorMsg}</span>
              </div>
              {failedPrompt && !isStreaming && (
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => sendMessage(failedPrompt, { isRetry: true })}
                    className="inline-flex items-center gap-1 rounded border border-destructive/40 bg-background px-2.5 py-1 text-[11px] font-medium text-foreground hover:bg-muted"
                  >
                    <RefreshCw className="h-3 w-3" />
                    <span>Retry</span>
                  </button>
                  {model === "gemini-4-hydrogen" && (
                    <button
                      type="button"
                      onClick={() =>
                        sendMessage(failedPrompt, {
                          isRetry: true,
                          modelOverride: "gemini-3.1-flash-lite",
                        })
                      }
                      className="inline-flex items-center gap-1 rounded bg-primary px-2.5 py-1 text-[11px] font-medium text-primary-foreground hover:opacity-95"
                    >
                      <span>Use 3.1 Flash-Lite</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {voiceStatus !== "idle" && (
            <div className="mx-5 mb-2 rounded-md border border-primary/30 bg-secondary/60 px-3.5 py-2 text-xs text-foreground flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                {voiceStatus === "transcribing" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-primary shrink-0" />
                ) : (
                  <Mic className="h-3.5 w-3.5 text-primary shrink-0" />
                )}
                <span className="truncate">
                  {voiceStatus === "listening-browser" &&
                    (interimTranscript
                      ? `Listening: "${interimTranscript}"`
                      : "Listening via browser speech recognition... speak now")}
                  {voiceStatus === "recording-gemini" &&
                    `Recording for Gemini transcription (${formatDuration(recordingSeconds)})`}
                  {voiceStatus === "transcribing" && "Transcribing voice with Gemini..."}
                </span>
              </div>
              {voiceStatus !== "transcribing" && (
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleToggleVoiceInput}
                    className="rounded border border-primary/30 bg-background px-2 py-0.5 text-[11px] font-medium text-primary hover:bg-muted"
                  >
                    {voiceStatus === "recording-gemini" ? "Stop & Transcribe" : "Done"}
                  </button>
                  <button
                    type="button"
                    onClick={() => stopAllVoiceCapture(true)}
                    className="text-[11px] text-muted-foreground hover:text-foreground"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Composer */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (voiceStatus === "listening-browser") {
                stopAllVoiceCapture(true);
              }
              sendMessage();
            }}
            className="p-4 border-t border-border flex items-center gap-2.5"
          >
            <button
              type="button"
              onClick={handleToggleVoiceInput}
              disabled={voiceStatus === "transcribing" || isStreaming}
              aria-label={
                voiceStatus === "recording-gemini"
                  ? "Stop recording and transcribe"
                  : voiceStatus === "listening-browser"
                    ? "Stop voice input"
                    : "Start voice input"
              }
              title={
                voiceStatus === "recording-gemini"
                  ? "Stop recording & transcribe"
                  : voiceStatus === "listening-browser"
                    ? "Stop voice input"
                    : voiceEnginePref === "gemini" || !hasBrowserSpeech
                      ? "Record voice (Gemini transcription)"
                      : "Speak question (live voice recognizer)"
              }
              className={`icon-button border border-border shrink-0 disabled:opacity-50 ${
                voiceStatus === "listening-browser" || voiceStatus === "recording-gemini"
                  ? "bg-destructive/15 text-destructive border-destructive/40"
                  : "bg-background text-foreground hover:bg-muted"
              }`}
            >
              {voiceStatus === "transcribing" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : voiceStatus === "recording-gemini" ? (
                <Square className="h-3.5 w-3.5 fill-current" />
              ) : voiceStatus === "listening-browser" ? (
                <MicOff className="h-4 w-4" />
              ) : (
                <Mic className="h-4 w-4" />
              )}
            </button>

            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about spending, budgets, transaction IDs, or next month's forecast..."
              disabled={isStreaming}
              className="flex-1 rounded-md border border-input bg-background px-3.5 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />

            <button
              type="submit"
              disabled={!input.trim() || isStreaming || voiceStatus === "recording-gemini" || voiceStatus === "transcribing"}
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
