import { type Locale, intlLocales } from "./config";

const RELATIVE_UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 60 * 60 * 24 * 365],
  ["month", 60 * 60 * 24 * 30],
  ["week", 60 * 60 * 24 * 7],
  ["day", 60 * 60 * 24],
  ["hour", 60 * 60],
  ["minute", 60],
];

const JUST_NOW: Record<Locale, string> = {
  en: "just now",
  es: "justo ahora",
};

/**
 * Locale-aware date/time/number formatters. Formatters are created per call
 * (cheap for `Intl`) rather than bound once at module load, so the active
 * locale is always respected instead of freezing to whichever locale was
 * active when the module first ran.
 */
export function formatDate(locale: Locale, iso: string): string {
  return new Intl.DateTimeFormat(intlLocales[locale], { dateStyle: "medium" }).format(new Date(iso));
}

export function formatDateTime(locale: Locale, iso: string): string {
  return new Intl.DateTimeFormat(intlLocales[locale], { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(iso),
  );
}

/** A short relative-time string ("3 hours ago" / "hace 3 horas"), falling back to "just now" under a minute. */
export function formatRelativeTime(locale: Locale, iso: string): string {
  const then = new Date(iso).getTime();
  const seconds = Math.round((then - Date.now()) / 1000);

  if (Math.abs(seconds) < 60) {
    return JUST_NOW[locale];
  }

  const formatter = new Intl.RelativeTimeFormat(intlLocales[locale], { numeric: "auto" });

  for (const [unit, secondsInUnit] of RELATIVE_UNITS) {
    if (Math.abs(seconds) >= secondsInUnit) {
      return formatter.format(Math.round(seconds / secondsInUnit), unit);
    }
  }

  return formatter.format(Math.round(seconds / 60), "minute");
}

export function formatNumber(locale: Locale, value: number): string {
  return new Intl.NumberFormat(intlLocales[locale]).format(value);
}

/** Resolves the cardinal plural category ("one" | "other" | ...) for a count in the given locale. */
export function pluralCategory(locale: Locale, count: number): Intl.LDMLPluralRule {
  return new Intl.PluralRules(intlLocales[locale]).select(count);
}
