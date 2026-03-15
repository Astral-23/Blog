import type { ReactNode } from "react";
import { Ticker } from "@/components/ticker";
import { getPostsBySection, type Post, type Section } from "@/lib/content";
import { PostCardList } from "@/components/post-card-list";
import type { EmbedPayload } from "@/lib/embeds/types";
import { compareIsoDesc } from "@/lib/time";

type EmbedRenderer = (attrs: Record<string, string>) => ReactNode;

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

const EMBED_RENDERERS: Record<string, EmbedRenderer> = {
  latestPosts: renderLatestPosts,
  ticker: renderTicker,
};

export function renderEmbed(payload: EmbedPayload): ReactNode {
  const renderer = EMBED_RENDERERS[payload.type];
  if (!renderer) {
    return <p className="embed-error">Unknown embed type: {payload.type}</p>;
  }
  return renderer(payload.attrs);
}
