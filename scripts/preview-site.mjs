#!/usr/bin/env node
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { collectMigrationContent } from "./wp-migrate-utils.mjs";

const cwd = process.cwd();
const outputDir = path.join(cwd, "migration", "wordpress", "preview-site");
const args = process.argv.slice(2);
const shouldServe = args.includes("--serve");
const portArg = args.find((arg) => arg.startsWith("--port="));
const port = Number(portArg?.replace("--port=", "")) || 4173;

const counterStore = new Map();

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function writeFile(filePath, contents) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, contents, "utf8");
}

function copyDir(srcDir, dstDir) {
  if (!fs.existsSync(srcDir)) {
    return;
  }
  ensureDir(dstDir);
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    if (entry.name === ".DS_Store") {
      continue;
    }
    const src = path.join(srcDir, entry.name);
    const dst = path.join(dstDir, entry.name);
    if (entry.isDirectory()) {
      copyDir(src, dst);
      continue;
    }
    fs.copyFileSync(src, dst);
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function parseAttrs(raw = "") {
  const out = {};
  for (const [, key, value] of raw.matchAll(/([a-zA-Z_:][a-zA-Z0-9_:\-]*)="([^"]*)"/g)) {
    out[key.toLowerCase()] = value;
  }
  return out;
}

function parseDateValue(value) {
  const time = Date.parse(String(value || ""));
  return Number.isFinite(time) ? time : 0;
}

function formatWpDate(value) {
  const date = new Date(String(value || ""));
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function sortPostsByPublishedDesc(posts) {
  return posts.slice().sort((a, b) => parseDateValue(b.publishedAt) - parseDateValue(a.publishedAt));
}

function resolveTickerDuration(raw) {
  const normalized = String(raw || "").trim().toLowerCase();
  if (normalized === "slow") return 12.0;
  if (normalized === "normal" || normalized === "") return 6.0;
  if (normalized === "fast") return 3.0;

  const num = Number.parseFloat(normalized);
  if (!Number.isFinite(num)) return 6.0;
  if (num <= 0) return null;

  let halfTrip = 1 / (2 * num);
  if (halfTrip < 0.25) halfTrip = 0.25;
  if (halfTrip > 60) halfTrip = 60;
  return halfTrip;
}

function isValidCounterKey(key) {
  return /^[a-z0-9][a-z0-9:_/-]{0,127}$/.test(String(key || ""));
}

function renderTextShortcode(attrs) {
  const position = ["left", "center", "right"].includes(attrs.position) ? attrs.position : "left";
  const text = String(attrs.text || "").trim();
  if (!text) {
    return "";
  }

  const style = [];
  if (/^\d+(\.\d+)?$/.test(String(attrs.size || ""))) {
    style.push(`font-size:${attrs.size}rem`);
  } else if (/^\d+(\.\d+)?(px|rem|em|%)$/.test(String(attrs.size || ""))) {
    style.push(`font-size:${attrs.size}`);
  }

  if (/^(#[0-9a-fA-F]{3,8}|[a-zA-Z]+|rgb\([^\)]+\)|rgba\([^\)]+\)|hsl\([^\)]+\)|hsla\([^\)]+\))$/.test(String(attrs.color || ""))) {
    style.push(`color:${attrs.color}`);
  }

  const styleAttr = style.length > 0 ? ` style="${escapeHtml(style.join(";"))}"` : "";
  return `<div class="hutaro-embed-text align-${escapeHtml(position)}"${styleAttr}>${escapeHtml(text)}</div>`;
}

function renderTickerShortcode(attrs) {
  const duration = resolveTickerDuration(attrs.speed);
  const colorRaw = String(attrs.color || "rainbow").trim();
  const colorClass = ["rainbow", "white", "accent"].includes(colorRaw.toLowerCase()) ? colorRaw.toLowerCase() : "rainbow";
  const rawSize = String(attrs.size || "").trim();
  let textStyle = "";
  if (/^\d+(\.\d+)?$/.test(rawSize)) {
    textStyle = ` style="font-size:${escapeHtml(rawSize)}rem"`;
  } else if (/^\d+(\.\d+)?(px|rem|em|%)$/.test(rawSize)) {
    textStyle = ` style="font-size:${escapeHtml(rawSize)}"`;
  }
  return `<div class="hutaro-ticker hutaro-ticker-color-${escapeHtml(colorClass)}${duration === null ? " hutaro-ticker-static" : ""}" data-hutaro-ticker="1" data-text="${escapeHtml(String(attrs.text || ""))}" data-duration-sec="${escapeHtml(duration === null ? "0" : String(duration))}" data-color="${escapeHtml(colorRaw)}"><span class="hutaro-ticker-track"><span class="hutaro-ticker-text"${textStyle}></span></span></div>`;
}

function renderCounterShortcode(attrs) {
  let key = String(attrs.counterkey || attrs.key || "home").trim();
  if (!isValidCounterKey(key)) {
    key = "home";
  }

  let digits = Number.parseInt(String(attrs.digits || "7"), 10);
  if (!Number.isFinite(digits) || digits < 1) {
    digits = 7;
  }

  return `<span class="hutaro-embed-counter" data-hutaro-counter="1" data-key="${escapeHtml(key)}" data-digits="${digits}">0000000</span>`;
}

function renderPostCards(posts) {
  if (posts.length === 0) {
    return "<p>まだ記事がありません。</p>";
  }

  const items = posts
    .map((post) => {
      const date = formatWpDate(post.publishedAt);
      const excerpt = post.excerpt ? `<p>${escapeHtml(post.excerpt)}</p>` : "";
      return `<li class="post-card"><a class="post-card-link" href="/${post.section}/${post.slug}/"><p class="post-date">${escapeHtml(date)}</p><h2>${escapeHtml(post.title)}</h2>${excerpt}</a></li>`;
    })
    .join("\n");

  return `<ul class="post-list">${items}</ul>`;
}

function renderLatestPostsShortcode(attrs, allPosts) {
  let count = Number.parseInt(String(attrs.count || "5"), 10);
  if (!Number.isFinite(count) || count < 1) {
    count = 5;
  }
  if (count > 20) {
    count = 20;
  }

  const source = String(attrs.source || "all").trim();
  const scoped = source === "blog" || source === "blog-tech"
    ? allPosts.filter((post) => post.section === source)
    : allPosts.filter((post) => post.section === "blog" || post.section === "blog-tech");

  const posts = sortPostsByPublishedDesc(scoped).slice(0, count);
  if (posts.length === 0) {
    return '<p class="hutaro-embed-note">最新記事はまだありません。</p>';
  }

  return `<div class="hutaro-embed-latest-posts">${renderPostCards(posts)}</div>`;
}

function renderCommentsShortcode(attrs) {
  const title = String(attrs.title || "コメントを書く").trim() || "コメントを書く";
  return `<section class="comments-area comments-area-preview"><h3 class="comment-reply-title">${escapeHtml(title)}</h3><p class="no-comments">ローカルプレビューではコメント機能はダミー表示です。本番WordPressで動作します。</p></section>`;
}

function canonicalTweetUrl(rawUrl) {
  const input = String(rawUrl || "").trim();
  if (!input) {
    return "";
  }

  let parsed;
  try {
    parsed = new URL(input);
  } catch {
    return "";
  }

  const host = parsed.hostname.toLowerCase();
  if (host !== "x.com" && host !== "www.x.com" && host !== "twitter.com" && host !== "www.twitter.com") {
    return "";
  }

  const match = parsed.pathname.match(/^\/([A-Za-z0-9_]{1,15})\/status(?:es)?\/(\d+)(?:\/)?$/);
  if (!match) {
    return "";
  }

  const [, handle, statusId] = match;
  return `https://twitter.com/${handle}/status/${statusId}`;
}

function renderWpEmbedShortcode(rawUrl) {
  const canonical = canonicalTweetUrl(rawUrl);
  if (!canonical) {
    return `<a href="${escapeHtml(String(rawUrl || "").trim())}">${escapeHtml(String(rawUrl || "").trim())}</a>`;
  }
  return `<blockquote class="twitter-tweet"><a href="${escapeHtml(canonical)}">${escapeHtml(canonical)}</a></blockquote>`;
}

function renderTweetShortcode(attrs) {
  return renderWpEmbedShortcode(attrs.url || "");
}

function renderJokeButtonsShortcode(attrs) {
  const persist = String(attrs.persist || "none").trim().toLowerCase();
  const persistMode = persist === "local" ? "local" : "none";
  const labels = ["いいね", "高評価", "チャンネル登録"];
  const buttons = labels
    .map((label) => `<button type="button" class="hutaro-joke-button" data-hutaro-joke-button="${escapeHtml(label)}" aria-pressed="false">${escapeHtml(label)}</button>`)
    .join("");
  return `<section class="hutaro-joke-buttons" data-hutaro-joke-buttons="1" data-persist="${persistMode}" aria-label="ジョークボタン">${buttons}</section>`;
}

function renderShortcodes(html, allPosts) {
  return html
    .replace(/\[hutaro_text([^\]]*)\]/g, (_, rawAttrs) => renderTextShortcode(parseAttrs(rawAttrs)))
    .replace(/\[hutaro_ticker([^\]]*)\]/g, (_, rawAttrs) => renderTickerShortcode(parseAttrs(rawAttrs)))
    .replace(/\[hutaro_counter([^\]]*)\]/g, (_, rawAttrs) => renderCounterShortcode(parseAttrs(rawAttrs)))
    .replace(/\[hutaro_latest_posts([^\]]*)\]/g, (_, rawAttrs) => renderLatestPostsShortcode(parseAttrs(rawAttrs), allPosts))
    .replace(/\[hutaro_tweet([^\]]*)\]/g, (_, rawAttrs) => renderTweetShortcode(parseAttrs(rawAttrs)))
    .replace(/\[hutaro_joke_buttons([^\]]*)\]/g, (_, rawAttrs) => renderJokeButtonsShortcode(parseAttrs(rawAttrs)))
    .replace(/\[hutaro_comments([^\]]*)\]/g, (_, rawAttrs) => renderCommentsShortcode(parseAttrs(rawAttrs)));
}

function renderContent(html, allPosts) {
  return renderShortcodes(String(html || ""), allPosts).replaceAll("__HUTARO_MEDIA__/", "/assets/");
}

function renderNav(active) {
  const items = [
    { href: "/", label: "home", key: "home" },
    { href: "/blog/", label: "blog", key: "blog" },
    { href: "/blog-tech/", label: "blog(tech)", key: "blog-tech" },
  ];

  const links = items
    .map((item) => {
      const activeClass = item.key === active ? " current-menu-item" : "";
      return `<li class="menu-item${activeClass}"><a class="nav-link" href="${item.href}">${item.label}</a></li>`;
    })
    .join("\n");

  return `<ul class="nav-list">${links}</ul>`;
}

function frameTemplate({ title, activeNav, body }) {
  return `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <link rel="icon" type="image/png" href="/theme/assets/leaf.png" />
  <link rel="apple-touch-icon" href="/theme/assets/leaf.png" />
  <link rel="stylesheet" href="/theme/style.css" />
  <link rel="stylesheet" href="/plugin/assets/hutaro-bridge.css" />
</head>
<body>
<header class="site-header">
  <div class="site-header-inner">
    <a class="site-title" href="/"><span>Hutaro Blog</span><span style="font-size:0.78em;">4th Edition</span></a>
    <nav aria-label="Global">${renderNav(activeNav)}</nav>
  </div>
</header>
<main class="site-main">
${body}
</main>
<script>window.wpApiSettings={root:"/wp-json/"};</script>
<script src="/plugin/assets/hutaro-bridge.js"></script>
<script async src="https://platform.twitter.com/widgets.js" charset="utf-8"></script>
</body>
</html>
`;
}

function buildHomePage(homeHtml, posts) {
  const body = `<section class="page-wrap"><article class="entry-content">${renderContent(homeHtml, posts)}</article></section>`;
  return frameTemplate({ title: "home", activeNav: "home", body });
}

function buildArchivePage({ slug, title, lead, posts }) {
  const cards = renderPostCards(sortPostsByPublishedDesc(posts));
  const leadHtml = lead ? `<p class="page-lead">${escapeHtml(lead)}</p>` : "";
  const body = `<section class="page-wrap"><h1 class="page-title">${escapeHtml(title)}</h1>${leadHtml}${cards}</section>`;
  return frameTemplate({ title: slug, activeNav: slug, body });
}

function buildSinglePage(post, posts) {
  const published = formatWpDate(post.publishedAt);
  const updated = formatWpDate(post.updatedAt);
  const body = `<section class="page-wrap"><h1 class="page-title">${escapeHtml(post.title)}</h1><div class="post-meta"><p>Published: ${escapeHtml(published)}</p><p>Updated: ${escapeHtml(updated)}</p></div><article class="entry-content">${renderContent(post.contentHtml, posts)}</article></section>`;
  return frameTemplate({ title: post.title, activeNav: post.section, body });
}

function buildAll() {
  const payload = collectMigrationContent();
  const posts = payload.posts || [];

  fs.rmSync(outputDir, { recursive: true, force: true });
  ensureDir(outputDir);

  copyDir(path.join(cwd, "content", "assets"), path.join(outputDir, "assets"));
  copyDir(path.join(cwd, "wordpress", "themes", "hutaro-classic", "assets"), path.join(outputDir, "theme", "assets"));
  copyDir(path.join(cwd, "wordpress", "plugins", "hutaro-bridge", "assets"), path.join(outputDir, "plugin", "assets"));
  writeFile(
    path.join(outputDir, "theme", "style.css"),
    fs.readFileSync(path.join(cwd, "wordpress", "themes", "hutaro-classic", "style.css"), "utf8"),
  );

  writeFile(path.join(outputDir, "index.html"), buildHomePage(payload.home?.contentHtml || "", posts));

  const blogPosts = posts.filter((post) => post.section === "blog");
  const techPosts = posts.filter((post) => post.section === "blog-tech");

  writeFile(
    path.join(outputDir, "blog", "index.html"),
    buildArchivePage({ slug: "blog", title: "blog", lead: "✩ゆるふわ日常系コメディ✩", posts: blogPosts }),
  );
  writeFile(
    path.join(outputDir, "blog-tech", "index.html"),
    buildArchivePage({ slug: "blog-tech", title: "blog-tech", lead: "工学部...つまりメイドさんロボが作れるってことか？", posts: techPosts }),
  );

  for (const post of posts) {
    writeFile(path.join(outputDir, post.section, post.slug, "index.html"), buildSinglePage(post, posts));
  }

  return { outputDir, postCount: posts.length };
}

function contentType(filePath) {
  if (filePath.endsWith(".html")) return "text/html; charset=utf-8";
  if (filePath.endsWith(".css")) return "text/css; charset=utf-8";
  if (filePath.endsWith(".js")) return "application/javascript; charset=utf-8";
  if (filePath.endsWith(".json")) return "application/json; charset=utf-8";
  if (filePath.endsWith(".svg")) return "image/svg+xml";
  if (filePath.endsWith(".png")) return "image/png";
  if (filePath.endsWith(".jpg") || filePath.endsWith(".jpeg")) return "image/jpeg";
  if (filePath.endsWith(".webp")) return "image/webp";
  if (filePath.endsWith(".gif")) return "image/gif";
  return "application/octet-stream";
}

function sendJson(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(`${JSON.stringify(payload)}\n`);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.setEncoding("utf8");
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 1024 * 1024) {
        reject(new Error("payload too large"));
      }
    });
    req.on("end", () => resolve(raw));
    req.on("error", reject);
  });
}

function handleMockApi(req, res, pathname) {
  if (pathname === "/wp-json/hutaro/v1/health" && req.method === "GET") {
    sendJson(res, 200, { status: "ok", service: "blog", timestamp: new Date().toISOString() });
    return true;
  }

  if (pathname === "/wp-json/hutaro/v1/counter" && req.method === "GET") {
    const url = new URL(req.url || "", `http://${req.headers.host || "localhost"}`);
    const key = String(url.searchParams.get("key") || "home").trim();
    if (!isValidCounterKey(key)) {
      sendJson(res, 400, { error: "invalid key" });
      return true;
    }
    const entry = counterStore.get(key) || { total: 0, updatedAt: new Date().toISOString() };
    sendJson(res, 200, { key, total: entry.total, updatedAt: entry.updatedAt });
    return true;
  }

  if (pathname === "/wp-json/hutaro/v1/counter" && req.method === "POST") {
    readBody(req)
      .then((raw) => {
        let key = "home";
        try {
          const parsed = JSON.parse(raw || "{}");
          key = String(parsed?.key || "home").trim();
        } catch {
          sendJson(res, 400, { error: "invalid json" });
          return;
        }

        if (!isValidCounterKey(key)) {
          sendJson(res, 400, { error: "invalid key" });
          return;
        }

        const prev = counterStore.get(key) || { total: 0, updatedAt: new Date().toISOString() };
        const next = { total: Number(prev.total || 0) + 1, updatedAt: new Date().toISOString() };
        counterStore.set(key, next);
        sendJson(res, 200, { key, total: next.total, updatedAt: next.updatedAt });
      })
      .catch(() => sendJson(res, 500, { error: "counter failed" }));
    return true;
  }

  return false;
}

function serve(dirPath, listenPort) {
  const server = http.createServer((req, res) => {
    const pathname = decodeURIComponent((req.url || "/").split("?")[0]);

    if (handleMockApi(req, res, pathname)) {
      return;
    }

    const normalized = path.normalize(pathname).replace(/^(\.\.[/\\])+/, "");
    let targetPath = path.join(dirPath, normalized);

    if (normalized.endsWith("/")) {
      targetPath = path.join(dirPath, normalized, "index.html");
    } else if (!path.extname(normalized)) {
      targetPath = path.join(dirPath, normalized, "index.html");
    }

    if (!targetPath.startsWith(dirPath) || !fs.existsSync(targetPath) || fs.statSync(targetPath).isDirectory()) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not Found");
      return;
    }

    res.writeHead(200, { "Content-Type": contentType(targetPath), "Cache-Control": "no-store" });
    fs.createReadStream(targetPath).pipe(res);
  });

  server.on("error", (error) => {
    if (error && error.code === "EADDRINUSE") {
      console.error(`[preview] port ${listenPort} is already in use`);
      console.error(`[preview] retry with: npm run preview -- --port=${listenPort + 1}`);
      process.exit(1);
    }
    console.error(`[preview] failed to start server: ${error.message}`);
    process.exit(1);
  });

  server.listen(listenPort, () => {
    console.log(`[preview] serving ${dirPath}`);
    console.log(`[preview] open http://localhost:${listenPort}`);
  });
}

const result = buildAll();
console.log(`[preview] built ${result.postCount} posts -> ${result.outputDir}`);
if (shouldServe) {
  serve(result.outputDir, port);
}
