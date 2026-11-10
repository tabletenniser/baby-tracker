export function todayStr(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Local datetime for a <input type="datetime-local"> (YYYY-MM-DDTHH:MM). */
export function toLocalDateTime(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

/** "X ml" rounded. */
export function formatMl(n: number): string {
  return `${Math.round(n)} ml`;
}

export function nowDateTimeLocal(): string {
  const d = new Date();
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${mo}-${day}T${h}:${mi}`;
}

export function addDays(dateStr: string, delta: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + delta);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Default datetime for a form targeting `date`:
 * - today → current time
 * - other days → that day at the current time (convenient for backfilling)
 */
export function defaultDateTime(date: string): string {
  const now = new Date();
  const h = String(now.getHours()).padStart(2, "0");
  const mi = String(now.getMinutes()).padStart(2, "0");
  return `${date}T${h}:${mi}`;
}

/** Exact age: "X days old" for young babies, else "X months Y days old". */
export function ageLabel(birthday: string): string {
  const b = new Date(birthday + "T00:00:00");
  const now = new Date();
  let months = (now.getFullYear() - b.getFullYear()) * 12 + (now.getMonth() - b.getMonth());
  let days = now.getDate() - b.getDate();
  if (days < 0) {
    months -= 1;
    const prevMonth = new Date(now.getFullYear(), now.getMonth(), 0);
    days += prevMonth.getDate();
  }
  if (months < 1) return `${days} days old`;
  if (days === 0) return `${months} months old`;
  return `${months} months ${days} days old`;
}

/** "17:30" or "09:05" from an ISO datetime string. */
export function timeOf(iso: string): string {
  return iso.slice(11, 16);
}

/** "HH:MM AM/PM" from an ISO datetime string. */
export function time12(iso: string): string {
  const [hStr, m] = iso.slice(11, 16).split(":");
  let h = parseInt(hStr, 10);
  const suffix = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${m} ${suffix}`;
}

/** "Xh Ym" from hours (float). */
export function formatHours(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/** Convert an hour-of-day (0-24 float) to "HH:MM". */
export function hourToTime(hour: number): string {
  const h = Math.floor(hour);
  const m = Math.round((hour - h) * 60);
  return `${String(h % 24).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Short weekday + day, e.g. "Mon, Nov 9". */
export function shortDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

/** "Nov 9" from a YYYY-MM-DD string. */
export function prettyDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
