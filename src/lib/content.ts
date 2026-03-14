import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

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

function getGitDates(filePath: string): { publishedAt: string; updatedAt: string } {
  const relativePath = path.relative(process.cwd(), filePath);

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
      return {
        updatedAt: lines[0],
        publishedAt: lines[lines.length - 1],
      };
    }
  } catch {
    // Fall through to filesystem dates when git history is unavailable.
  }

  const stat = fs.statSync(filePath);
  return {
    publishedAt: stat.birthtime.toISOString(),
    updatedAt: stat.mtime.toISOString(),
  };
}

function makePost(filePath: string, section: Section): Post {
  const slug = path.basename(filePath, ".md");
  const raw = readText(filePath);
  const parsed = matter(raw);
  const content = parsed.content;
  const title = guessTitle(content, slug);
  const customSummary =
    typeof parsed.data.summary === "string" && parsed.data.summary.trim().length > 0
      ? parsed.data.summary.trim()
      : null;
  const excerpt = customSummary ?? makeExcerpt(content);
  const dates = getGitDates(filePath);

  return {
    slug,
    title,
    content,
    excerpt,
    section,
    publishedAt: dates.publishedAt,
    updatedAt: dates.updatedAt,
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
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}

export function getPostBySlug(section: Section, slug: string): Post | null {
  const filePath = path.join(CONTENT_ROOT, section, `${slug}.md`);
  if (!fs.existsSync(filePath)) {
    return null;
  }
  return makePost(filePath, section);
}
