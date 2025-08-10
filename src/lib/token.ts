// Lightweight token estimator (no deps). Good enough for budgeting.
// Heuristic: ~4 chars/token; model-specific nudges.

const CHAR_PER_TOKEN_DEFAULT = 4;

const MODEL_HINTS: Record<string, number> = {
  "gpt-4o": 3.6,
  "gpt-4o-mini": 3.8,
  "o3-mini": 3.8,
  "claude-3.5-sonnet": 3.9,
  "claude-3-haiku": 4.0,
  "mistral-large-latest": 4.0,
  "ministral-8b": 4.1,
  "gemini-1.5-pro": 4.0,
  "gemini-1.5-flash": 4.1,
  "deepseek-chat": 4.0,
  "deepseek-coder": 3.6,
};

function charPerTokenFor(model?: string) {
  if (!model) return CHAR_PER_TOKEN_DEFAULT;
  const key = model.toLowerCase();
  return MODEL_HINTS[key] ?? CHAR_PER_TOKEN_DEFAULT;
}

export function estimateTokens(text: string, model?: string): number {
  if (!text) return 0;
  // Normalize whitespace; treat CJK as slightly denser
  const compact = text.replace(/\s+/g, " ").trim();
  const cjk = (compact.match(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/gu) || []).length;
  const asciiish = compact.length - cjk;
  const chars = asciiish + Math.round(cjk * 1.2);
  const cpt = charPerTokenFor(model);
  return Math.max(0, Math.ceil(chars / cpt));
}

export function estimateCostUSD(text: string, rateUsdPer1k: number | undefined, model?: string): number {
  const tokens = estimateTokens(text, model);
  if (!rateUsdPer1k) return 0;
  return (tokens / 1000) * rateUsdPer1k;
}
