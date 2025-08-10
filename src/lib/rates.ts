// lib/rates.ts
export type ProviderKey =
  | "openai"
  | "anthropic"
  | "mistral"
  | "google"
  | "deepseek";

export type ModelInfo = {
  model: string;
  rateUsdPer1k: number; // total ($/1k tokens). You can later split prompt/completion.
};

// Provider-level default rate (fallback if a model isn't in the catalog)
export const PROVIDER_DEFAULTS: Record<ProviderKey, number> = {
  openai: 0.5,
  anthropic: 0.5,
  mistral: 0.3,
  google: 0.2,
  deepseek: 0.14,
};

// Model catalogs (starter set; extend freely)
export const PROVIDER_MODELS: Record<ProviderKey, ModelInfo[]> = {
  openai: [
    { model: "gpt-4o", rateUsdPer1k: 0.5 },
    { model: "gpt-4o-mini", rateUsdPer1k: 0.15 },
    { model: "o3-mini", rateUsdPer1k: 0.2 },
  ],
  anthropic: [
    { model: "claude-3.5-sonnet", rateUsdPer1k: 0.5 },
    { model: "claude-3-haiku", rateUsdPer1k: 0.15 },
  ],
  mistral: [
    { model: "mistral-large-latest", rateUsdPer1k: 0.3 },
    { model: "ministral-8b", rateUsdPer1k: 0.05 },
  ],
  google: [
    { model: "gemini-1.5-pro", rateUsdPer1k: 0.2 },
    { model: "gemini-1.5-flash", rateUsdPer1k: 0.05 },
  ],
  deepseek: [
    { model: "deepseek-chat", rateUsdPer1k: 0.14 },
    { model: "deepseek-coder", rateUsdPer1k: 0.12 },
  ],
};

export function normalizeProvider(p: string): ProviderKey | null {
  const key = p.trim().toLowerCase() as ProviderKey;
  return key in PROVIDER_DEFAULTS ? key : null;
}

export function getModelRate(
  provider: string | undefined,
  model: string | undefined,
  projectRateFallback?: number
): number | undefined {
  const p = provider ? normalizeProvider(provider) : null;
  if (!p) return projectRateFallback;
  if (model) {
    const hit = PROVIDER_MODELS[p].find(m => m.model === model);
    if (hit) return hit.rateUsdPer1k;
  }
  // provider default
  const providerDefault = PROVIDER_DEFAULTS[p];
  return providerDefault ?? projectRateFallback;
}
