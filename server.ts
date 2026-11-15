import "dotenv/config";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;

const ALLOWED_MODELS = new Set(["gemini-4-hydrogen", "gemini-3.1-flash-lite"]);

const ROLE_INSTRUCTIONS: Record<string, string> = {
  advisor:
    "You are MoneyMind AI's Personal Finance Advisor. Provide balanced, practical guidance grounded strictly in the user's verified ledger summary.",
  strategist:
    "You are MoneyMind AI's Budget & Cashflow Strategist. Focus on budget utilization, approaching category limits, and actionable ways to improve monthly savings rate.",
  analyst:
    "You are MoneyMind AI's Data & Forecast Analyst. Focus on quantitative variance, month-over-month deltas, category concentration, and walk-forward spending forecasts.",
};

const EXPENSE_CATEGORIES = [
  "Bills",
  "Education",
  "Entertainment",
  "Food",
  "Health",
  "Shopping",
  "Transport",
  "Other",
];

const INCOME_CATEGORIES = [
  "Salary",
  "Freelance",
  "Investment",
  "Refund",
  "Other",
];

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured on the server.");
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface ParsedGeminiError {
  statusCode: number;
  isTransient: boolean;
  userMessage: string;
}

function extractNestedErrorInfo(raw: string): { code?: number; status?: string; message?: string } {
  let current = raw.trim();
  let code: number | undefined;
  let status: string | undefined;

  for (let depth = 0; depth < 3; depth++) {
    if (!current.startsWith("{")) break;
    try {
      const parsed = JSON.parse(current) as {
        error?: { code?: number; status?: string; message?: string };
        code?: number;
        status?: string;
        message?: string;
      };
      const target = parsed.error ?? parsed;
      if (typeof target.code === "number") code = target.code;
      if (typeof target.status === "string") status = target.status;
      if (typeof target.message === "string" && target.message.trim()) {
        current = target.message.trim();
      } else {
        break;
      }
    } catch {
      break;
    }
  }

  return { code, status, message: current };
}

function parseGeminiError(err: unknown): ParsedGeminiError {
  const rawMessage = err instanceof Error ? err.message : String(err ?? "Unknown error");
  const statusHint =
    typeof (err as { status?: unknown })?.status === "number"
      ? ((err as { status: number }).status as number)
      : undefined;

  const extracted = extractNestedErrorInfo(rawMessage);
  const code = extracted.code ?? statusHint ?? 500;
  const statusStr = (extracted.status || "").toUpperCase();
  const cleanMsg = extracted.message || rawMessage;

  const is503 =
    code === 503 ||
    statusStr === "UNAVAILABLE" ||
    /high demand|service unavailable|overloaded/i.test(cleanMsg);
  const is429 =
    code === 429 ||
    statusStr === "RESOURCE_EXHAUSTED" ||
    /rate limit|quota|too many requests/i.test(cleanMsg);
  const is5xx = code >= 500 && code < 600;

  if (is503) {
    return {
      statusCode: 503,
      isTransient: true,
      userMessage:
        "The AI model is currently experiencing high demand. Please retry in a few seconds or switch to 3.1 Flash-Lite.",
    };
  }
  if (is429) {
    return {
      statusCode: 429,
      isTransient: true,
      userMessage:
        "The AI service is temporarily rate-limited. Please wait a moment and try again.",
    };
  }
  if (code === 401 || code === 403 || /api key|permission|unauthorized/i.test(cleanMsg)) {
    return {
      statusCode: 403,
      isTransient: false,
      userMessage: "Gemini API authorization failed on the server. Verify GEMINI_API_KEY configuration.",
    };
  }
  if (code === 400) {
    return {
      statusCode: 400,
      isTransient: false,
      userMessage: cleanMsg.startsWith("{")
        ? "The request could not be processed by the AI model."
        : cleanMsg,
    };
  }

  return {
    statusCode: is5xx ? code : 500,
    isTransient: is5xx,
    userMessage: cleanMsg.startsWith("{")
      ? "Unable to reach the AI assistant right now. Please try again."
      : cleanMsg,
  };
}

function getFallbackModel(model: string): string {
  return model === "gemini-4-hydrogen" ? "gemini-3.1-flash-lite" : "gemini-4-hydrogen";
}

async function startStreamWithRetryAndFallback(
  ai: GoogleGenAI,
  primaryModel: string,
  contents: Array<{ role: string; parts: Array<{ text: string }> }>,
  systemInstruction: string,
) {
  const candidates = [
    { model: primaryModel, delayMs: 0 },
    { model: primaryModel, delayMs: 650 },
    { model: getFallbackModel(primaryModel), delayMs: 200 },
  ];

  let lastError: unknown;

  for (const candidate of candidates) {
    if (candidate.delayMs > 0) {
      await sleep(candidate.delayMs);
    }
    try {
      const stream = await ai.models.generateContentStream({
        model: candidate.model,
        contents,
        config: { systemInstruction },
      });
      const iterator = stream[Symbol.asyncIterator]();
      const firstResult = await iterator.next();
      return {
        modelUsed: candidate.model,
        firstResult,
        iterator,
      };
    } catch (err) {
      lastError = err;
      const parsed = parseGeminiError(err);
      if (!parsed.isTransient) {
        throw err;
      }
    }
  }

  throw lastError;
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: "12mb" }));

  // Multi-turn streaming finance assistant endpoint
  app.post("/api/chat/stream", async (req, res) => {
    try {
      const {
        messages,
        roleId = "advisor",
        model = "gemini-4-hydrogen",
        financeContext = "",
      } = (req.body ?? {}) as {
        messages?: Array<{ role: string; text: string }>;
        roleId?: string;
        model?: string;
        financeContext?: string;
      };

      if (!Array.isArray(messages) || messages.length === 0) {
        res.status(400).json({ error: "messages array is required." });
        return;
      }

      const selectedModel = ALLOWED_MODELS.has(model) ? model : "gemini-4-hydrogen";
      const persona = ROLE_INSTRUCTIONS[roleId] ?? ROLE_INSTRUCTIONS.advisor;
      const systemInstruction = [
        persona,
        "STRICT GROUNDING RULES:",
        "1. Rely exclusively on the VERIFIED LEDGER SUMMARY provided below for all amounts, balances, budgets, categories, forecast figures, and transaction IDs.",
        "2. Never invent transaction IDs, merchants, dates, or dollar/rupee figures that are not present in the summary.",
        "3. When referencing specific transactions, cite their exact ID (e.g., TXN-2019).",
        "4. If the summary has zero transactions or lacks requested data, state that clearly.",
        "",
        "=== VERIFIED LEDGER SUMMARY ===",
        financeContext || "(No ledger context provided.)",
      ].join("\n");

      const contents = messages
        .filter((m) => typeof m.text === "string" && m.text.trim().length > 0)
        .map((m) => ({
          role: m.role === "model" ? "model" : "user",
          parts: [{ text: m.text }],
        }));

      if (contents.length === 0) {
        res.status(400).json({ error: "At least one non-empty message is required." });
        return;
      }

      const ai = getGeminiClient();
      const { modelUsed, firstResult, iterator } = await startStreamWithRetryAndFallback(
        ai,
        selectedModel,
        contents,
        systemInstruction,
      );

      res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
      res.setHeader("Cache-Control", "no-cache, no-transform");
      res.setHeader("Connection", "keep-alive");

      res.write(
        `data: ${JSON.stringify({
          modelUsed,
          fallbackFrom: modelUsed !== selectedModel ? selectedModel : undefined,
        })}\n\n`,
      );

      if (!firstResult.done && firstResult.value?.text) {
        res.write(`data: ${JSON.stringify({ text: firstResult.value.text })}\n\n`);
      }

      while (true) {
        const next = await iterator.next();
        if (next.done) break;
        const text = next.value?.text;
        if (text) {
          res.write(`data: ${JSON.stringify({ text })}\n\n`);
        }
      }

      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
    } catch (err) {
      const parsed = parseGeminiError(err);
      if (!res.headersSent) {
        res.status(parsed.statusCode).json({ error: parsed.userMessage });
      } else {
        res.write(`data: ${JSON.stringify({ error: parsed.userMessage })}\n\n`);
        res.end();
      }
    }
  });

  // Audio transcription endpoint using gemini-3.5-transcribe
  app.post("/api/transcribe-audio", async (req, res) => {
    try {
      const { audioBase64, mimeType = "audio/webm", language } = (req.body ?? {}) as {
        audioBase64?: string;
        mimeType?: string;
        language?: string;
      };

      if (!audioBase64 || typeof audioBase64 !== "string") {
        res.status(400).json({ error: "audioBase64 payload is required." });
        return;
      }

      const cleanBase64 = audioBase64.includes(",")
        ? audioBase64.split(",").pop() || ""
        : audioBase64;
      if (!cleanBase64.trim()) {
        res.status(400).json({ error: "Recorded audio was empty." });
        return;
      }

      const cleanMimeType = (mimeType.split(";")[0] || "audio/webm").trim().toLowerCase();
      const allowedMime = cleanMimeType.startsWith("audio/") ? cleanMimeType : "audio/webm";

      const ai = getGeminiClient();
      const instruction =
        language && language !== "auto"
          ? `Transcribe this spoken personal finance question cleanly into text (primary language hint: ${language}). Return only the transcribed words without commentary.`
          : "Transcribe this spoken personal finance question cleanly into text. Return only the transcribed words without commentary.";

      let lastErr: unknown;
      for (let attempt = 0; attempt < 2; attempt++) {
        if (attempt > 0) await sleep(600);
        try {
          const response = await ai.models.generateContent({
            model: "gemini-3.5-transcribe",
            contents: {
              parts: [
                {
                  inlineData: {
                    mimeType: allowedMime,
                    data: cleanBase64,
                  },
                },
                { text: instruction },
              ],
            },
          });

          const transcript = (response.text ?? "").trim();
          res.json({ transcript });
          return;
        } catch (err) {
          lastErr = err;
          if (!parseGeminiError(err).isTransient) {
            throw err;
          }
        }
      }

      throw lastErr;
    } catch (err) {
      const parsed = parseGeminiError(err);
      res.status(parsed.statusCode).json({ error: parsed.userMessage });
    }
  });

  // Structured Gemini transaction category classifier
  app.post("/api/predict-category", async (req, res) => {
    try {
      const { description, type = "expense", amount } = (req.body ?? {}) as {
        description?: string;
        type?: "income" | "expense";
        amount?: number;
      };

      if (!description || typeof description !== "string" || !description.trim()) {
        res.status(400).json({ error: "description is required." });
        return;
      }

      const allowedCategories = type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
      const ai = getGeminiClient();

      const prompt = [
        `Classify this ${type} transaction into exactly one of the allowed categories.`,
        `Description: "${description.trim()}"`,
        amount ? `Amount: ${amount}` : "",
        `Allowed categories: ${allowedCategories.join(", ")}`,
      ]
        .filter(Boolean)
        .join("\n");

      const modelsToTry = ["gemini-3.1-flash-lite", "gemini-4-hydrogen"];
      let responseText: string | undefined;
      let usedModel = modelsToTry[0];
      let lastErr: unknown;

      for (const candidateModel of modelsToTry) {
        try {
          const response = await ai.models.generateContent({
            model: candidateModel,
            contents: prompt,
            config: {
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  category: {
                    type: Type.STRING,
                    enum: allowedCategories,
                  },
                  confidence: {
                    type: Type.NUMBER,
                    description: "Confidence between 0 and 1",
                  },
                  reasoning: {
                    type: Type.STRING,
                    description: "Brief one-sentence explanation",
                  },
                },
                required: ["category", "confidence", "reasoning"],
              },
            },
          });
          responseText = response.text;
          usedModel = candidateModel;
          break;
        } catch (err) {
          lastErr = err;
          if (!parseGeminiError(err).isTransient) {
            throw err;
          }
          await sleep(450);
        }
      }

      if (!responseText) {
        throw lastErr ?? new Error("Empty classification response from Gemini.");
      }

      const parsed = JSON.parse(responseText) as {
        category: string;
        confidence: number;
        reasoning: string;
      };
      const safeCategory = allowedCategories.includes(parsed.category)
        ? parsed.category
        : "Other";

      res.json({
        category: safeCategory,
        confidence: Math.max(0, Math.min(1, Number(parsed.confidence) || 0.8)),
        reasoning: parsed.reasoning || `Classified by ${usedModel}.`,
      });
    } catch (err) {
      const parsed = parseGeminiError(err);
      res.status(parsed.statusCode).json({ error: parsed.userMessage });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, "dist");
    app.use(express.static(distDir));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distDir, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`MoneyMind AI server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
