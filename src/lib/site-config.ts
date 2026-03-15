import fs from "node:fs";
import path from "node:path";

export type NavItem = {
  href: string;
  label: string;
};

export type FontVariant =
  | "classic"
  | "clean-sans"
  | "kaku"
  | "kaku-light"
  | "tech-sans"
  | "system-sans";

export type TitleSegment = {
  text: string;
  size: number;
};

type SiteSettings = {
  title: string;
  titleSegments: TitleSegment[];
  description: string;
  navigation: NavItem[];
  fontVariant: FontVariant;
  blogLead: string;
  blogTechLead: string;
};

const DEFAULT_SETTINGS: SiteSettings = {
  title: "Nozomi Blog",
  titleSegments: [{ text: "Nozomi Blog", size: 1 }],
  description: "Markdown driven blog",
  navigation: [
    { href: "/", label: "home" },
    { href: "/blog", label: "blog" },
    { href: "/blog-tech", label: "blog-tech" },
  ],
  fontVariant: "classic",
  blogLead: "",
  blogTechLead: "",
};

const SETTINGS_PATH = path.join(process.cwd(), "content", "site.json");

function isNavItem(value: unknown): value is NavItem {
  if (!value || typeof value !== "object") {
    return false;
  }
  const maybe = value as Record<string, unknown>;
  return typeof maybe.href === "string" && typeof maybe.label === "string";
}

function resolveFontVariant(value: unknown): FontVariant {
  if (
    value === "classic" ||
    value === "clean-sans" ||
    value === "kaku" ||
    value === "kaku-light" ||
    value === "tech-sans" ||
    value === "system-sans"
  ) {
    return value;
  }
  return DEFAULT_SETTINGS.fontVariant;
}

function parseTitleSegmentSize(value: unknown): number {
  if (value === "normal") {
    return 1;
  }
  if (value === "small") {
    return 0.78;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.min(Math.max(value, 0.5), 2);
  }
  return 1;
}

function parseTitleSegments(value: unknown): TitleSegment[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const segments = value
    .filter((item) => item && typeof item === "object")
    .map((item) => {
      const maybe = item as Record<string, unknown>;
      const text = typeof maybe.text === "string" ? maybe.text.trim() : "";
      const size = parseTitleSegmentSize(maybe.size);
      return { text, size };
    })
    .filter((segment) => segment.text.length > 0);

  return segments.length > 0 ? segments : null;
}

export function getSiteSettings(): SiteSettings {
  if (!fs.existsSync(SETTINGS_PATH)) {
    return DEFAULT_SETTINGS;
  }

  try {
    const raw = fs.readFileSync(SETTINGS_PATH, "utf8");
    const parsed = JSON.parse(raw) as Partial<SiteSettings> & {
      titleSegments?: unknown;
    };

    const title =
      typeof parsed.title === "string" && parsed.title.trim().length > 0
        ? parsed.title.trim()
        : DEFAULT_SETTINGS.title;
    const description =
      typeof parsed.description === "string" && parsed.description.trim().length > 0
        ? parsed.description.trim()
        : DEFAULT_SETTINGS.description;
    const navigation = Array.isArray(parsed.navigation)
      ? parsed.navigation.filter(isNavItem)
      : DEFAULT_SETTINGS.navigation;
    const titleSegments =
      parseTitleSegments(parsed.titleSegments) ?? [{ text: title, size: 1 }];

    return {
      title,
      titleSegments,
      description,
      navigation: navigation.length > 0 ? navigation : DEFAULT_SETTINGS.navigation,
      fontVariant: resolveFontVariant(parsed.fontVariant),
      blogLead:
        typeof parsed.blogLead === "string" ? parsed.blogLead : DEFAULT_SETTINGS.blogLead,
      blogTechLead:
        typeof parsed.blogTechLead === "string" ? parsed.blogTechLead : DEFAULT_SETTINGS.blogTechLead,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export type ThemeVariant = "minimal" | "labnote" | "magazine";

function resolveThemeVariant(value: string | undefined): ThemeVariant {
  if (value === "minimal" || value === "labnote" || value === "magazine") {
    return value;
  }
  return "minimal";
}

// Change with: THEME_VARIANT=minimal|labnote|magazine npm run dev
export const THEME_VARIANT: ThemeVariant = resolveThemeVariant(process.env.THEME_VARIANT);
