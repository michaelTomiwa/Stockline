/* Date helpers for server pages (kept out of component bodies so renders stay pure). */

export function isoDaysAgo(days: number) {
  return new Date(Date.now() - days * 864e5).toISOString();
}

/* The last n calendar days in Lagos time, oldest first, as YYYY-MM-DD. */
export function lastDays(n: number) {
  const now = Date.now();
  return Array.from({ length: n }, (_, i) => new Date(now - (n - 1 - i) * 864e5).toLocaleDateString("en-CA", { timeZone: "Africa/Lagos" }));
}

/* Start of today / this month in Lagos (WAT is UTC+1 all year), as an ISO timestamp. */
export function lagosStartOf(unit: "day" | "month") {
  const ymd = new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Lagos" });
  return `${unit === "day" ? ymd : `${ymd.slice(0, 8)}01`}T00:00:00+01:00`;
}

/* How far through the month we are in Lagos: day of month and days in it. */
export function lagosMonthProgress() {
  const [y, m, d] = new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Lagos" }).split("-").map(Number);
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { day: d, days, monthName: new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString("en-GB", { month: "long" }) };
}

/* "Good morning" in Lagos time. */
export function greeting() {
  const h = Number(new Date().toLocaleString("en-GB", { hour: "2-digit", hour12: false, timeZone: "Africa/Lagos" }));
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}
