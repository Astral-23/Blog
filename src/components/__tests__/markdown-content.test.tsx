import React from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MarkdownContent } from "@/components/markdown-content";

const renderEmbedMock = vi.fn(() => <div data-testid="embed-result">ok</div>);

vi.mock("@/components/embeds/embed-registry", () => ({
  renderEmbed: (payload: unknown) => renderEmbedMock(payload),
}));

describe("MarkdownContent", () => {
  beforeEach(() => {
    renderEmbedMock.mockClear();
  });

  it("renders md-embed via embed registry", () => {
    render(
      <MarkdownContent
        source={'<md-embed type="latestPosts" source="all" count="3"></md-embed>'}
      />,
    );

    expect(screen.getByTestId("embed-result")).toBeInTheDocument();
    expect(renderEmbedMock).toHaveBeenCalledWith({
      type: "latestPosts",
      attrs: { source: "all", count: "3" },
    });
  });

  it("renders counter embed by md-embed type", () => {
    render(<MarkdownContent source={'あなたは<md-embed type="counter"></md-embed>人目です'} />);

    expect(screen.getByTestId("embed-result")).toBeInTheDocument();
    expect(renderEmbedMock).toHaveBeenLastCalledWith({
      type: "counter",
      attrs: {},
    });
  });

  it("blocks javascript links", () => {
    render(<MarkdownContent source={'[danger](javascript:alert("x"))'} />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByText("danger")).toBeInTheDocument();
  });

  it("blocks vbscript links", () => {
    render(<MarkdownContent source={"[danger](vbscript:msgbox('x'))"} />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByText("danger")).toBeInTheDocument();
  });

  it("blocks data html links", () => {
    render(<MarkdownContent source={"[danger](data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==)"} />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByText("danger")).toBeInTheDocument();
  });
});
