import modelData from "../data/finance-category-model.json";
import type { CategoryName } from "../types/finance";

interface TfIdfModelSchema {
  alpha: number;
  ngram_max: number;
  classes: string[];
  vectorizer: {
    ngram_max: number;
    min_df: number;
    vocab: Record<string, number>;
    idf: number[];
  };
  weights: number[][];
}

const model = modelData as unknown as TfIdfModelSchema;

export const MODEL_CLASSES = model.classes as CategoryName[];
export const MODEL_VOCAB_SIZE = Object.keys(model.vectorizer.vocab).length;

export interface TfidfScore {
  category: CategoryName;
  probability: number;
}

export interface TfidfPredictionResult {
  category: CategoryName;
  confidence: number;
  knownWords: number;
  lowConfidence: boolean;
  cleaned: string;
  matchedTokens: string[];
  scores: TfidfScore[];
}

export function cleanDescription(rawText: string): string {
  return rawText
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function predictExpense(rawText: string): TfidfPredictionResult {
  const cleaned = cleanDescription(rawText);
  const unigrams = cleaned ? cleaned.split(" ") : [];
  const ngrams: string[] = [...unigrams];

  if ((model.vectorizer.ngram_max || 2) >= 2 && unigrams.length > 1) {
    for (let i = 0; i < unigrams.length - 1; i++) {
      ngrams.push(`${unigrams[i]} ${unigrams[i + 1]}`);
    }
  }

  const tfCounts: Record<string, number> = {};
  const matchedTokens: string[] = [];

  for (const gram of ngrams) {
    if (Object.prototype.hasOwnProperty.call(model.vectorizer.vocab, gram)) {
      if (!tfCounts[gram]) {
        matchedTokens.push(gram);
      }
      tfCounts[gram] = (tfCounts[gram] || 0) + 1;
    }
  }

  const knownWords = matchedTokens.length;

  if (knownWords === 0) {
    const equalProb = 1 / MODEL_CLASSES.length;
    const fallbackScores: TfidfScore[] = MODEL_CLASSES.map((cat) => ({
      category: cat,
      probability: cat === "Other" ? 0.35 : (1 - 0.35) / (MODEL_CLASSES.length - 1),
    })).sort((a, b) => b.probability - a.probability);

    return {
      category: "Other",
      confidence: Number((fallbackScores[0]?.probability ?? equalProb).toFixed(4)),
      knownWords: 0,
      lowConfidence: true,
      cleaned,
      matchedTokens: [],
      scores: fallbackScores,
    };
  }

  // Build L2-normalized TF-IDF vector
  const activeIndices: Array<{ idx: number; tfidf: number }> = [];
  let normSq = 0;
  for (const [gram, count] of Object.entries(tfCounts)) {
    const idx = model.vectorizer.vocab[gram];
    const idf = model.vectorizer.idf[idx] ?? 1;
    const tfidf = count * idf;
    activeIndices.push({ idx, tfidf });
    normSq += tfidf * tfidf;
  }

  const norm = Math.sqrt(normSq) || 1;
  // Row 0 in weights is the Ridge intercept vector; rows 1..516 map to vocab index 0..515
  const hasBiasRow = model.weights.length === model.vectorizer.idf.length + 1;
  const rawScores = hasBiasRow
    ? [...model.weights[0]]
    : new Array<number>(MODEL_CLASSES.length).fill(0);

  for (const { idx, tfidf } of activeIndices) {
    const rowIdx = hasBiasRow ? idx + 1 : idx;
    const rowWeights = model.weights[rowIdx];
    if (!rowWeights) continue;
    const normalizedVal = tfidf / norm;
    for (let c = 0; c < rawScores.length; c++) {
      rawScores[c] += normalizedVal * (rowWeights[c] ?? 0);
    }
  }

  // Convert Ridge linear scores to normalized positive class probabilities
  const clipped = rawScores.map((s) => Math.max(0, s));
  const sumClipped = clipped.reduce((acc, v) => acc + v, 0);

  const probabilities =
    sumClipped > 0
      ? clipped.map((v) => v / sumClipped)
      : (() => {
          const maxScore = Math.max(...rawScores);
          const exps = rawScores.map((s) => Math.exp(s - maxScore));
          const sumExps = exps.reduce((a, b) => a + b, 0) || 1;
          return exps.map((e) => e / sumExps);
        })();

  const scores: TfidfScore[] = MODEL_CLASSES.map((category, idx) => ({
    category,
    probability: probabilities[idx] ?? 0,
  })).sort((a, b) => b.probability - a.probability);

  const top = scores[0];
  return {
    category: top.category,
    confidence: top.probability,
    knownWords,
    lowConfidence: top.probability < 0.45,
    cleaned,
    matchedTokens,
    scores,
  };
}
