"use client";

import { createContext, useContext, useMemo } from "react";
import type { Locale } from "./config";
import { getDictionary, type Dictionary } from "./dictionaries";
import { localizePath } from "./routing";
import { formatDate, formatDateTime, formatNumber, formatRelativeTime } from "./format";

type LocaleContextValue = {
  locale: Locale;
  dict: Dictionary;
  /** Prefixes an internal, locale-free path (e.g. "/dashboard") with the active locale. */
  href: (path: string) => string;
  formatDate: (iso: string) => string;
  formatDateTime: (iso: string) => string;
  formatRelativeTime: (iso: string) => string;
  formatNumber: (value: number) => string;
};

const LocaleContext = createContext<LocaleContextValue | undefined>(undefined);

type LocaleProviderProps = {
  locale: Locale;
  children: React.ReactNode;
};

/**
 * Narrow client boundary that makes the active locale, its dictionary, and
 * locale-aware helpers available to every Client Component without prop
 * drilling. Initialized at the locale layout boundary with only the
 * server-resolved `locale` (a plain string, safely serializable across the
 * server/client boundary); the dictionary itself — which contains functions
 * for interpolation/JSX — is looked up on the client from that locale
 * rather than passed down, since functions cannot cross a Server->Client
 * Component prop boundary.
 */
export function LocaleProvider({ locale, children }: LocaleProviderProps) {
  const dict = useMemo(() => getDictionary(locale), [locale]);

  const value = useMemo<LocaleContextValue>(
    () => ({
      locale,
      dict,
      href: (path: string) => localizePath(locale, path),
      formatDate: (iso: string) => formatDate(locale, iso),
      formatDateTime: (iso: string) => formatDateTime(locale, iso),
      formatRelativeTime: (iso: string) => formatRelativeTime(locale, iso),
      formatNumber: (value: number) => formatNumber(locale, value),
    }),
    [locale, dict],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useI18n(): LocaleContextValue {
  const context = useContext(LocaleContext);
  if (!context) {
    throw new Error("useI18n must be used within a LocaleProvider.");
  }
  return context;
}
