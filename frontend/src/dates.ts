const pad = (n: number) => String(n).padStart(2, "0");

/** Local date as YYYY-MM-DD. */
export function toLocalDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Local datetime for a <input type="datetime-local"> (YYYY-MM-DDTHH:MM). */
export function toLocalDateTime(d: Date): string {
  return `${toLocalDate(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function todayStr(): string {
  return toLocalDate(new Date());
}

/**
 * A sensible default datetime for a form on the given selected day:
 * "now" when the day is today, otherwise the selected day at the current
 * time-of-day. Makes backfilling historical days feel natural.
 */
export function defaultDateTime(selectedDate: string): string {
  const now = new Date();
  return `${selectedDate}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

export function ageInDays(birthday: string): number {
  const b = new Date(birthday + "T00:00:00");
  const now = new Date();
  const nowMid = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.floor((nowMid.getTime() - b.getTime()) / 86400000);
}

export function ageLabel(birthday: string): string {
  const days = ageInDays(birthday);
  if (days < 0) return "not born yet";
  if (days === 0) return "born today!";
  if (days < 14) return `${days} days old`;
  if (days < 70) return `${Math.floor(days / 7)} weeks old`;
  const months = Math.floor(days / 30.44);
  return `${months} months old`;
}

/** Parse a local ISO string (from datetime-local) into a Date. */
export function parseLocal(iso: string): Date {
  return new Date(iso);
}

export function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatHours(h: number): string {
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  if (hh === 0) return `${mm}m`;
  if (mm === 0) return `${hh}h`;
  return `${hh}h ${mm}m`;
}

export function formatMl(n: number): string {
  return `${Math.round(n)} ml`;
}
