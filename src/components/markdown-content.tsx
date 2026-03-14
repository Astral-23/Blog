import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeRaw from "rehype-raw";

type MarkdownContentProps = {
  source: string;
};

function mapImageUrl(url?: string): string {
  if (!url) {
    return "";
  }

  if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("/")) {
    return url;
  }

  const normalized = url.replace(/^\.\//, "");
  if (normalized.startsWith("assets/")) {
    return `/media/${normalized.replace(/^assets\//, "")}`;
  }

  return url;
}

export function MarkdownContent({ source }: MarkdownContentProps) {
  return (
    <article className="markdown-body">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeRaw, rehypeKatex]}
        components={{
          img: ({ src, alt }) => {
            const mapped = mapImageUrl(typeof src === "string" ? src : undefined);
            // eslint-disable-next-line @next/next/no-img-element
            return <img src={mapped} alt={alt ?? ""} loading="lazy" />;
          },
          a: ({ href, children }) => {
            const external = href?.startsWith("http://") || href?.startsWith("https://");
            return (
              <a href={href} target={external ? "_blank" : undefined} rel={external ? "noreferrer" : undefined}>
                {children}
              </a>
            );
          },
        }}
      >
        {source}
      </ReactMarkdown>
    </article>
  );
}
