#!/usr/bin/env node
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { collectMigrationContent } from "./wp-migrate-utils.mjs";
import { decodeShortcodeAttr, getShortcodeSpecMap } from "./embed-spec.mjs";
import {
  PREVIEW_RENDERERS,
  escapeHtml,
  formatWpDate,
  isValidCounterKey,
  renderPostCards,
  sortPostsByPublishedDesc,
} from "./embed-preview-renderers.mjs";

const cwd = process.cwd();
const outputDir = path.join(cwd, "migration", "wordpress", "preview-site");
const siteConfigPath = path.join(cwd, "content", "site.json");
const previewOthelloApiBase = process.env.HUTARO_OTHELLO_API_BASE || "http://127.0.0.1:8765/api/othello";
const args = process.argv.slice(2);
const shouldServe = args.includes("--serve");
const portArg = args.find((arg) => arg.startsWith("--port="));
const port = Number(portArg?.replace("--port=", "")) || 4173;

const counterStore = new Map();
const DEFAULT_NAV_ITEMS = [
  { href: "/", label: "home", key: "home" },
  { href: "/blog/", label: "blog", key: "blog" },
  { href: "/blog-tech/", label: "blog(tech)", key: "blog-tech" },
  { href: "/works/", label: "works", key: "works" },
];
const DEFAULT_SECTION_LEADS = {
  blog: "✩ゆるふわ日常系コメディ✩",
  "blog-tech": "工学部...つまりメイドさんロボが作れるってことか？",
  works: "作ったものやデモ置き場です。",
};

function normalizeNavItem(item) {
  if (!item || typeof item !== "object") {
    return null;
  }

  const hrefRaw = String(item.href || "").trim();
  const label = String(item.label || "").trim();
  if (!hrefRaw || !label) {
    return null;
  }

  const href = hrefRaw === "/" ? "/" : `/${hrefRaw.replace(/^\/+|\/+$/g, "")}/`;
  const key = href === "/" ? "home" : href.replace(/^\/+|\/+$/g, "");
  return { href, label, key };
}

function loadSiteConfig() {
  try {
    const raw = fs.readFileSync(siteConfigPath, "utf8");
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function resolveNavItems(siteConfig) {
  const candidates = Array.isArray(siteConfig.navigation) ? siteConfig.navigation.map(normalizeNavItem).filter(Boolean) : [];
  return candidates.length > 0 ? candidates : DEFAULT_NAV_ITEMS;
}

function resolveSectionLead(siteConfig, slug) {
  const key = slug === "blog-tech" ? "blogTechLead" : `${slug}Lead`;
  const configured = String(siteConfig[key] || "").trim();
  if (configured) {
    return configured;
  }
  return DEFAULT_SECTION_LEADS[slug] || "";
}

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

function parseAttrs(raw = "") {
  const out = {};
  for (const [, key, value] of raw.matchAll(/([a-zA-Z_:][a-zA-Z0-9_:\-]*)="([^"]*)"/g)) {
    out[key.toLowerCase()] = decodeShortcodeAttr(value);
  }
  return out;
}
function renderShortcodes(html, allPosts) {
  let rendered = html;
  for (const [shortcode, shortcodeSpec] of Object.entries(getShortcodeSpecMap())) {
    const rendererName = String(shortcodeSpec?.renderer || "").trim();
    const renderer = PREVIEW_RENDERERS[rendererName];
    if (!renderer) {
      continue;
    }
    const pattern = new RegExp(`\\[${shortcode}([^\\]]*)\\]`, "g");
    rendered = rendered.replace(pattern, (_, rawAttrs) => renderer(parseAttrs(rawAttrs), allPosts));
  }

  return rendered;
}

function renderContent(html, allPosts) {
  return renderShortcodes(String(html || ""), allPosts).replaceAll("__HUTARO_MEDIA__/", "/assets/");
}

function renderNav(active, navItems) {
  const links = navItems
    .map((item) => {
      const activeClass = item.key === active ? " current-menu-item" : "";
      return `<li class="menu-item${activeClass}"><a class="nav-link" href="${item.href}">${item.label}</a></li>`;
    })
    .join("\n");

  return `<ul class="nav-list">${links}</ul>`;
}

function frameTemplate({ title, activeNav, body, navItems, extraHead = "", extraBodyEnd = "" }) {
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
  ${extraHead}
</head>
<body>
<header class="site-header">
  <div class="site-header-inner">
    <a class="site-title" href="/"><span>Hutaro Blog</span><span style="font-size:0.78em;">4th Edition</span></a>
    <nav aria-label="Global">${renderNav(activeNav, navItems)}</nav>
  </div>
</header>
<main class="site-main">
${body}
</main>
<script>window.wpApiSettings={root:"/wp-json/"};</script>
<script src="/plugin/assets/hutaro-bridge.js"></script>
${extraBodyEnd}
<script async src="https://platform.twitter.com/widgets.js" charset="utf-8"></script>
</body>
</html>
`;
}

function buildHomePage(homeHtml, posts, siteConfig) {
  const body = `<section class="page-wrap"><article class="entry-content">${renderContent(homeHtml, posts)}</article></section>`;
  return frameTemplate({ title: "home", activeNav: "home", body, navItems: resolveNavItems(siteConfig) });
}

function buildArchivePage({ slug, title, lead, posts, siteConfig }) {
  const cards = renderPostCards(sortPostsByPublishedDesc(posts));
  const leadHtml = lead ? `<p class="page-lead">${escapeHtml(lead)}</p>` : "";
  const body = `<section class="page-wrap"><h1 class="page-title">${escapeHtml(title)}</h1>${leadHtml}${cards}</section>`;
  return frameTemplate({ title: slug, activeNav: slug, body, navItems: resolveNavItems(siteConfig) });
}

function buildSinglePage(post, posts, siteConfig) {
  const published = formatWpDate(post.publishedAt);
  const updated = formatWpDate(post.updatedAt);
  const body = `<section class="page-wrap"><h1 class="page-title">${escapeHtml(post.title)}</h1><div class="post-meta"><p>Published: ${escapeHtml(published)}</p><p>Updated: ${escapeHtml(updated)}</p></div><article class="entry-content">${renderContent(post.contentHtml, posts)}</article></section>`;
  const isOthelloDemo = post.section === "works" && post.slug === "othello";
  const extraHead = isOthelloDemo ? '<link rel="stylesheet" href="/plugin/assets/othello-demo.css" />' : "";
  const extraBodyEnd = isOthelloDemo
    ? `<script>window.HUTARO_OTHELLO_CONFIG={apiBase:${JSON.stringify(previewOthelloApiBase)}};</script>\n<script src="/plugin/assets/othello-demo.js"></script>`
    : "";
  return frameTemplate({ title: post.title, activeNav: post.section, body, navItems: resolveNavItems(siteConfig), extraHead, extraBodyEnd });
}

function buildAll() {
  const siteConfig = loadSiteConfig();
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

  writeFile(path.join(outputDir, "index.html"), buildHomePage(payload.home?.contentHtml || "", posts, siteConfig));

  const blogPosts = posts.filter((post) => post.section === "blog");
  const techPosts = posts.filter((post) => post.section === "blog-tech");
  const worksPosts = posts.filter((post) => post.section === "works");

  writeFile(
    path.join(outputDir, "blog", "index.html"),
    buildArchivePage({ slug: "blog", title: "blog", lead: resolveSectionLead(siteConfig, "blog"), posts: blogPosts, siteConfig }),
  );
  writeFile(
    path.join(outputDir, "blog-tech", "index.html"),
    buildArchivePage({ slug: "blog-tech", title: "blog-tech", lead: resolveSectionLead(siteConfig, "blog-tech"), posts: techPosts, siteConfig }),
  );
  writeFile(
    path.join(outputDir, "works", "index.html"),
    buildArchivePage({ slug: "works", title: "works", lead: resolveSectionLead(siteConfig, "works"), posts: worksPosts, siteConfig }),
  );

  for (const post of posts) {
    writeFile(path.join(outputDir, post.section, post.slug, "index.html"), buildSinglePage(post, posts, siteConfig));
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
