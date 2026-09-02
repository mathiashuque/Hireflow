import type { Metadata } from "next";
import { defaultLocale, locales, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { siteUrl } from "./site-origin";
import { socialImageSize } from "./social-card";

/** `/en`, `/es`, … — the only indexable, publicly linkable marketing routes. */
export function landingPath(locale: Locale): string {
  return `/${locale}`;
}

/** Reciprocal `hreflang` alternates for the landing page, plus a stable `x-default`. */
export function landingLanguageAlternates(): Record<string, string> {
  const languages: Record<string, string> = {};
  for (const locale of locales) {
    languages[locale] = siteUrl(landingPath(locale));
  }
  // English is the repository default locale, so it is the stable x-default target
  // rather than the cookie/Accept-Language-negotiated root redirect.
  languages["x-default"] = siteUrl(landingPath(defaultLocale));
  return languages;
}

const localeOgTag: Record<Locale, string> = {
  en: "en_US",
  es: "es_419",
};

/**
 * Full public metadata for a localized landing page: canonical + hreflang alternates,
 * Open Graph, and Twitter summary-large-image fields. No private/runtime data.
 */
export function landingMetadata(locale: Locale): Metadata {
  const dict = getDictionary(locale);
  const url = siteUrl(landingPath(locale));
  const otherLocale = locales.find((candidate) => candidate !== locale);

  return {
    title: dict.seo.landingTitle,
    description: dict.seo.landingDescription,
    alternates: {
      canonical: url,
      languages: landingLanguageAlternates(),
    },
    openGraph: {
      type: "website",
      url,
      siteName: dict.common.appName,
      title: dict.seo.landingTitle,
      description: dict.seo.landingDescription,
      locale: localeOgTag[locale],
      alternateLocale: otherLocale ? [localeOgTag[otherLocale]] : undefined,
      // Next only auto-attaches the file-convention `opengraph-image.tsx` when a route
      // doesn't already declare its own `openGraph` object, so these pages (which set
      // locale/site-name fields) point at it explicitly instead.
      images: [{ url: siteUrl("/opengraph-image"), ...socialImageSize, alt: dict.seo.ogImageAlt }],
    },
    twitter: {
      card: "summary_large_image",
      title: dict.seo.landingTitle,
      description: dict.seo.landingDescription,
      images: [siteUrl("/twitter-image")],
    },
  };
}

/** Robots directive shared by every authenticated/transactional route. */
export const privateRouteMetadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};
