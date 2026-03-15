import { beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import { getSiteSettings } from "@/lib/site-config";

vi.mock("node:fs", () => ({
  default: {
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
  },
}));

describe("getSiteSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns defaults when settings file does not exist", () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);

    const settings = getSiteSettings();

    expect(settings.title).toBe("Nozomi Blog");
    expect(settings.titleSegments).toEqual([{ text: "Nozomi Blog", size: 1 }]);
    expect(settings.navigation).toHaveLength(3);
  });

  it("parses title segments with numeric clamp and legacy size support", () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(
      JSON.stringify({
        title: "Hutaro Blog 4th Edition",
        titleSegments: [
          { text: "Hutaro", size: 0.1 },
          { text: "Blog", size: 3 },
          { text: "4th", size: "small" },
          { text: "Edition", size: "normal" },
          { text: "", size: 1 },
        ],
        navigation: [{ href: "/", label: "home" }],
      }),
    );

    const settings = getSiteSettings();

    expect(settings.titleSegments).toEqual([
      { text: "Hutaro", size: 0.5 },
      { text: "Blog", size: 2 },
      { text: "4th", size: 0.78 },
      { text: "Edition", size: 1 },
    ]);
  });

  it("falls back to defaults on invalid json", () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue("{ invalid");

    const settings = getSiteSettings();

    expect(settings.title).toBe("Nozomi Blog");
    expect(settings.description).toBe("Markdown driven blog");
  });
});
