/**
 * Single source of truth for supported locales. Route validation, dictionary
 * loading, the locale cookie, and UI labels must all derive from this file so
 * the set of supported locales is never duplicated.
 */
export const locales = ["en", "es"] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "en";

export const localeLabels: Record<Locale, string> = {
  en: "English",
  es: "Español",
};

/** The formatting locale passed to `Intl` APIs for each route locale. */
export const intlLocales: Record<Locale, string> = {
  en: "en-US",
  es: "es-419",
};

export const localeCookieName = "hireflow_locale";

/** ~1 year, in seconds. The cookie stores a presentation preference only. */
export const localeCookieMaxAge = 60 * 60 * 24 * 365;

export function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}

/**
 * Picks a supported locale from an `Accept-Language` header value.
 * Only distinguishes Spanish vs. English (the two supported locales); any
 * other language preference falls back to the default locale.
 */
export function negotiateLocaleFromAcceptLanguage(
  header: string | null | undefined,
): Locale {
  if (!header) {
    return defaultLocale;
  }

  const entries = header
    .split(",")
    .map((part) => {
      const [rawTag, ...params] = part.trim().split(";");
      const tag = rawTag?.trim().toLowerCase();
      if (!tag) {
        return null;
      }
      const qParam = params.find((p) => p.trim().startsWith("q="));
      const quality = qParam ? Number.parseFloat(qParam.trim().slice(2)) : 1;
      return { tag, quality: Number.isFinite(quality) ? quality : 1 };
    })
    .filter((entry): entry is { tag: string; quality: number } => entry !== null)
    .sort((a, b) => b.quality - a.quality);

  for (const entry of entries) {
    if (entry.quality <= 0) {
      continue;
    }
    const primary = entry.tag.split("-")[0];
    if (primary === "es") {
      return "es";
    }
    if (primary === "en") {
      return "en";
    }
  }

  return defaultLocale;
}
