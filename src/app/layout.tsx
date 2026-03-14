import type { Metadata } from "next";
import { Noto_Sans_JP, Noto_Serif_JP, Zen_Kaku_Gothic_New } from "next/font/google";
import "./globals.css";
import "katex/dist/katex.min.css";
import { SiteHeader } from "@/components/site-header";
import { getSiteSettings, THEME_VARIANT } from "@/lib/site-config";

const notoSans = Noto_Sans_JP({
  variable: "--font-noto-sans",
  subsets: ["latin"],
});

const notoSerif = Noto_Serif_JP({
  variable: "--font-noto-serif",
  subsets: ["latin"],
});

const zenKaku = Zen_Kaku_Gothic_New({
  weight: ["300", "400", "500", "700"],
  variable: "--font-zen-kaku",
  subsets: ["latin"],
});

export function generateMetadata(): Metadata {
  const settings = getSiteSettings();
  return {
    title: settings.title,
    description: settings.description,
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const settings = getSiteSettings();

  return (
    <html lang="ja">
      <body
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
