import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

export const CONTENT_ROOT = path.join(process.cwd(), "content");
const BLOG_DIR = path.join(CONTENT_ROOT, "blog");
const BLOG_TECH_DIR = path.join(CONTENT_ROOT, "blog-tech");
const HOME_PATH = path.join(CONTENT_ROOT, "home.md");
const UPDATED_AT_PATH = path.join(CONTENT_ROOT, ".meta", "updated-at.json");
const PUBLISHED_AT_PATH = path.join(CONTENT_ROOT, ".meta", "published-at.json");

export function readJsonSafe(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) {
      return fallback;
    }
    const raw = fs.readFileSync(filePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function listMarkdownFiles(dirPath) {
  if (!fs.existsSync(dirPath)) {
    return [];
  }
  return fs
    .readdirSync(dirPath)
    .filter((name) => name.endsWith(".md"))
    .sort()
    .map((name) => path.join(dirPath, name));
}

function listAssetFiles(dirPath) {
  if (!fs.existsSync(dirPath)) {
    return [];
  }

  const out = [];
  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) {
      continue;
    }
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      out.push(...listAssetFiles(fullPath));
      continue;
    }
    if (entry.isFile()) {
      out.push(fullPath);
    }
  }
  return out.sort();
}

export function parseImageMeta(title = "") {
  const meta = {};
  if (!title) {
    return meta;
  }

  const tokens = title
    .split(";")
    .map((token) => token.trim())
    .filter(Boolean);

  for (const token of tokens) {
    const [rawKey, ...rest] = token.split("=");
    const key = rawKey?.trim().toLowerCase();
    const value = rest.join("=").trim();

    if (key === "caption") {
      meta.caption = value;
      continue;
    }
    if (key === "rotate") {
      meta.rotate = value;
      continue;
    }
    if (key === "width") {
      meta.width = value;
      continue;
    }
    if (key === "height") {
      meta.height = value;
      continue;
    }
    if (key === "maxwidth" || key === "max-width") {
      meta.maxWidth = value;
      continue;
    }
    if (key === "voice" || key === "voices") {
      meta.voices = value;
      continue;
    }
    if (key === "loading") {
      meta.loading = value;
      continue;
    }
    if (key === "fetchpriority" || key === "fetch-priority") {
      meta.fetchPriority = value;
      continue;
    }
    if (key === "decoding") {
      meta.decoding = value;
      continue;
    }
    if (!meta.caption && !key) {
      meta.caption = token;
    }
  }

  return meta;
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function toAssetPlaceholder(url) {
  const normalized = url.trim().replace(/^\.\//, "").replace(/^\/+/, "");
  if (normalized.startsWith("assets/")) {
    const name = normalized.replace(/^assets\//, "");
    return `__HUTARO_MEDIA__/${name}`;
  }
  return url;
}

function buildStyleFromMeta(meta) {
  const chunks = [];
  if (meta.rotate) {
    chunks.push(`transform: rotate(${meta.rotate}deg)`);
  }
  if (meta.width) {
    chunks.push(`width: ${/^\d+$/.test(meta.width) ? `${meta.width}px` : meta.width}`);
    chunks.push("margin-left: auto");
    chunks.push("margin-right: auto");
  }
  if (meta.height) {
    chunks.push(`height: ${/^\d+$/.test(meta.height) ? `${meta.height}px` : meta.height}`);
  }
  if (meta.maxWidth) {
    chunks.push(`max-width: ${/^\d+$/.test(meta.maxWidth) ? `${meta.maxWidth}px` : meta.maxWidth}`);
  }
  return chunks.join("; ");
}

function buildImageAttrsFromMeta(meta) {
  const attrs = [];
  const loading = String(meta.loading || "").toLowerCase();
  const fetchPriority = String(meta.fetchPriority || "").toLowerCase();
  const decoding = String(meta.decoding || "").toLowerCase();

  if (loading === "eager" || loading === "lazy") {
    attrs.push(`loading="${loading}"`);
  }
  if (fetchPriority === "high" || fetchPriority === "low" || fetchPriority === "auto") {
    attrs.push(`fetchpriority="${fetchPriority}"`);
  }
  if (decoding === "async" || decoding === "sync" || decoding === "auto") {
    attrs.push(`decoding="${decoding}"`);
  }

  return attrs.join(" ");
}

function replaceImagesAndLinks(text) {
  const placeholders = [];
  let out = text;

  const take = (html) => {
    const key = `__HUTARO_HTML_${placeholders.length}__`;
    placeholders.push({ key, html });
    return key;
  };

  out = out.replace(/\[(hutaro_[^\]]+)\]/g, (full) => take(full));

  out = out.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g, (_, alt, rawUrl, title) => {
    const mapped = toAssetPlaceholder(rawUrl.trim());
    if (/\.(mp4|webm)$/i.test(mapped)) {
      return take(`<video controls preload="metadata" src="${escapeHtml(mapped)}"></video>`);
    }

    const meta = parseImageMeta(title || "");
    const style = buildStyleFromMeta(meta);
    const attrStyle = style ? ` style="${escapeHtml(style)}"` : "";
    const extraAttrs = buildImageAttrsFromMeta(meta);
    const attrExtras = extraAttrs ? ` ${extraAttrs}` : "";
    const img = `<img src="${escapeHtml(mapped)}" alt="${escapeHtml(alt)}"${attrExtras}${attrStyle} />`;

    if (meta.caption || meta.voices) {
      const attrs = [];
      if (meta.voices) {
        attrs.push(`data-voices="${escapeHtml(meta.voices)}"`);
      }
      const dataAttrs = attrs.length > 0 ? ` ${attrs.join(" ")}` : "";
      return take(
        `<figure class="hutaro-image"${dataAttrs}>${img}${
          meta.caption ? `<figcaption>${escapeHtml(meta.caption)}</figcaption>` : ""
        }</figure>`,
      );
    }

    return take(img);
  });

  out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, href) => {
    const safeHref = href.trim();
    if (!safeHref) {
      return take(escapeHtml(label));
    }
    return take(`<a href="${escapeHtml(safeHref)}">${escapeHtml(label)}</a>`);
  });

  out = escapeHtml(out);
  // Restore from the last placeholder first so nested placeholders
  // (e.g. [![img](...)](...)) are fully expanded.
  for (let i = placeholders.length - 1; i >= 0; i -= 1) {
    const item = placeholders[i];
    out = out.replaceAll(item.key, item.html);
  }
  return out;
}

function convertEmbedTags(text) {
  const openClose = /<md-embed\s+([^>]+)>(.*?)<\/md-embed>/gis;
  const selfClose = /<md-embed\s+([^>]+)\/>/gis;

  const convert = (attrsRaw, body = "") => {
    const attrs = {};
    for (const [, k, v] of attrsRaw.matchAll(/([a-zA-Z_:][a-zA-Z0-9_:\-]*)\s*=\s*"([^"]*)"/g)) {
      attrs[k.toLowerCase()] = v;
    }
    const type = (attrs.type || "").trim();
    if (!type) {
      return "";
    }

    const parts = [];
    for (const key of ["count", "source", "text", "size", "position", "speed", "color", "digits", "class", "gap", "persist"]) {
      if (attrs[key] && attrs[key].trim()) {
        parts.push(`${key}="${attrs[key].replaceAll('"', "'")}"`);
      }
    }
    if (Object.prototype.hasOwnProperty.call(attrs, "title")) {
      parts.push(`title="${String(attrs.title).replaceAll('"', "'")}"`);
    }

    if (attrs.counterkey && attrs.counterkey.trim()) {
      parts.push(`counterKey="${attrs.counterkey.replaceAll('"', "'")}"`);
    }

    if (!attrs.text && body.trim()) {
      parts.push(`text="${body.trim().replaceAll('"', "'")}"`);
    }

    if (type === "latestPosts") {
      return `[hutaro_latest_posts${parts.length ? ` ${parts.join(" ")}` : ""}]`;
    }
    if (type === "ticker") {
      return `[hutaro_ticker${parts.length ? ` ${parts.join(" ")}` : ""}]`;
    }
    if (type === "counter") {
      return `[hutaro_counter${parts.length ? ` ${parts.join(" ")}` : ""}]`;
    }
    if (type === "comments") {
      return `[hutaro_comments${parts.length ? ` ${parts.join(" ")}` : ""}]`;
    }
    if (type === "jokeButtons") {
      return `[hutaro_joke_buttons${parts.length ? ` ${parts.join(" ")}` : ""}]`;
    }
    if (type === "text" || type === "styledText") {
      return `[hutaro_text${parts.length ? ` ${parts.join(" ")}` : ""}]`;
    }
    return "";
  };

  return text
    .replace(openClose, (_, attrsRaw, body) => convert(attrsRaw, body))
    .replace(selfClose, (_, attrsRaw) => convert(attrsRaw));
}

function flushParagraph(lines, htmlChunks) {
  if (lines.length === 0) {
    return;
  }
  const joined = lines.join(" ").trim();
  if (!joined) {
    lines.length = 0;
    return;
  }
  const rendered = replaceImagesAndLinks(joined);
  if (/^(<figure\b.*<\/figure>|<img\b[^>]*\/?>|<video\b.*<\/video>|\[hutaro_[^\]]+\])$/is.test(rendered.trim())) {
    htmlChunks.push(rendered);
    lines.length = 0;
    return;
  }
  htmlChunks.push(`<p>${rendered}</p>`);
  lines.length = 0;
}

export function markdownToWpHtml(source, { demoteH1 = false } = {}) {
  const pre = convertEmbedTags(source.replace(/\r\n/g, "\n"));
  const lines = pre.split("\n");
  const html = [];
  const paragraphLines = [];
  let inCode = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (/^```/.test(trimmed)) {
      if (!inCode) {
        flushParagraph(paragraphLines, html);
        inCode = true;
        html.push("<pre><code>");
      } else {
        inCode = false;
        html.push("</code></pre>");
      }
      continue;
    }

    if (inCode) {
      html.push(`${escapeHtml(line)}\n`);
      continue;
    }

    if (trimmed === "") {
      flushParagraph(paragraphLines, html);
      continue;
    }

    if (/^<[^>]+>/.test(trimmed)) {
      flushParagraph(paragraphLines, html);
      html.push(line);
      continue;
    }

    if (/^---+$/.test(trimmed)) {
      flushParagraph(paragraphLines, html);
      html.push("<hr />");
      continue;
    }

    const heading = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      flushParagraph(paragraphLines, html);
      const levelRaw = heading[1].length;
      const level = demoteH1 && levelRaw === 1 ? 2 : levelRaw;
      html.push(`<h${level}>${replaceImagesAndLinks(escapeHtml(heading[2]))}</h${level}>`);
      continue;
    }

    if (/^[-*]\s+/.test(trimmed)) {
      flushParagraph(paragraphLines, html);
      const items = [trimmed.replace(/^[-*]\s+/, "")];
      html.push(`<ul><li>${replaceImagesAndLinks(items[0])}</li></ul>`);
      continue;
    }

    if (/^\[hutaro_[^\]]+\]$/.test(trimmed)) {
      flushParagraph(paragraphLines, html);
      html.push(trimmed);
      continue;
    }

    paragraphLines.push(line);
  }

  flushParagraph(paragraphLines, html);

  return html.join("\n");
}

function resolveDate(relativePath, publishedMemo, updatedMemo) {
  const nowIso = new Date().toISOString();
  const publishedFromMemo = typeof publishedMemo[relativePath] === "string" ? publishedMemo[relativePath] : "";
  const updatedFromMemo = typeof updatedMemo[relativePath] === "string" ? updatedMemo[relativePath] : "";
  const publishedAt = publishedFromMemo || updatedFromMemo || nowIso;
  const updatedAt = updatedFromMemo || publishedAt;
  return { publishedAt, updatedAt };
}

function stripFirstH1(markdown) {
  return markdown.replace(/^#\s+.+\n?/m, "");
}

export function collectMigrationContent() {
  const publishedMemo = readJsonSafe(PUBLISHED_AT_PATH, {});
  const updatedMemo = readJsonSafe(UPDATED_AT_PATH, {});

  const posts = [];
  for (const [section, dir] of [
    ["blog", BLOG_DIR],
    ["blog-tech", BLOG_TECH_DIR],
  ]) {
    for (const filePath of listMarkdownFiles(dir)) {
      const raw = fs.readFileSync(filePath, "utf8");
      const parsed = matter(raw);
      const slug = path.basename(filePath, ".md");
      const rel = path.relative(process.cwd(), filePath);
      const title = typeof parsed.data.title === "string" && parsed.data.title.trim() ? parsed.data.title.trim() : slug;
      const excerpt =
        typeof parsed.data.summary === "string" && parsed.data.summary.trim() ? parsed.data.summary.trim() : "";
      const cardImage =
        typeof parsed.data.card === "string" && parsed.data.card.trim()
          ? parsed.data.card.trim()
          : typeof parsed.data.ogImage === "string" && parsed.data.ogImage.trim()
            ? parsed.data.ogImage.trim()
            : "";
      const bodyMd = stripFirstH1(parsed.content);
      const bodyHtml = markdownToWpHtml(bodyMd, { demoteH1: true });
      const { publishedAt, updatedAt } = resolveDate(rel, publishedMemo, updatedMemo);

      posts.push({
        type: "post",
        section,
        slug,
        title,
        excerpt,
        cardImage,
        contentHtml: bodyHtml,
        publishedAt,
        updatedAt,
        sourcePath: rel,
      });
    }
  }

  const homeRaw = fs.existsSync(HOME_PATH) ? fs.readFileSync(HOME_PATH, "utf8") : "";
  const homeHtml = markdownToWpHtml(homeRaw, { demoteH1: false });

  const assetsDir = path.join(CONTENT_ROOT, "assets");
  const media = fs.existsSync(assetsDir)
    ? listAssetFiles(assetsDir).map((fullPath) => ({
        key: path.relative(assetsDir, fullPath).split(path.sep).join("/"),
        localPath: fullPath,
      }))
    : [];

  return {
    generatedAt: new Date().toISOString(),
    home: {
      type: "page",
      slug: "home",
      title: "home",
      contentHtml: homeHtml,
    },
    posts,
    media,
  };
}
