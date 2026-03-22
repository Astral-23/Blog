#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

function getArg(name, fallback = "") {
  const hit = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  if (!hit) {
    return fallback;
  }
  return hit.slice(name.length + 3);
}

const payloadPath = getArg("payload", path.join(process.cwd(), "migration", "wordpress", "payload.json"));
const baseUrl = (process.env.WP_BASE_URL || getArg("base-url", "")).trim().replace(/\/$/, "");
const username = (process.env.WP_USERNAME || getArg("username", "")).trim();
const appPassword = (process.env.WP_APP_PASSWORD || getArg("app-password", "")).trim();

if (!baseUrl || !username || !appPassword) {
  console.error("[wp-import-rest] missing credentials. set WP_BASE_URL, WP_USERNAME, WP_APP_PASSWORD");
  process.exit(1);
}
if (!fs.existsSync(payloadPath)) {
  console.error(`[wp-import-rest] payload not found: ${payloadPath}`);
  process.exit(1);
}

const payload = JSON.parse(fs.readFileSync(payloadPath, "utf8"));
const authHeader = `Basic ${Buffer.from(`${username}:${appPassword}`).toString("base64")}`;

function guessMime(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".png") return "image/png";
  if (ext === ".gif") return "image/gif";
  if (ext === ".webp") return "image/webp";
  if (ext === ".avif") return "image/avif";
  if (ext === ".svg") return "image/svg+xml";
  if (ext === ".mp4") return "video/mp4";
  if (ext === ".webm") return "video/webm";
  return "application/octet-stream";
}

async function wpFetchJson(pathname, init = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    ...init,
    headers: {
      Authorization: authHeader,
      ...(init.headers ?? {}),
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`WP API ${pathname} failed (${response.status}): ${text}`);
  }

  return response.json();
}

async function ensureCategory(slug) {
  const existing = await wpFetchJson(`/wp-json/wp/v2/categories?slug=${encodeURIComponent(slug)}`);
  if (Array.isArray(existing) && existing[0]?.id) {
    return existing[0].id;
  }

  const created = await wpFetchJson(`/wp-json/wp/v2/categories`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: slug,
      slug,
    }),
  });

  return created.id;
}

async function ensureMedia(file) {
  const filename = path.basename(file.localPath);
  const existing = await wpFetchJson(`/wp-json/wp/v2/media?search=${encodeURIComponent(filename)}&per_page=100`);
  const exact = Array.isArray(existing)
    ? existing.find((item) => item?.source_url && String(item.source_url).endsWith(`/${filename}`))
    : null;
  if (exact?.id && exact?.source_url) {
    return { id: exact.id, sourceUrl: exact.source_url };
  }

  const binary = fs.readFileSync(file.localPath);
  const response = await fetch(`${baseUrl}/wp-json/wp/v2/media`, {
    method: "POST",
    headers: {
      Authorization: authHeader,
      "Content-Type": guessMime(file.localPath),
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
    body: binary,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`media upload failed: ${filename} (${response.status}) ${text}`);
  }

  const media = await response.json();
  return {
    id: media.id,
    sourceUrl: media.source_url,
  };
}

async function upsertPage(home, contentHtml) {
  const existing = await wpFetchJson(`/wp-json/wp/v2/pages?slug=${encodeURIComponent(home.slug)}`);
  const payload = {
    title: home.title,
    slug: home.slug,
    status: "publish",
    content: contentHtml,
  };

  if (Array.isArray(existing) && existing[0]?.id) {
    return wpFetchJson(`/wp-json/wp/v2/pages/${existing[0].id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  }

  return wpFetchJson(`/wp-json/wp/v2/pages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

async function upsertPost(post, categoryId, mediaMap) {
  const replaceMedia = (value) => {
    let out = value;
    for (const [key, info] of mediaMap.entries()) {
      out = out.replaceAll(`__HUTARO_MEDIA__/${key}`, info.sourceUrl);
    }
    return out;
  };

  const content = replaceMedia(post.contentHtml);
  const featuredId = (() => {
    if (!post.cardImage) return undefined;
    const normalized = post.cardImage.replace(/^\.\//, "");
    const key = normalized.startsWith("assets/") ? normalized.replace(/^assets\//, "") : normalized;
    return mediaMap.get(key)?.id;
  })();

  const body = {
    title: post.title,
    slug: post.slug,
    status: "publish",
    content,
    excerpt: post.excerpt,
    categories: [categoryId],
    date: post.publishedAt,
    modified: post.updatedAt,
  };

  if (featuredId) {
    body.featured_media = featuredId;
  }

  const existing = await wpFetchJson(`/wp-json/wp/v2/posts?slug=${encodeURIComponent(post.slug)}&per_page=100`);
  const hit = Array.isArray(existing)
    ? existing.find((item) => Array.isArray(item.categories) && item.categories.includes(categoryId))
    : null;

  if (hit?.id) {
    return wpFetchJson(`/wp-json/wp/v2/posts/${hit.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  return wpFetchJson(`/wp-json/wp/v2/posts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function main() {
  console.log(`[wp-import-rest] payload=${payloadPath}`);

  const mediaMap = new Map();
  for (const media of payload.media ?? []) {
    const uploaded = await ensureMedia(media);
    mediaMap.set(media.key, uploaded);
    console.log(`[wp-import-rest] media ${media.key} -> ${uploaded.sourceUrl}`);
  }

  const blogCategoryId = await ensureCategory("blog");
  const techCategoryId = await ensureCategory("blog-tech");

  const homeContent = (() => {
    let out = payload.home.contentHtml;
    for (const [key, info] of mediaMap.entries()) {
      out = out.replaceAll(`__HUTARO_MEDIA__/${key}`, info.sourceUrl);
    }
    return out;
  })();

  const homePage = await upsertPage(payload.home, homeContent);
  console.log(`[wp-import-rest] upserted home page id=${homePage.id}`);
  await wpFetchJson(`/wp-json/wp/v2/settings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      show_on_front: "page",
      page_on_front: homePage.id,
    }),
  });
  console.log(`[wp-import-rest] set static front page id=${homePage.id}`);

  for (const post of payload.posts ?? []) {
    const categoryId = post.section === "blog-tech" ? techCategoryId : blogCategoryId;
    const saved = await upsertPost(post, categoryId, mediaMap);
    console.log(`[wp-import-rest] upserted post ${post.section}/${post.slug} id=${saved.id}`);
  }

  console.log("[wp-import-rest] done");
}

main().catch((error) => {
  console.error(`[wp-import-rest] failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
