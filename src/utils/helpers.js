export function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

export function toISO(d = new Date()) {
  return d.toISOString();
}
