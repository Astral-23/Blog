import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { compareIsoDesc, toEpochMs } from "@/lib/time";

export type Section = "blog" | "blog-tech";

export type Post = {
  slug: string;
  title: string;
  content: string;
  excerpt: string;
  section: Section;
  publishedAt: string;
  updatedAt: string;
  sourcePath: string;
};

const CONTENT_ROOT = path.join(process.cwd(), "content");
const GIT_DATE_CACHE = new Map<string, { publishedAt: string; updatedAt: string; source: "git" | "fs" }>();
const PUBLISHED_AT_MEMO_PATH = path.join(CONTENT_ROOT, ".meta", "published-at.json");
const UPDATED_AT_MEMO_PATH = path.join(CONTENT_ROOT, ".meta", "updated-at.json");
let publishedAtMemoCache: Record<string, string> | null = null;
let updatedAtMemoCache: Record<string, string> | null = null;

export function __resetContentCachesForTest(): void {
  GIT_DATE_CACHE.clear();
  publishedAtMemoCache = null;
  updatedAtMemoCache = null;
}

function readText(filePath: string): string {
  return fs.readFileSync(filePath, "utf8");
}

function guessTitle(content: string, slug: string): string {
  const heading = content.match(/^#\s+(.+)$/m);
  if (heading?.[1]) {
    return heading[1].trim();
  }
  return slug;
}

function makeExcerpt(content: string): string {
  const lines = content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#") && !line.startsWith("!["));

  if (!lines[0]) {
    return "";
  }

  const joined = lines.join(" ");
  return joined.length > 140 ? `${joined.slice(0, 140)}...` : joined;
}

function getGitDates(filePath: string): { publishedAt: string; updatedAt: string; source: "git" | "fs" } {
  const relativePath = path.relative(process.cwd(), filePath);
  const cached = GIT_DATE_CACHE.get(relativePath);
  if (cached) {
    return cached;
  }

  try {
    const output = execFileSync(
      "git",
      ["log", "--follow", "--format=%aI", "--", relativePath],
      {
        cwd: process.cwd(),
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      },
    ).trim();

    if (output) {
      const lines = output.split("\n").filter(Boolean);
      const dates = {
        updatedAt: lines[0],
        publishedAt: lines[lines.length - 1],
        source: "git" as const,
      };
      GIT_DATE_CACHE.set(relativePath, dates);
      return dates;
    }
  } catch {
    // Fall through to filesystem dates when git history is unavailable.
  }

  const stat = fs.statSync(filePath);
  const fallbackDates = {
    publishedAt: stat.birthtime.toISOString(),
    updatedAt: stat.mtime.toISOString(),
    source: "fs" as const,
  };
  GIT_DATE_CACHE.set(relativePath, fallbackDates);
  return fallbackDates;
}

function getPublishedAtMemo(): Record<string, string> {
  if (publishedAtMemoCache) {
    return publishedAtMemoCache;
  }

  try {
    if (!fs.existsSync(PUBLISHED_AT_MEMO_PATH)) {
      publishedAtMemoCache = {};
      return publishedAtMemoCache;
    }
    const raw = fs.readFileSync(PUBLISHED_AT_MEMO_PATH, "utf8");
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      publishedAtMemoCache = {};
      return publishedAtMemoCache;
    }
    const memo: Record<string, string> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === "string" && value.length > 0) {
        memo[key] = value;
      }
    }
    publishedAtMemoCache = memo;
    return publishedAtMemoCache;
  } catch {
    publishedAtMemoCache = {};
    return publishedAtMemoCache;
  }
}

function persistPublishedAtMemo(memo: Record<string, string>): void {
  try {
    fs.mkdirSync(path.dirname(PUBLISHED_AT_MEMO_PATH), { recursive: true });
    fs.writeFileSync(PUBLISHED_AT_MEMO_PATH, `${JSON.stringify(memo, null, 2)}\n`, "utf8");
  } catch {
    // Non-fatal: keep runtime behavior even if memo file is not writable.
  }
}

function getUpdatedAtMemo(): Record<string, string> {
  if (updatedAtMemoCache) {
    return updatedAtMemoCache;
  }

  try {
    if (!fs.existsSync(UPDATED_AT_MEMO_PATH)) {
      updatedAtMemoCache = {};
      return updatedAtMemoCache;
    }
    const raw = fs.readFileSync(UPDATED_AT_MEMO_PATH, "utf8");
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      updatedAtMemoCache = {};
      return updatedAtMemoCache;
    }
    const memo: Record<string, string> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === "string" && value.length > 0) {
        memo[key] = value;
      }
    }
    updatedAtMemoCache = memo;
    return updatedAtMemoCache;
  } catch {
    updatedAtMemoCache = {};
    return updatedAtMemoCache;
  }
}

function persistUpdatedAtMemo(memo: Record<string, string>): void {
  try {
    fs.mkdirSync(path.dirname(UPDATED_AT_MEMO_PATH), { recursive: true });
    fs.writeFileSync(UPDATED_AT_MEMO_PATH, `${JSON.stringify(memo, null, 2)}\n`, "utf8");
  } catch {
    // Non-fatal: keep runtime behavior even if memo file is not writable.
  }
}

function resolvePublishedAt(filePath: string, fallback: string): string {
  const relativePath = path.relative(process.cwd(), filePath);
  const memo = getPublishedAtMemo();

  if (memo[relativePath]) {
    return memo[relativePath];
  }

  memo[relativePath] = fallback;
  persistPublishedAtMemo(memo);
  return fallback;
}

function resolveUpdatedAt(
  filePath: string,
  fallback: string,
  publishedAt: string,
  source: "git" | "fs",
): string {
  const relativePath = path.relative(process.cwd(), filePath);
  const memo = getUpdatedAtMemo();
  const current = memo[relativePath];

  if (!current) {
    const initial = fallback || publishedAt;
    memo[relativePath] = initial;
    persistUpdatedAtMemo(memo);
    return initial;
  }

  // Advance only when git history reports a newer update.
  if (source === "git" && toEpochMs(fallback) > toEpochMs(current)) {
    memo[relativePath] = fallback;
    persistUpdatedAtMemo(memo);
    return fallback;
  }

  return current;
}

function makePost(filePath: string, section: Section): Post {
  const slug = path.basename(filePath, ".md");
  const raw = readText(filePath);
  const parsed = matter(raw);
  const content = parsed.content;
  const customTitle =
    typeof parsed.data.title === "string" && parsed.data.title.trim().length > 0
      ? parsed.data.title.trim()
      : null;
  const title = customTitle ?? guessTitle(content, slug);
  const customSummary =
    typeof parsed.data.summary === "string" && parsed.data.summary.trim().length > 0
      ? parsed.data.summary.trim()
      : null;
  const excerpt = customSummary ?? makeExcerpt(content);
  const dates = getGitDates(filePath);
  const publishedAt = resolvePublishedAt(filePath, dates.publishedAt);
  const updatedAt = resolveUpdatedAt(filePath, dates.updatedAt, publishedAt, dates.source);

  return {
    slug,
    title,
    content,
    excerpt,
    section,
    publishedAt,
    updatedAt,
    sourcePath: filePath,
  };
}

function listMarkdownFiles(directory: string): string[] {
  if (!fs.existsSync(directory)) {
    return [];
  }

  return fs
    .readdirSync(directory)
    .filter((name) => name.endsWith(".md"))
    .map((name) => path.join(directory, name));
}

export function getHomeMarkdown(): string {
  const homePath = path.join(CONTENT_ROOT, "home.md");
  if (!fs.existsSync(homePath)) {
    return "# Home\n\n`content/home.md` を作成すると内容が表示されます。";
  }
  return readText(homePath);
}

export function getPostsBySection(section: Section): Post[] {
  const sectionDir = path.join(CONTENT_ROOT, section);
  const files = listMarkdownFiles(sectionDir);

  return files
    .map((filePath) => makePost(filePath, section))
    .sort((a, b) => compareIsoDesc(a.publishedAt, b.publishedAt));
}

export function getPostBySlug(section: Section, slug: string): Post | null {
  const filePath = path.join(CONTENT_ROOT, section, `${slug}.md`);
  if (!fs.existsSync(filePath)) {
    return null;
  }
  return makePost(filePath, section);
}
