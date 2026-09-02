import type { MetadataRoute } from "next";
import { defaultLocale } from "@/i18n/config";
import { landingPath } from "@/lib/seo/landing";

/**
 * A standard installable-web-app manifest. Hireflow doesn't claim offline support or
 * background sync, so this only declares what the app actually is: an ordinary
 * standalone-launching web application, starting at the default-locale landing page.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Hireflow",
    short_name: "Hireflow",
    description: "A secure, multi-tenant hiring tracker for job openings and candidate pipelines.",
    start_url: landingPath(defaultLocale),
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#4338ca",
    icons: [
      {
        src: "/icon1",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon2",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
