import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Post } from "@/lib/content";
import { renderEmbed } from "@/components/embeds/embed-registry";
import { getPostsBySection } from "@/lib/content";

vi.mock("@/lib/content", () => ({
  getPostsBySection: vi.fn(),
}));

function post(overrides: Partial<Post>): Post {
  return {
    slug: "1",
    title: "title",
    content: "body",
    excerpt: "excerpt",
    section: "blog",
    publishedAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    sourcePath: "content/blog/1.md",
    ...overrides,
  };
}

describe("renderEmbed", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders latest posts sorted across sections", () => {
    vi.mocked(getPostsBySection).mockImplementation((section) => {
      if (section === "blog") {
        return [
          post({ slug: "a", title: "blog-a", section: "blog", publishedAt: "2026-01-01T00:00:00.000Z" }),
        ];
      }
      return [
        post({ slug: "b", title: "tech-b", section: "blog-tech", publishedAt: "2026-02-01T00:00:00.000Z" }),
      ];
    });

    render(<>{renderEmbed({ type: "latestPosts", attrs: { source: "all", count: "5" } })}</>);

    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveTextContent("tech-b");
    expect(links[0]).toHaveAttribute("href", "/blog-tech/b");
    expect(links[1]).toHaveTextContent("blog-a");
    expect(links[1]).toHaveAttribute("href", "/blog/a");
  });

  it("falls back to unknown embed error", () => {
    render(<>{renderEmbed({ type: "unknown", attrs: {} })}</>);
    expect(screen.getByText("Unknown embed type: unknown")).toBeInTheDocument();
  });
});
