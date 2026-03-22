import { MarkdownContent } from "@/components/markdown-content";
import { getHomeMarkdown } from "@/lib/content";

export default function HomePage() {
  const homeMarkdown = getHomeMarkdown();

  return (
    <section className="page-wrap">
      <MarkdownContent source={homeMarkdown} />
    </section>
  );
}
