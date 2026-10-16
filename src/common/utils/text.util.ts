// Control characters (including new lines) are removed from single-line fields so they
// cannot be used to inject extra email headers or break log lines.
const CONTROL_ALL = /[\u0000-\u001F\u007F-\u009F\u2028\u2029]/g;
// For multi-line fields (notes, messages) keep tabs and new lines.
const CONTROL_EXCEPT_NEWLINE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u2028\u2029]/g;

/** Non-strings are returned untouched so the validators can reject them. */
export function cleanLine(value: unknown): unknown {
  if (typeof value !== "string") return value;
  return value.replace(CONTROL_ALL, " ").replace(/\s+/g, " ").trim();
}

export function cleanMultiline(value: unknown): unknown {
  if (typeof value !== "string") return value;
  return value
    .replace(/\r\n?/g, "\n")
    .replace(CONTROL_EXCEPT_NEWLINE, "")
    .trim();
}

export function cleanEmail(value: unknown): unknown {
  if (typeof value !== "string") return value;
  return value.replace(CONTROL_ALL, "").trim().toLowerCase();
}
