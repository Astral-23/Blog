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

type SiteSettings = {
  title: string;
  description: string;
  navigation: NavItem[];
  fontVariant: FontVariant;
  blogLead: string;
  blogTechLead: string;
};

const DEFAULT_SETTINGS: SiteSettings = {
  title: "Nozomi Blog",
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

export function getSiteSettings(): SiteSettings {
  if (!fs.existsSync(SETTINGS_PATH)) {
    return DEFAULT_SETTINGS;
  }

  try {
    const raw = fs.readFileSync(SETTINGS_PATH, "utf8");
    const parsed = JSON.parse(raw) as Partial<SiteSettings>;

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

    return {
      title,
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
