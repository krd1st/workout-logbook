/* ── Obsidian Dark Theme ── */

export const BRAND = {
  bg: "#0A0A0A",
  surface: "#141414",
  surfaceHigh: "#1C1C1C",
  accent: "#F59E0B",      // electric amber
  accentMuted: "#B45309",
  text: "#F5F5F5",
  textSecondary: "#8A8A8A",
  textMuted: "#525252",
  border: "#2A2A2A",
  error: "#EF4444",
  success: "#22C55E",
  overlay: "rgba(0,0,0,0.7)",
};

export const APP_COLORS = {
  shadow: "#000",
  background: null,
  surface: null,
  outline: null,
  outlineVariant: null,
  error: null,
  readyHighlight: BRAND.surfaceHigh,
};

export function getAppColors(theme) {
  return {
    background: BRAND.bg,
    surface: BRAND.surface,
    surfaceHigh: BRAND.surfaceHigh,
    accent: BRAND.accent,
    accentMuted: BRAND.accentMuted,
    text: BRAND.text,
    textSecondary: BRAND.textSecondary,
    textMuted: BRAND.textMuted,
    border: BRAND.border,
    outline: BRAND.border,
    outlineVariant: BRAND.border,
    error: BRAND.error,
    success: BRAND.success,
    overlay: BRAND.overlay,
    readyHighlight: BRAND.surfaceHigh,
  };
}
