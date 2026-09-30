const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** Renders "1943-05-02" as "2 May 1943" but leaves "1943" untouched. */
export function formatMemorialDate(value?: string | null): string {
  if (!value) return "";
  const trimmed = value.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (iso) {
    const [, year, month, day] = iso;
    const monthName = MONTHS[Number(month) - 1];
    if (monthName) return `${Number(day)} ${monthName} ${year}`;
  }
  return trimmed;
}

/** "1943 – 2025", "1943 –", or just "2025" depending on what is known. */
export function lifespan(born?: string | null, died?: string | null): string {
  const from = formatMemorialDate(born);
  const to = formatMemorialDate(died);
  if (from && to) return `${from} — ${to}`;
  if (from) return `Born ${from}`;
  if (to) return `Passed ${to}`;
  return "";
}

export function formatTimestamp(value?: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

/** "3 days ago" style label used on the manage dashboard. */
export function timeAgo(value?: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const seconds = Math.round((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const units: [number, string][] = [
    [60, "minute"],
    [3600, "hour"],
    [86400, "day"],
    [604800, "week"],
    [2592000, "month"],
    [31536000, "year"],
  ];
  let chosen: [number, string] = [1, "second"];
  for (const unit of units) {
    if (seconds >= unit[0]) chosen = unit;
  }
  const amount = Math.floor(seconds / chosen[0]);
  return `${amount} ${chosen[1]}${amount === 1 ? "" : "s"} ago`;
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function slugTitleCase(value: string): string {
  return value
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
