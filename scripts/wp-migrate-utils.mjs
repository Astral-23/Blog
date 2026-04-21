import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import matter from "gray-matter";

export const CONTENT_ROOT = path.join(process.cwd(), "content");
const BLOG_DIR = path.join(CONTENT_ROOT, "blog");
const BLOG_TECH_DIR = path.join(CONTENT_ROOT, "blog-tech");
const HOME_PATH = path.join(CONTENT_ROOT, "home.md");
const UPDATED_AT_PATH = path.join(CONTENT_ROOT, ".meta", "updated-at.json");
const PUBLISHED_AT_PATH = path.join(CONTENT_ROOT, ".meta", "published-at.json");

function stableRelativePath(filePath) {
  return path.relative(process.cwd(), filePath).split(path.sep).join("/");
}

function sortObjectByKey(record) {
  return Object.fromEntries(Object.entries(record).sort(([a], [b]) => a.localeCompare(b)));
}

function writeJsonFile(filePath, value) {
  const next = `${JSON.stringify(value, null, 2)}\n`;
  const prev = fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : "";
  if (prev === next) {
    return false;
  }
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, next, "utf8");
  return true;
}

function gitDateForFile(filePath, { first } = { first: false }) {
  const rel = stableRelativePath(filePath);
  const cmd = first
    ? `git log --follow --diff-filter=A --format=%aI -- "${rel}"`
    : `git log -1 --format=%aI -- "${rel}"`;

  try {
    const raw = execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    if (!raw) {
      return "";
    }
    if (!first) {
      return raw.split(/\r?\n/).find(Boolean) || "";
    }
    const lines = raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    return lines.at(-1) || "";
  } catch {
    return "";
  }
}

function fileTimestampFallback(filePath) {
  try {
    const stat = fs.statSync(filePath);
    const candidates = [stat.birthtimeMs, stat.mtimeMs];
    for (const ms of candidates) {
      if (Number.isFinite(ms) && ms > 0) {
        return new Date(ms).toISOString();
      }
    }
    return "";
  } catch {
    return "";
  }
}

function syncDateMemoForFiles(filePaths) {
  const publishedMemoRaw = readJsonSafe(PUBLISHED_AT_PATH, {});
  const updatedMemoRaw = readJsonSafe(UPDATED_AT_PATH, {});
  const publishedMemo = typeof publishedMemoRaw === "object" && publishedMemoRaw ? { ...publishedMemoRaw } : {};
  const updatedMemo = typeof updatedMemoRaw === "object" && updatedMemoRaw ? { ...updatedMemoRaw } : {};

  for (const filePath of filePaths) {
    const rel = stableRelativePath(filePath);
    const publishedExisting = typeof publishedMemo[rel] === "string" ? publishedMemo[rel].trim() : "";
    const updatedExisting = typeof updatedMemo[rel] === "string" ? updatedMemo[rel].trim() : "";

    const firstFromGit = gitDateForFile(filePath, { first: true });
    const latestFromGit = gitDateForFile(filePath, { first: false });
    const fallbackNow = fileTimestampFallback(filePath) || new Date().toISOString();

    const publishedAt = publishedExisting || firstFromGit || latestFromGit || fallbackNow;
    const updatedAt = updatedExisting || latestFromGit || publishedAt;

    publishedMemo[rel] = publishedAt;
    updatedMemo[rel] = updatedAt;
  }

  const sortedPublishedMemo = sortObjectByKey(publishedMemo);
  const sortedUpdatedMemo = sortObjectByKey(updatedMemo);
  writeJsonFile(PUBLISHED_AT_PATH, sortedPublishedMemo);
  writeJsonFile(UPDATED_AT_PATH, sortedUpdatedMemo);

  return {
    publishedMemo: sortedPublishedMemo,
    updatedMemo: sortedUpdatedMemo,
  };
}

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

function renderInlineMath(rawMath) {
  const input = String(rawMath || "").trim();
  if (!input) {
    return "";
  }

  let out = escapeHtml(input);
  out = out.replace(/\^\{([^}]+)\}/g, "<sup>$1</sup>");
  out = out.replace(/\^([A-Za-z0-9+\-]+)/g, "<sup>$1</sup>");
  out = out.replace(/_\{([^}]+)\}/g, "<sub>$1</sub>");
  out = out.replace(/_([A-Za-z0-9+\-]+)/g, "<sub>$1</sub>");
  return `<span class="hutaro-inline-math">${out}</span>`;
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

  out = out.replace(/\$([^\n$]+?)\$/g, (_, rawMath) => {
    const rendered = renderInlineMath(rawMath);
    return rendered ? take(rendered) : _;
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
    for (const key of ["count", "source", "text", "size", "position", "speed", "color", "digits", "class", "gap", "persist", "url"]) {
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
    if (type === "tweet") {
      return `[hutaro_tweet${parts.length ? ` ${parts.join(" ")}` : ""}]`;
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
  if (
    /^(<figure\b.*<\/figure>|<img\b[^>]*\/?>|<video\b.*<\/video>|\[hutaro_[^\]]+\]|\[embed\][\s\S]*?\[\/embed\])$/is.test(
      rendered.trim(),
    )
  ) {
    htmlChunks.push(rendered);
    lines.length = 0;
    return;
  }
  htmlChunks.push(`<p>${rendered}</p>`);
  lines.length = 0;
}

function flushBlockquote(lines, htmlChunks) {
  if (lines.length === 0) {
    return;
  }
  const joined = lines.join(" ").trim();
  if (!joined) {
    lines.length = 0;
    return;
  }
  htmlChunks.push(`<blockquote><p>${replaceImagesAndLinks(joined)}</p></blockquote>`);
  lines.length = 0;
}

export function markdownToWpHtml(source, { demoteH1 = false } = {}) {
  const pre = convertEmbedTags(source.replace(/\r\n/g, "\n"));
  const lines = pre.split("\n");
  const html = [];
  const paragraphLines = [];
  const blockquoteLines = [];
  let inCode = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (/^```/.test(trimmed)) {
      if (!inCode) {
        flushParagraph(paragraphLines, html);
        flushBlockquote(blockquoteLines, html);
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
      flushBlockquote(blockquoteLines, html);
      continue;
    }

    if (/^>\s?/.test(trimmed)) {
      flushParagraph(paragraphLines, html);
      blockquoteLines.push(trimmed.replace(/^>\s?/, ""));
      continue;
    }

    if (/^<[^>]+>/.test(trimmed)) {
      flushParagraph(paragraphLines, html);
      flushBlockquote(blockquoteLines, html);
      html.push(line);
      continue;
    }

    if (/^---+$/.test(trimmed)) {
      flushParagraph(paragraphLines, html);
      flushBlockquote(blockquoteLines, html);
      html.push("<hr />");
      continue;
    }

    const heading = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      flushParagraph(paragraphLines, html);
      flushBlockquote(blockquoteLines, html);
      const levelRaw = heading[1].length;
      const level = demoteH1 && levelRaw === 1 ? 2 : levelRaw;
      html.push(`<h${level}>${replaceImagesAndLinks(escapeHtml(heading[2]))}</h${level}>`);
      continue;
    }

    if (/^[-*]\s+/.test(trimmed)) {
      flushParagraph(paragraphLines, html);
      flushBlockquote(blockquoteLines, html);
      const items = [trimmed.replace(/^[-*]\s+/, "")];
      html.push(`<ul><li>${replaceImagesAndLinks(items[0])}</li></ul>`);
      continue;
    }

    if (/^\[hutaro_[^\]]+\]$/.test(trimmed)) {
      flushParagraph(paragraphLines, html);
      flushBlockquote(blockquoteLines, html);
      html.push(trimmed);
      continue;
    }

    paragraphLines.push(line);
  }

  flushParagraph(paragraphLines, html);
  flushBlockquote(blockquoteLines, html);

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
  const targetFiles = [
    ...listMarkdownFiles(BLOG_DIR),
    ...listMarkdownFiles(BLOG_TECH_DIR),
  ];
  const { publishedMemo, updatedMemo } = syncDateMemoForFiles(targetFiles);

  const posts = [];
  for (const [section, dir] of [
    ["blog", BLOG_DIR],
    ["blog-tech", BLOG_TECH_DIR],
  ]) {
    for (const filePath of listMarkdownFiles(dir)) {
      const raw = fs.readFileSync(filePath, "utf8");
      const parsed = matter(raw);
      const slug = path.basename(filePath, ".md");
      const rel = stableRelativePath(filePath);
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
