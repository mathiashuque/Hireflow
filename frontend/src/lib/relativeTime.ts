const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 60 * 60 * 24 * 365],
  ["month", 60 * 60 * 24 * 30],
  ["week", 60 * 60 * 24 * 7],
  ["day", 60 * 60 * 24],
  ["hour", 60 * 60],
  ["minute", 60],
];

const formatter = typeof Intl.RelativeTimeFormat === "function" ? new Intl.RelativeTimeFormat(undefined, { numeric: "auto" }) : null;

/** A short relative-time string ("3 hours ago"), falling back to "just now" under a minute. */
export function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const seconds = Math.round((then - Date.now()) / 1000);

  if (Math.abs(seconds) < 60) {
    return "just now";
  }

  if (!formatter) {
    return new Date(iso).toLocaleString();
  }

  for (const [unit, secondsInUnit] of UNITS) {
    if (Math.abs(seconds) >= secondsInUnit) {
      return formatter.format(Math.round(seconds / secondsInUnit), unit);
    }
  }

  return formatter.format(Math.round(seconds / 60), "minute");
}
