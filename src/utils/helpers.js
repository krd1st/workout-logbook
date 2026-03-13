export function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

export function toISO(d = new Date()) {
  return d.toISOString();
}

export function formatShortDate(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, {
      year: "2-digit",
      month: "short",
      day: "numeric",
    });
  } catch {
    return String(iso);
  }
}

/** European style: 15.01.26 (day.month.year) */
export function formatDateEuropean(iso) {
  try {
    const d = new Date(iso);
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = String(d.getFullYear()).slice(-2);
    return `${day}.${month}.${year}`;
  } catch {
    return String(iso);
  }
}

/** Log line: "30kg × 10 / 11" (weight with kg, no "reps" suffix) */
export function formatLogLine(entry) {
  const w = entry.weight;
  const a = entry.top_reps ?? "—";
  const b = entry.back_reps ?? "—";
  return `${w}kg × ${a} / ${b}`;
}

export function bumpNumber(
  raw,
  delta,
  { min = -Infinity, max = Infinity, decimals = 0 } = {},
) {
  const current = Number(String(raw ?? "").replace(",", "."));
  const base = Number.isFinite(current) ? current : 0;
  const next = clamp(base + delta, min, max);
  const fixed = next.toFixed(decimals);
  if (decimals <= 0) return fixed;
  // Trim trailing zeros (2.50 -> 2.5, 5.00 -> 5) while keeping needed precision (1.25).
  return fixed.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
}
