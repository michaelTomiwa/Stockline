/* Date helpers for server pages (kept out of component bodies so renders stay pure). */

export function isoDaysAgo(days: number) {
  return new Date(Date.now() - days * 864e5).toISOString();
}

/* The last n calendar days in Lagos time, oldest first, as YYYY-MM-DD. */
export function lastDays(n: number) {
  const now = Date.now();
  return Array.from({ length: n }, (_, i) => new Date(now - (n - 1 - i) * 864e5).toLocaleDateString("en-CA", { timeZone: "Africa/Lagos" }));
}
