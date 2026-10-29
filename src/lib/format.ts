const formatters = new Map<string, Intl.NumberFormat>();

export function money(amount: number, currency = "NGN") {
  let f = formatters.get(currency);
  if (!f) {
    f = new Intl.NumberFormat("en-NG", { style: "currency", currency, maximumFractionDigits: 0 });
    formatters.set(currency, f);
  }
  return f.format(amount);
}

export function compactMoney(amount: number, currency = "NGN") {
  const sign = currency === "NGN" ? "₦" : "";
  const a = Math.abs(amount);
  if (a >= 1_000_000) return `${sign}${(amount / 1_000_000).toFixed(1).replace(/\.0$/, "")}m`;
  if (a >= 1_000) return `${sign}${Math.round(amount / 1_000)}k`;
  return `${sign}${Math.round(amount)}`;
}

export function qty(n: number) {
  return Number.isInteger(n) ? n.toLocaleString("en-NG") : n.toLocaleString("en-NG", { maximumFractionDigits: 2 });
}

const tz = "Africa/Lagos";
const day = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: tz });
const dayYear = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: tz });
const dayTime = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: tz });

export const shortDate = (iso: string) => day.format(new Date(iso));
export const fullDate = (iso: string) => dayYear.format(new Date(iso));
export const dateTime = (iso: string) => dayTime.format(new Date(iso));

export function timeAgo(iso: string, now = Date.now()) {
  const mins = Math.max(1, Math.round((now - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  const days = Math.round(hrs / 24);
  return days === 1 ? "yesterday" : `${days} days ago`;
}

export function cn(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}
