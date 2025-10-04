// src/components/charts/theme.ts
// Backward-compatible chart theme:
// - Preserves legacy keys used by existing charts (axis.line.stroke, axis.tick.fill, tooltip.radius/border)
// - Adds brand palette + hover cursor + helpers for new work

export const chartTheme = {
  // Brand palette (violet → cyan → blue), used by new charts/updates
  series: [
    '#C277FF', // brand violet (primary)
    '#A78BFA', // violet-400
    '#8B5CF6', // violet-500
    '#7C3AED', // violet-600
    '#22D3EE', // cyan-400
    '#06B6D4', // cyan-500
    '#60A5FA', // blue-400
    '#3B82F6', // blue-500
    '#F472B6', // pink-400 (accent)
    '#93C5FD', // blue-300 (fallback)
  ],

  // Grid style (legacy key kept)
  grid: {
    stroke: 'rgba(148, 163, 184, 0.28)', // subtle slate-ish grid
  },

  // Axis styles — keep both legacy object shape and modern synonyms
  axis: {
    // Legacy object keys (expected by current charts):
    tick: { fill: 'rgba(203, 213, 225, 0.85)' },  // axis.tick.fill
    line: { stroke: 'rgba(226, 232, 240, 0.55)' }, // axis.line.stroke

    // Additional convenient tokens for newer charts:
    stroke: 'rgba(226, 232, 240, 0.55)',
    tickColor: 'rgba(203, 213, 225, 0.85)',
    fontSize: 15,
  },

  // Tooltip — keep legacy fields and add modern tokens
  tooltip: {
    bg: 'rgba(17, 24, 39, 0.92)',                 // glassy dark
    border: '1px solid rgba(148, 163, 184, 0.25)', // LEGACY: full CSS border string
    radius: 12,                                    // LEGACY: border radius number
    color: 'rgba(248, 250, 252, 0.98)',            // brighter text (near-white)
  },

  // Hover cursor for Recharts Tooltip (must be an object, not a string)
  hoverCursor: { fill: 'rgba(194, 119, 255, 0.12)' },

  // Optional CSS filter snippets for glow effects
  shadowCss: {
    glowSm: 'drop-shadow(0 0 6px rgba(194,119,255,0.45))',
    glowMd: 'drop-shadow(0 0 10px rgba(194,119,255,0.55))',
    glowCyan: 'drop-shadow(0 0 10px rgba(34,211,238,0.45))',
  },
} as const;

export type ChartTheme = typeof chartTheme;

// Deterministic series color helper
export function getSeriesColor(idx: number): string {
  const { series } = chartTheme;
  return series[(idx % series.length + series.length) % series.length];
}

// Hex → rgba helper (for gradients/overlays)
export function rgba(hex: string, alpha = 1): string {
  const normalized = hex.replace('#', '');
  const parse = (s: string) => (s.length === 1 ? parseInt(s + s, 16) : parseInt(s, 16));
  const r = parse(normalized.length === 3 ? normalized[0] : normalized.slice(0, 2));
  const g = parse(normalized.length === 3 ? normalized[1] : normalized.slice(2, 4));
  const b = parse(normalized.length === 3 ? normalized[2] : normalized.slice(4, 6));
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Map internal metric keys to user-friendly names (used by all charts' Tooltips)
export function formatMetricName(key: string): string {
  const map: Record<string, string> = {
    cost: 'Cost',
    usd: 'Cost',
    cumCost: 'Cumulative Cost',
    tokens: 'Tokens',
    inputTokens: 'Input Tokens',
    outputTokens: 'Output Tokens',
    requests: 'Requests',
    model: 'Model',
  };
  if (map[key]) return map[key];
  // Fallback: "camelCase_or_snake" -> "Camel Case Or Snake"
  const spaced = key
    .replace(/_/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
  return spaced;
}

// Back-compat alias (some files import { theme })
export const theme = chartTheme;

export default chartTheme;
