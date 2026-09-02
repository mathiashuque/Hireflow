"use client";

import { useRouter, usePathname } from "next/navigation";
import { locales, localeCookieMaxAge, localeCookieName, type Locale } from "@/i18n/config";
import { useI18n } from "@/i18n/LocaleProvider";
import { replaceLocaleInPath } from "@/i18n/routing";

/**
 * Compact, accessible English/Español selector. A native <select> gives
 * correct semantics, keyboard operation, and visible focus for free.
 * Switching navigates to the equivalent route in the chosen locale
 * (preserving path, dynamic segments, and query string) and persists the
 * choice in the locale preference cookie for future unprefixed visits.
 */
export function LanguageSwitcher() {
  const { locale, dict } = useI18n();
  const router = useRouter();
  const pathname = usePathname();

  function handleChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const nextLocale = event.target.value as Locale;
    if (nextLocale === locale) {
      return;
    }

    document.cookie = `${localeCookieName}=${nextLocale}; Max-Age=${localeCookieMaxAge}; Path=/; SameSite=Lax`;

    // Read the query string at click time (rather than via useSearchParams) so this
    // component never forces a Suspense boundary / opts pages out of static generation.
    const query = typeof window !== "undefined" ? window.location.search : "";
    const currentPathWithQuery = `${pathname ?? "/"}${query}`;
    router.push(replaceLocaleInPath(currentPathWithQuery, nextLocale));
  }

  return (
    <label className="inline-flex items-center gap-1.5 text-xs font-medium text-text-secondary">
      <span className="sr-only">{dict.nav.languageSwitcherLabel}</span>
      <select
        value={locale}
        onChange={handleChange}
        aria-label={dict.nav.languageSwitcherLabel}
        className="rounded-full border border-border-strong bg-surface px-2.5 py-1.5 text-xs font-medium text-text-secondary outline-none transition hover:border-brand hover:text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      >
        {locales.map((option) => (
          <option key={option} value={option}>
            {option === "en" ? dict.nav.languageEnglish : dict.nav.languageSpanish}
          </option>
        ))}
      </select>
    </label>
  );
}
