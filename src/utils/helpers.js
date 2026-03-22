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
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = String(d.getFullYear()).slice(-2);
    return `${day}.${month}.${year}`;
  } catch {
    return String(iso);
  }
}
