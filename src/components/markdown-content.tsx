import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";
import type { ReactNode } from "react";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import { renderEmbed } from "@/components/embeds/embed-registry";
import { SceneOverlayImage } from "@/components/scene-overlay-image";

type MarkdownContentProps = {
  source: string;
};

type ImageMeta = {
  caption?: string;
  rotateDeg?: number;
  width?: string;
  height?: string;
  maxWidth?: string;
  voices?: string[];
};

const sanitizeSchema = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames ?? []), "details", "summary", "video", "source", "md-embed"],
  attributes: {
    ...(defaultSchema.attributes ?? {}),
    code: [...((defaultSchema.attributes?.code as unknown[]) ?? []), ["className", /^language-./], "className"],
    span: [...((defaultSchema.attributes?.span as unknown[]) ?? []), "className"],
    div: [
      ...((defaultSchema.attributes?.div as unknown[]) ?? []),
      "className",
      "data-color",
      "data-embed",
    ],
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
    "md-embed": [
      "type",
      "count",
      "source",
      "text",
      "speed",
      "color",
      "layout",
      "counterkey",
      "digits",
    ],
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

    if (key === "voice" || key === "voices") {
      const lines = value
        .split("|")
        .map((line) => line.trim())
        .filter(Boolean);
      if (lines.length > 0) {
        meta.voices = lines;
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
  const components = {
    "md-embed": ({ ...props }) => {
      const rawProps = props as Record<string, unknown>;
      const type = typeof rawProps.type === "string" ? rawProps.type.trim() : "";
      if (!type) {
        return <p className="embed-error">Embed type is required.</p>;
      }

      const attrs: Record<string, string> = {};
      for (const [key, value] of Object.entries(rawProps)) {
        if (
          key === "type" ||
          key === "counterkey" ||
          key === "node" ||
          key === "children" ||
          key === "key"
        ) {
          continue;
        }
        if (typeof value === "string" && value.trim().length > 0) {
          attrs[key] = value.trim();
        }
      }
      if (typeof rawProps.counterkey === "string" && rawProps.counterkey.trim().length > 0) {
        attrs.counterKey = rawProps.counterkey.trim();
      }

      return renderEmbed({ type, attrs });
    },
    img: ({ src, alt, title }: { src?: string; alt?: string; title?: string }) => {
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
        if (meta.voices && meta.voices.length > 0) {
          return (
            <SceneOverlayImage
              src={mapped}
              alt={alt ?? ""}
              caption={meta.caption}
              voices={meta.voices}
              imageStyle={{
                transform: meta.rotateDeg !== undefined ? `rotate(${meta.rotateDeg}deg)` : undefined,
                width: meta.width,
                height: meta.height,
                maxWidth: meta.maxWidth,
              }}
            />
          );
        }

        return (
          <figure className="markdown-figure">
            {image}
            <figcaption className="markdown-figcaption">{meta.caption}</figcaption>
          </figure>
        );
      }

      return image;
    },
    video: ({
      src,
      children,
      ...props
    }: {
      src?: string;
      children?: ReactNode;
      controls?: boolean;
      preload?: string;
      muted?: boolean;
      loop?: boolean;
      autoPlay?: boolean;
      playsInline?: boolean;
      poster?: string;
    }) => {
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
    source: ({ src, type }: { src?: string; type?: string }) => {
      const mapped = mapAssetUrl(typeof src === "string" ? src : undefined);
      return <source src={mapped || undefined} type={typeof type === "string" ? type : undefined} />;
    },
    a: ({ href, children }: { href?: string; children?: ReactNode }) => {
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
  } as unknown as Components;

  return (
    <article className="markdown-body">
      <ReactMarkdown
        skipHtml={false}
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeRaw, [rehypeSanitize, sanitizeSchema], rehypeKatex]}
        components={components}
      >
        {source}
      </ReactMarkdown>
    </article>
  );
}
