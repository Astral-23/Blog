import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";

type MarkdownContentProps = {
  source: string;
};

const sanitizeSchema = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames ?? []), "details", "summary", "video", "source"],
  attributes: {
    ...(defaultSchema.attributes ?? {}),
    code: [...((defaultSchema.attributes?.code as unknown[]) ?? []), ["className", /^language-./], "className"],
    span: [...((defaultSchema.attributes?.span as unknown[]) ?? []), "className"],
    div: [...((defaultSchema.attributes?.div as unknown[]) ?? []), "className"],
    a: [...((defaultSchema.attributes?.a as unknown[]) ?? []), "target", "rel"],
    video: [
      ...((defaultSchema.attributes?.video as unknown[]) ?? []),
      "src",
      "controls",
      "muted",
      "loop",
      "autoplay",
      "playsinline",
      "preload",
      "poster",
      "width",
      "height",
      "className",
    ],
    source: [...((defaultSchema.attributes?.source as unknown[]) ?? []), "src", "type"],
  },
};

function mapAssetUrl(url?: string): string {
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

function isVideoAsset(url: string): boolean {
  return /\.(mp4|webm)$/i.test(url);
}

function mapSafeHref(href?: string): string | undefined {
  if (!href) {
    return undefined;
  }

  const lower = href.trim().toLowerCase();
  if (
    lower.startsWith("javascript:") ||
    lower.startsWith("vbscript:") ||
    lower.startsWith("data:text/html")
  ) {
    return undefined;
  }

  return href;
}

export function MarkdownContent({ source }: MarkdownContentProps) {
  return (
    <article className="markdown-body">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeRaw, [rehypeSanitize, sanitizeSchema], rehypeKatex]}
        components={{
          img: ({ src, alt }) => {
            const mapped = mapAssetUrl(typeof src === "string" ? src : undefined);
            if (isVideoAsset(mapped)) {
              return (
                <video className="markdown-video" src={mapped} controls preload="metadata">
                  お使いのブラウザは動画再生に対応していません。
                </video>
              );
            }
            // eslint-disable-next-line @next/next/no-img-element
            return <img src={mapped} alt={alt ?? ""} loading="lazy" />;
          },
          video: ({ src, children, ...props }) => {
            const mapped = mapAssetUrl(typeof src === "string" ? src : undefined);
            return (
              <video
                className="markdown-video"
                src={mapped || undefined}
                controls={props.controls ?? true}
                preload={props.preload ?? "metadata"}
                muted={props.muted}
                loop={props.loop}
                autoPlay={props.autoPlay}
                playsInline={props.playsInline}
                poster={typeof props.poster === "string" ? mapAssetUrl(props.poster) : undefined}
              >
                {children}
              </video>
            );
          },
          source: ({ src, type }) => {
            const mapped = mapAssetUrl(typeof src === "string" ? src : undefined);
            return <source src={mapped || undefined} type={typeof type === "string" ? type : undefined} />;
          },
          a: ({ href, children }) => {
            const safeHref = mapSafeHref(href);
            if (!safeHref) {
              return <>{children}</>;
            }
            const external = safeHref.startsWith("http://") || safeHref.startsWith("https://");
            return (
              <a
                href={safeHref}
                target={external ? "_blank" : undefined}
                rel={external ? "noreferrer noopener" : undefined}
              >
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
