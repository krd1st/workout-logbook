export function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

export function toISO(d = new Date()) {
  return d.toISOString();
}

/** European style: 15.01.26 (day.month.year) */
export function formatDateEuropean(iso) {
  try {
    const d = new Date(iso);
    const day = String(d.getUTCDate()).padStart(2, "0");
    const month = String(d.getUTCMonth() + 1).padStart(2, "0");
    const year = String(d.getUTCFullYear()).slice(-2);
    return `${day}.${month}.${year}`;
  } catch {
    return String(iso);
  }
}
