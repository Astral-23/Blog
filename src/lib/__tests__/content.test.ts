import { beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import {
  __resetContentCachesForTest,
  getHomeMarkdown,
  getPostBySlug,
  getPostsBySection,
} from "@/lib/content";

vi.mock("node:fs", () => ({
  default: {
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
    readdirSync: vi.fn(),
    statSync: vi.fn(),
    mkdirSync: vi.fn(),
    writeFileSync: vi.fn(),
  },
}));

vi.mock("node:child_process", () => {
  const fn = vi.fn();
  return {
    default: {
      execFileSync: fn,
    },
    execFileSync: fn,
  };
});

describe("content library", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    __resetContentCachesForTest();
  });

  it("returns fallback home markdown when home.md is missing", () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);

    const markdown = getHomeMarkdown();

    expect(markdown).toContain("content/home.md");
  });

  it("builds posts sorted by publishedAt and respects frontmatter", () => {
    vi.mocked(fs.existsSync).mockImplementation((path) =>
      String(path).includes("content/blog"),
    );
    vi.mocked(fs.readdirSync).mockReturnValue(["first.md", "second.md"] as unknown as string[]);
    vi.mocked(fs.readFileSync).mockImplementation((path) => {
      const p = String(path);
      if (p.endsWith("first.md")) {
        return `---\ntitle: \"Custom Title\"\nsummary: \"Custom Summary\"\n---\n# ignored\ncontent`;
      }
      return "# Derived Title\n\nThis excerpt should be auto generated from body.";
    });
    vi.mocked(execFileSync).mockImplementation((_, args) => {
      const target = String(args?.[args.length - 1] ?? "");
      if (target.endsWith("first.md")) {
        return "2026-01-10T00:00:00.000Z\n2026-01-01T00:00:00.000Z";
      }
      return "2026-02-10T00:00:00.000Z\n2026-02-01T00:00:00.000Z";
    });

    const posts = getPostsBySection("blog");

    expect(posts).toHaveLength(2);
    expect(posts[0].slug).toBe("second");
    expect(posts[0].title).toBe("Derived Title");
    expect(posts[1].title).toBe("Custom Title");
    expect(posts[1].excerpt).toBe("Custom Summary");
  });

  it("ignores frontmatter publishedAt and uses git dates", () => {
    vi.mocked(fs.existsSync).mockImplementation((path) =>
      String(path).includes("content/blog"),
    );
    vi.mocked(fs.readdirSync).mockReturnValue(["published.md"] as unknown as string[]);
    vi.mocked(fs.readFileSync).mockReturnValue(
      `---\ntitle: "Pinned"\npublishedAt: "2026-03-15T10:24:33+09:00"\n---\n# body`,
    );
    vi.mocked(execFileSync).mockReturnValue(
      "2026-03-16T06:30:15+09:00\n2026-03-14T03:00:00+09:00",
    );

    const posts = getPostsBySection("blog");

    expect(posts).toHaveLength(1);
    expect(posts[0].publishedAt).toBe("2026-03-14T03:00:00+09:00");
    expect(posts[0].updatedAt).toBe("2026-03-16T06:30:15+09:00");
  });

  it("caches git date lookups for the same file path", () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue("# Cache Test");
    vi.mocked(execFileSync).mockReturnValue("2026-03-16T06:30:15+09:00");

    const first = getPostBySlug("blog", "cache-target");
    const second = getPostBySlug("blog", "cache-target");

    expect(first).not.toBeNull();
    expect(second).not.toBeNull();
    expect(execFileSync).toHaveBeenCalledTimes(1);
  });

  it("memoizes first publishedAt and reuses it even when later git dates differ", () => {
    let publishedMemoRaw = "{}";
    let updatedMemoRaw = "{}";
    vi.mocked(fs.existsSync).mockImplementation((target) => {
      const p = String(target);
      if (p.endsWith("content/.meta/published-at.json")) {
        return true;
      }
      if (p.endsWith("content/.meta/updated-at.json")) {
        return true;
      }
      return p.includes("content/blog");
    });
    vi.mocked(fs.readdirSync).mockReturnValue(["memo.md"] as unknown as string[]);
    vi.mocked(fs.readFileSync).mockImplementation((target) => {
      const p = String(target);
      if (p.endsWith("content/.meta/published-at.json")) {
        return publishedMemoRaw;
      }
      if (p.endsWith("content/.meta/updated-at.json")) {
        return updatedMemoRaw;
      }
      return "# Memo Post";
    });
    vi.mocked(fs.writeFileSync).mockImplementation((target, value) => {
      const p = String(target);
      if (p.endsWith("content/.meta/published-at.json")) {
        publishedMemoRaw = String(value);
        return;
      }
      if (p.endsWith("content/.meta/updated-at.json")) {
        updatedMemoRaw = String(value);
      }
    });

    vi.mocked(execFileSync).mockReturnValueOnce("2026-03-15T10:24:33+09:00");
    const first = getPostBySlug("blog", "memo");

    __resetContentCachesForTest();
    vi.mocked(execFileSync).mockReturnValueOnce("2026-03-16T10:24:33+09:00");
    const second = getPostBySlug("blog", "memo");

    expect(first?.publishedAt).toBe("2026-03-15T10:24:33+09:00");
    expect(second?.publishedAt).toBe("2026-03-15T10:24:33+09:00");
    expect(first?.updatedAt).toBe("2026-03-15T10:24:33+09:00");
    expect(second?.updatedAt).toBe("2026-03-16T10:24:33+09:00");
  });

  it("keeps memoized updatedAt when git is unavailable", () => {
    vi.mocked(fs.existsSync).mockImplementation((target) => {
      const p = String(target);
      if (p.endsWith("content/.meta/updated-at.json")) {
        return true;
      }
      if (p.endsWith("content/.meta/published-at.json")) {
        return false;
      }
      return p.includes("content/blog");
    });
    vi.mocked(fs.readFileSync).mockImplementation((target) => {
      const p = String(target);
      if (p.endsWith("content/.meta/updated-at.json")) {
        return JSON.stringify({ "content/blog/memo.md": "2026-03-16T10:24:33+09:00" });
      }
      return "# Memo Post";
    });
    vi.mocked(execFileSync).mockImplementation(() => {
      throw new Error("no git");
    });
    vi.mocked(fs.statSync).mockReturnValue({
      birthtime: new Date("2026-03-01T00:00:00.000Z"),
      mtime: new Date("2026-03-20T00:00:00.000Z"),
    } as fs.Stats);

    const post = getPostBySlug("blog", "memo");

    expect(post?.updatedAt).toBe("2026-03-16T10:24:33+09:00");
  });

  it("sorts by publishedAt using absolute time, not string order", () => {
    vi.mocked(fs.existsSync).mockImplementation((path) =>
      String(path).includes("content/blog"),
    );
    vi.mocked(fs.readdirSync).mockReturnValue(["a.md", "b.md"] as unknown as string[]);
    vi.mocked(fs.readFileSync).mockImplementation((path) => {
      const p = String(path);
      if (p.endsWith("a.md")) {
        return "# post-a";
      }
      return "# post-b";
    });
    vi.mocked(execFileSync).mockImplementation((_, args) => {
      const target = String(args?.[args.length - 1] ?? "");
      if (target.endsWith("a.md")) {
        // 2026-03-15T15:10:00Z
        return "2026-03-16T00:10:00+09:00";
      }
      // 2026-03-15T23:50:00Z (newer than post-a despite earlier calendar date text)
      return "2026-03-15T23:50:00+00:00";
    });

    const posts = getPostsBySection("blog");

    expect(posts).toHaveLength(2);
    expect(posts[0].slug).toBe("b");
    expect(posts[1].slug).toBe("a");
  });

  it("falls back to file timestamps when git history is unavailable", () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue("# Title");
    vi.mocked(execFileSync).mockImplementation(() => {
      throw new Error("no git");
    });
    vi.mocked(fs.statSync).mockReturnValue({
      birthtime: new Date("2026-03-01T00:00:00.000Z"),
      mtime: new Date("2026-03-05T00:00:00.000Z"),
    } as fs.Stats);

    const post = getPostBySlug("blog", "sample");

    expect(post).not.toBeNull();
    expect(post?.publishedAt).toBe("2026-03-01T00:00:00.000Z");
    expect(post?.updatedAt).toBe("2026-03-05T00:00:00.000Z");
  });
});
