import type { ReactNode } from "react";
import { Ticker } from "@/components/ticker";
import { getPostsBySection, type Post, type Section } from "@/lib/content";
import { PostCardList } from "@/components/post-card-list";
import type { EmbedPayload } from "@/lib/embeds/types";
import { compareIsoDesc } from "@/lib/time";
import { AccessCounterDigits } from "@/components/access-counter";

type EmbedRenderer = (attrs: Record<string, string>) => ReactNode;

const SIZE_PRESETS: Record<string, string> = {
  xs: "0.75rem",
  sm: "0.875rem",
  md: "1rem",
  lg: "1.25rem",
  xl: "1.5rem",
  "2xl": "1.875rem",
};

function parseIntWithBounds(raw: string | undefined, fallback: number, min: number, max: number): number {
  if (!raw) {
    return fallback;
  }
  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed)) {
    return fallback;
  }
  return Math.min(Math.max(parsed, min), max);
}

function parseSource(raw: string | undefined): Section | "all" {
  if (raw === "blog" || raw === "blog-tech" || raw === "all") {
    return raw;
  }
  return "all";
}

function resolveTickerDuration(value: string | undefined): number | null {
  if (value === "slow") {
    return 12;
  }
  if (value === "fast") {
    return 3;
  }
  if (value === "normal") {
    return 6;
  }
  if (typeof value === "string") {
    const roundTripsPerSec = Number.parseFloat(value);
    if (!Number.isNaN(roundTripsPerSec) && roundTripsPerSec > 0) {
      const halfTripDuration = 1 / (2 * roundTripsPerSec);
      return Math.max(0.25, Math.min(60, halfTripDuration));
    }
    if (!Number.isNaN(roundTripsPerSec) && roundTripsPerSec <= 0) {
      return null;
    }
  }
  return 6;
}

function loadLatestPosts(source: Section | "all", count: number): Post[] {
  const sections: Section[] = source === "all" ? ["blog", "blog-tech"] : [source];
  return sections
    .flatMap((section) => getPostsBySection(section))
    .sort((a, b) => {
      const publishedDiff = compareIsoDesc(a.publishedAt, b.publishedAt);
      if (publishedDiff !== 0) {
        return publishedDiff;
      }
      return compareIsoDesc(a.updatedAt, b.updatedAt);
    })
    .slice(0, count);
}

function renderLatestPosts(attrs: Record<string, string>): ReactNode {
  const count = parseIntWithBounds(attrs.count, 5, 1, 20);
  const source = parseSource(attrs.source);
  const posts = loadLatestPosts(source, count);

  if (posts.length === 0) {
    return <p className="embed-note">最新記事はまだありません。</p>;
  }

  return (
    <section aria-label="Latest posts">
      <PostCardList posts={posts} />
    </section>
  );
}

function renderTicker(attrs: Record<string, string>): ReactNode {
  const text = attrs.text ?? "";
  return (
    <Ticker
      text={text}
      durationSec={resolveTickerDuration(attrs.speed)}
      color={attrs.color}
      initialNowIso={new Date().toISOString()}
    />
  );
}

function renderCounter(attrs: Record<string, string>): ReactNode {
  const key = attrs.counterKey ?? "home";
  const digits = parseIntWithBounds(attrs.digits, 7, 1, 12);
  return <AccessCounterDigits counterKey={key} digits={digits} />;
}

function resolveTextPosition(raw: string | undefined): "left" | "center" | "right" {
  if (raw === "center" || raw === "right" || raw === "left") {
    return raw;
  }
  return "left";
}

function resolveTextSize(raw: string | undefined): string | undefined {
  if (!raw) {
    return undefined;
  }

  if (SIZE_PRESETS[raw]) {
    return SIZE_PRESETS[raw];
  }

  if (/^\d+(\.\d+)?$/.test(raw)) {
    return `${raw}rem`;
  }

  if (/^\d+(\.\d+)?(px|rem|em|%)$/.test(raw)) {
    return raw;
  }

  return undefined;
}

function resolveTextColor(raw: string | undefined): string | undefined {
  if (!raw) {
    return undefined;
  }

  if (raw === "text") {
    return "var(--text)";
  }
  if (raw === "muted") {
    return "var(--muted)";
  }
  if (raw === "accent") {
    return "var(--accent)";
  }
  if (raw === "white" || raw === "black") {
    return raw;
  }

  if (/^#[0-9a-fA-F]{3,8}$/.test(raw)) {
    return raw;
  }

  if (/^(rgb|rgba|hsl|hsla)\([^)]+\)$/.test(raw)) {
    return raw;
  }

  if (/^[a-zA-Z]+$/.test(raw)) {
    return raw;
  }

  return undefined;
}

function renderStyledText(attrs: Record<string, string>): ReactNode {
  const text = attrs.text?.trim() ?? "";
  if (!text) {
    return <p className="embed-error">Text embed requires text content.</p>;
  }

  const position = resolveTextPosition(attrs.position);
  const fontSize = resolveTextSize(attrs.size);
  const color = resolveTextColor(attrs.color);
  const style: Record<string, string> = {};
  if (fontSize) {
    style.fontSize = fontSize;
  }
  if (color) {
    style.color = color;
  }

  return (
    <p
      className={`embed-styled-text embed-styled-text-${position}`}
      style={Object.keys(style).length > 0 ? style : undefined}
    >
      {text}
    </p>
  );
}

const EMBED_RENDERERS: Record<string, EmbedRenderer> = {
  latestPosts: renderLatestPosts,
  ticker: renderTicker,
  counter: renderCounter,
  text: renderStyledText,
  styledText: renderStyledText,
};

export function renderEmbed(payload: EmbedPayload): ReactNode {
  const renderer = EMBED_RENDERERS[payload.type];
  if (!renderer) {
    return <p className="embed-error">Unknown embed type: {payload.type}</p>;
  }
  return renderer(payload.attrs);
}
