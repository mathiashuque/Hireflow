import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { HomeClient } from "@/components/HomeClient";
import { isLocale, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { landingMetadata, landingPath } from "@/lib/seo/landing";
import { siteUrl } from "@/lib/seo/site-origin";

export async function generateMetadata(props: PageProps<"/[lang]">): Promise<Metadata> {
  const { lang } = await props.params;
  if (!isLocale(lang)) {
    return {};
  }
  return landingMetadata(lang);
}

export default async function LandingPage(props: PageProps<"/[lang]">) {
  const { lang } = await props.params;
  if (!isLocale(lang)) {
    notFound();
  }
  const locale: Locale = lang;
  const dict = getDictionary(locale);

  // A single "WebApplication" fact sheet: only repository-supported claims, no
  // offers, ratings, or organization identity. Serialized here (not user input)
  // so no escaping hazard is introduced.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: dict.common.appName,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    description: dict.seo.appDescription,
    url: siteUrl(landingPath(locale)),
    inLanguage: locale,
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <HomeClient />
    </>
  );
}
