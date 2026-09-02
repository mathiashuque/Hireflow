import { type Locale, locales } from "./config";

/**
 * Prefixes an internal, already-locale-free path with the given locale.
 * `path` must start with "/" and must not already contain a locale segment.
 * Query strings/hashes are preserved as-is since they are part of `path`.
 */
export function localizePath(locale: Locale, path: string): string {
  if (!path.startsWith("/")) {
    throw new Error(`localizePath expects an absolute path, received "${path}"`);
  }

  const withoutLocale = stripLocale(path);
  if (withoutLocale === "/") {
    return `/${locale}`;
  }
  return `/${locale}${withoutLocale}`;
}

/** Removes a leading `/en` or `/es` segment from a pathname, if present. */
export function stripLocale(pathname: string): string {
  const segments = pathname.split("/");
  // pathname starts with "/", so segments[0] === "".
  const first = segments[1];
  if (first && (locales as readonly string[]).includes(first)) {
    const rest = "/" + segments.slice(2).join("/");
    return rest === "/" ? "/" : rest.replace(/\/+$/, "") || "/";
  }
  return pathname === "" ? "/" : pathname;
}

/** Swaps the locale segment of a full path (with optional query/hash) to `nextLocale`. */
export function replaceLocaleInPath(pathWithQuery: string, nextLocale: Locale): string {
  const hashIndex = pathWithQuery.indexOf("#");
  const hash = hashIndex >= 0 ? pathWithQuery.slice(hashIndex) : "";
  const withoutHash = hashIndex >= 0 ? pathWithQuery.slice(0, hashIndex) : pathWithQuery;

  const queryIndex = withoutHash.indexOf("?");
  const query = queryIndex >= 0 ? withoutHash.slice(queryIndex) : "";
  const pathname = queryIndex >= 0 ? withoutHash.slice(0, queryIndex) : withoutHash;

  return `${localizePath(nextLocale, pathname)}${query}${hash}`;
}
