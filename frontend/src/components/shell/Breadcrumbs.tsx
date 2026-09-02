"use client";

import Link from "next/link";
import { useI18n } from "@/i18n/LocaleProvider";

export type Crumb = {
  label: string;
  href?: string;
};

/**
 * Compact route hierarchy. The final crumb is always the current page (no link).
 * Omit a crumb entirely rather than linking to a route whose identifier isn't known yet.
 * `href` values passed in must already be locale-prefixed (build them with `useI18n().href`).
 */
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  const { dict } = useI18n();

  if (items.length === 0) {
    return null;
  }

  return (
    <nav aria-label={dict.nav.breadcrumbLabel} className="overflow-x-auto">
      <ol className="flex min-w-max items-center gap-1.5 text-sm text-text-muted">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li key={`${item.label}-${index}`} className="flex items-center gap-1.5">
              {index > 0 ? (
                <span aria-hidden className="text-border-strong">
                  /
                </span>
              ) : null}
              {item.href && !isLast ? (
                <Link
                  href={item.href}
                  className="rounded-sm font-medium text-text-secondary transition hover:text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                >
                  {item.label}
                </Link>
              ) : (
                <span aria-current={isLast ? "page" : undefined} className="font-medium text-text-primary">
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
