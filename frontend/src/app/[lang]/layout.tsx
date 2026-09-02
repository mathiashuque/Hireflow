import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { Geist, Geist_Mono } from "next/font/google";
import { AuthProvider } from "@/lib/auth/AuthProvider";
import { MotionProvider } from "@/components/motion/MotionProvider";
import { LocaleProvider } from "@/i18n/LocaleProvider";
import { getDictionary } from "@/i18n/dictionaries";
import { isLocale, locales, type Locale } from "@/i18n/config";
import { getSiteOrigin } from "@/lib/seo/site-origin";
import "../globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

export async function generateMetadata(props: LayoutProps<"/[lang]">): Promise<Metadata> {
  const { lang } = await props.params;
  const base: Metadata = {
    metadataBase: new URL(getSiteOrigin()),
    title: {
      default: "Hireflow",
      template: "%s | Hireflow",
    },
    applicationName: "Hireflow",
    creator: "Hireflow",
    publisher: "Hireflow",
    referrer: "strict-origin-when-cross-origin",
    formatDetection: {
      email: false,
      address: false,
      telephone: false,
    },
  };

  if (!isLocale(lang)) {
    return base;
  }

  const dict = getDictionary(lang);
  return {
    ...base,
    title: {
      default: dict.common.appName,
      template: "%s | Hireflow",
    },
    description: dict.seo.appDescription,
  };
}

export function generateViewport(): Viewport {
  return {
    themeColor: "#4338ca",
    colorScheme: "light",
  };
}

export default async function LocaleLayout({ children, params }: LayoutProps<"/[lang]">) {
  const { lang } = await params;

  if (!isLocale(lang)) {
    notFound();
  }

  const locale: Locale = lang;

  return (
    <html
      lang={locale}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-canvas text-text-primary">
        <LocaleProvider locale={locale}>
          <MotionProvider>
            <AuthProvider>{children}</AuthProvider>
          </MotionProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}
