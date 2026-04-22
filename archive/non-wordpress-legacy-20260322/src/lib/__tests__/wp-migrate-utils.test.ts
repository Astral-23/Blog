import { describe, expect, it } from "vitest";
import { markdownToWpHtml, parseImageMeta } from "../../../scripts/wp-migrate-utils.mjs";

describe("wp-migrate-utils", () => {
  it("parses image metadata attributes", () => {
    const meta = parseImageMeta("caption=図の説明; rotate=90; width=640; maxwidth=80%");
    expect(meta).toEqual({
      caption: "図の説明",
      rotate: "90",
      width: "640",
      maxWidth: "80%",
    });
  });

  it("converts md-embed tags into compatible shortcodes", () => {
    const source = [
      '<md-embed type="latestPosts" source="all" count="5"></md-embed>',
      '<md-embed type="counter" counterKey="home"></md-embed>',
      '<md-embed type="ticker" text="HELLO" speed="0.1" color="rainbow"></md-embed>',
      '<md-embed type="box">問題文</md-embed>',
      '<md-embed type="text" position="center">中央</md-embed>',
    ].join("\n");
    const html = markdownToWpHtml(source);
    expect(html).toContain('[hutaro_latest_posts count="5" source="all"]');
    expect(html).toContain('[hutaro_counter counterKey="home"]');
    expect(html).toContain('[hutaro_ticker text="HELLO" speed="0.1" color="rainbow"]');
    expect(html).toContain('[hutaro_box text="問題文"]');
    expect(html).toContain('[hutaro_text position="center" text="中央"]');
  });

  it("maps local assets to wordpress media placeholders", () => {
    const source = '![alt](assets/example.png "caption=test; width=640")';
    const html = markdownToWpHtml(source);
    expect(html).toContain('<figure class="hutaro-image">');
    expect(html).toContain('__HUTARO_MEDIA__/example.png');
    expect(html).toContain('width: 640px');
  });
});
