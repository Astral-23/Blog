import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";

type MarkdownContentProps = {
  source: string;
};

type ImageMeta = {
  caption?: string;
  rotateDeg?: number;
  width?: string;
  height?: string;
  maxWidth?: string;
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

function parseImageMeta(title?: string): ImageMeta {
  if (!title) {
    return {};
  }

  const meta: ImageMeta = {};
  const tokens = title
    .split(";")
    .map((token) => token.trim())
    .filter(Boolean);

  for (const token of tokens) {
    const [rawKey, ...rest] = token.split("=");
    const key = rawKey?.trim().toLowerCase();
    const value = rest.join("=").trim();

    if (key === "rotate") {
      const deg = Number.parseFloat(value);
      if (!Number.isNaN(deg)) {
        meta.rotateDeg = deg;
      }
      continue;
    }

    if (key === "caption") {
      if (value) {
        meta.caption = value;
      }
      continue;
    }

    if (key === "width") {
      if (value) {
        meta.width = /^\d+$/.test(value) ? `${value}px` : value;
      }
      continue;
    }

    if (key === "height") {
      if (value) {
        meta.height = /^\d+$/.test(value) ? `${value}px` : value;
      }
      continue;
    }

    if (key === "maxwidth" || key === "max-width") {
      if (value) {
        meta.maxWidth = /^\d+$/.test(value) ? `${value}px` : value;
      }
      continue;
    }

    if (!meta.caption) {
      meta.caption = token;
    }
  }

  return meta;
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
          img: ({ src, alt, title }) => {
            const mapped = mapAssetUrl(typeof src === "string" ? src : undefined);
            if (isVideoAsset(mapped)) {
              return (
                <video className="markdown-video" src={mapped} controls preload="metadata">
                  お使いのブラウザは動画再生に対応していません。
                </video>
              );
            }

            const meta = parseImageMeta(typeof title === "string" ? title : undefined);

            const image = (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                className="markdown-image"
                src={mapped}
                alt={alt ?? ""}
                loading="lazy"
                style={{
                  transform: meta.rotateDeg !== undefined ? `rotate(${meta.rotateDeg}deg)` : undefined,
                  width: meta.width,
                  height: meta.height,
                  maxWidth: meta.maxWidth,
                }}
              />
            );

            if (meta.caption) {
              return (
                <figure className="markdown-figure">
                  {image}
                  <figcaption className="markdown-figcaption">{meta.caption}</figcaption>
                </figure>
              );
            }

            return image;
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
