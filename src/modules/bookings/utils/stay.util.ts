/**
 * Dates are plain "YYYY-MM-DD" strings. A stay occupies the nights from check-in up to,
 * but NOT including, check-out, so one guest can leave the morning another arrives.
 * ISO dates sort correctly as plain strings, so string comparison is safe here.
 */
export const MAX_NIGHTS = 60;
export const MAX_DAYS_AHEAD = 730; // about 2 years
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Strict parse: rejects impossible dates such as 2026-02-30. Returns UTC midnight. */
export function parseDateOnly(value: string): Date | null {
  if (typeof value !== "string" || !DATE_RE.test(value)) return null;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  if (
    date.getUTCFullYear() !== y ||
    date.getUTCMonth() !== m - 1 ||
    date.getUTCDate() !== d
  ) {
    return null;
  }
  return date;
}

export function formatDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Today's date at the property (Nepal), so "in the past" means the same for everyone. */
export function todayInNepal(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kathmandu",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function nightsBetween(checkIn: string, checkOut: string): number {
  const a = parseDateOnly(checkIn);
  const b = parseDateOnly(checkOut);
  if (!a || !b) return 0;
  return Math.round((b.getTime() - a.getTime()) / DAY_MS);
}

/** Every occupied night: [checkIn, checkOut). */
export function listNights(checkIn: string, checkOut: string): string[] {
  const start = parseDateOnly(checkIn);
  const count = nightsBetween(checkIn, checkOut);
  if (!start || count <= 0) return [];
  return Array.from({ length: count }, (_, i) =>
    formatDateOnly(new Date(start.getTime() + i * DAY_MS)),
  );
}

export function rangesOverlap(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
): boolean {
  return aStart < bEnd && bStart < aEnd;
}

/** Returns a plain-language problem, or null when the stay is acceptable. */
export function validateStay(
  checkIn: string,
  checkOut: string,
  today: string,
): string | null {
  const start = parseDateOnly(checkIn);
  const end = parseDateOnly(checkOut);
  if (!start) return "Check-in must be a real date in YYYY-MM-DD format";
  if (!end) return "Check-out must be a real date in YYYY-MM-DD format";
  if (checkIn < today) return "Check-in cannot be in the past";
  if (checkOut <= checkIn) return "Check-out must be after check-in";
  if (nightsBetween(checkIn, checkOut) > MAX_NIGHTS) {
    return `A stay can be at most ${MAX_NIGHTS} nights`;
  }
  const todayDate = parseDateOnly(today);
  if (
    todayDate &&
    start.getTime() - todayDate.getTime() > MAX_DAYS_AHEAD * DAY_MS
  ) {
    return "Check-in is too far in the future";
  }
  return null;
}
