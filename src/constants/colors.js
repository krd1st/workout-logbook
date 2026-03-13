export const APP_COLORS = {
  // Milestone bar (reps slider)
  milestoneTrack: "#374151",
  milestoneDot: "#4b5563",
  milestoneDotSelected: "#4338ca",
  // Header shadow
  shadow: "#000",
  // Surfaces (null = use theme)
  background: null,
  surface: null,
  outline: null,
  outlineVariant: null,
  error: null,
  readyHighlight: "#333333",
};

/** Resolves colors: APP_COLORS override wins, else theme. */
export function getAppColors(theme) {
  return {
    background: APP_COLORS.background ?? theme.colors.background,
    surface: APP_COLORS.surface ?? theme.colors.surface,
    outline: APP_COLORS.outline ?? theme.colors.outline,
    outlineVariant:
      APP_COLORS.outlineVariant ??
      theme.colors.outlineVariant ??
      theme.colors.outline,
    error: APP_COLORS.error ?? theme.colors.error,
    readyHighlight:
      APP_COLORS.readyHighlight ??
      theme.colors.tertiaryContainer ??
      theme.colors.primaryContainer,
  };
}
