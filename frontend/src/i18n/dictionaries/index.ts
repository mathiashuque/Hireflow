import type { Locale } from "../config";
import { en } from "./en";
import { es } from "./es";
import type { Dictionary } from "./en";

export type { Dictionary } from "./en";

const dictionaries: Record<Locale, Dictionary> = { en, es };

/** Synchronous lookup — dictionaries are small, plain TS objects, so no async import is needed. */
export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale];
}
