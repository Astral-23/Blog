import type { Metadata } from "next";
import { Noto_Sans_JP, Noto_Serif_JP, Zen_Kaku_Gothic_New } from "next/font/google";
import "./globals.css";
import "katex/dist/katex.min.css";
import { SiteHeader } from "@/components/site-header";
import { getSiteUrl, resolveCardImage } from "@/lib/metadata";
import { getSiteSettings, THEME_VARIANT } from "@/lib/site-config";

const notoSans = Noto_Sans_JP({
  variable: "--font-noto-sans",
  subsets: ["latin"],
  preload: false,
});

const notoSerif = Noto_Serif_JP({
  variable: "--font-noto-serif",
  subsets: ["latin"],
  preload: false,
});

const zenKaku = Zen_Kaku_Gothic_New({
  weight: ["300", "400", "500", "700"],
  variable: "--font-zen-kaku",
  subsets: ["latin"],
  preload: false,
});

export function generateMetadata(): Metadata {
  const settings = getSiteSettings();
  const siteUrl = getSiteUrl();
  const defaultImage = resolveCardImage(null);
  return {
    title: settings.title,
    description: settings.description,
    metadataBase: new URL(siteUrl),
    openGraph: {
      title: settings.title,
      description: settings.description,
      url: siteUrl,
      siteName: settings.title,
      locale: "ja_JP",
      type: "website",
      images: [{ url: defaultImage, width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title: settings.title,
      description: settings.description,
      images: [defaultImage],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const settings = getSiteSettings();

  return (
    <html lang="ja" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className={`${notoSans.variable} ${notoSerif.variable} ${zenKaku.variable}`}
        data-theme={THEME_VARIANT}
        data-font={settings.fontVariant}
      >
        <SiteHeader />
        <main className="site-main">{children}</main>
      </body>
    </html>
  );
}
