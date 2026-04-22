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

async function listPostsByCategory(categoryId) {
  const posts = [];
  let page = 1;

  while (true) {
    const response = await fetch(
      `${baseUrl}/wp-json/wp/v2/posts?categories=${encodeURIComponent(categoryId)}&per_page=100&page=${page}&context=edit&status=any`,
      {
        headers: {
          Authorization: authHeader,
        },
      },
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`WP API posts list failed (${response.status}): ${text}`);
    }

    const items = await response.json();
    if (!Array.isArray(items) || items.length === 0) {
      break;
    }

    posts.push(...items);

    const totalPages = Number(response.headers.get("x-wp-totalpages") ?? "1");
    if (!Number.isFinite(totalPages) || page >= totalPages) {
      break;
    }
    page += 1;
  }

  return posts;
}

async function trashPost(postId) {
  return wpFetchJson(`/wp-json/wp/v2/posts/${postId}`, {
    method: "DELETE",
  });
}

async function trashPage(pageId) {
  return wpFetchJson(`/wp-json/wp/v2/pages/${pageId}`, {
    method: "DELETE",
  });
}

async function listPagesBySlug(slug) {
  return wpFetchJson(
    `/wp-json/wp/v2/pages?slug=${encodeURIComponent(slug)}&per_page=100&context=edit&status=any`,
  );
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
  const mediaKey = String(file.key || "").trim();
  const fallbackFilename = path.basename(file.localPath);
  const filename = mediaKey ? mediaKey.replace(/[\\/]+/g, "__") : fallbackFilename;
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
    comment_status: "open",
    ping_status: "closed",
  };

  if (featuredId) {
    body.featured_media = featuredId;
  }

  const existing = await wpFetchJson(
    `/wp-json/wp/v2/posts?slug=${encodeURIComponent(post.slug)}&per_page=100&context=edit`,
  );
  const hit = Array.isArray(existing)
    ? existing.find((item) => Array.isArray(item.categories) && item.categories.includes(categoryId))
    : null;

  const normalize = (value) => String(value ?? "").trim();
  const toEpochOrNull = (value) => {
    const ms = Date.parse(String(value ?? ""));
    return Number.isNaN(ms) ? null : ms;
  };
  const toGmtEpochOrNull = (value) => {
    const raw = normalize(value);
    if (!raw) return null;
    const ms = Date.parse(`${raw}Z`);
    return Number.isNaN(ms) ? null : ms;
  };
  const isIsoWithTimezone = (value) => /(?:Z|[+-]\d{2}:\d{2})$/.test(normalize(value));
  const sameSecond = (a, b) => a !== null && b !== null && Math.floor(a / 1000) === Math.floor(b / 1000);

  if (hit?.id) {
    const existingTitle = normalize(hit?.title?.raw ?? hit?.title?.rendered);
    const existingContent = normalize(hit?.content?.raw ?? hit?.content?.rendered);
    const existingExcerpt = normalize(hit?.excerpt?.raw ?? hit?.excerpt?.rendered);
    const existingFeatured = Number(hit?.featured_media ?? 0);
    const nextFeatured = Number(body.featured_media ?? 0);
    const existingCommentStatus = normalize(hit?.comment_status);
    const nextCommentStatus = normalize(body.comment_status);
    const existingPingStatus = normalize(hit?.ping_status);
    const nextPingStatus = normalize(body.ping_status);
    const existingDateLocal = toEpochOrNull(hit?.date);
    const existingDateGmt = toGmtEpochOrNull(hit?.date_gmt);
    const nextDateLocal = toEpochOrNull(body.date);
    const nextDateGmt = isIsoWithTimezone(body.date) ? toEpochOrNull(body.date) : toGmtEpochOrNull(body.date);
    const sameDate =
      sameSecond(existingDateLocal, nextDateLocal) ||
      sameSecond(existingDateGmt, nextDateGmt) ||
      normalize(hit?.date) === normalize(body.date);

    const unchanged =
      existingTitle === normalize(body.title) &&
      existingContent === normalize(body.content) &&
      existingExcerpt === normalize(body.excerpt) &&
      existingFeatured === nextFeatured &&
      existingCommentStatus === nextCommentStatus &&
      existingPingStatus === nextPingStatus &&
      sameDate;

    if (unchanged) {
      return { ...hit, __skipped: true };
    }

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
  const worksCategoryId = await ensureCategory("works");

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

  const samplePages = await listPagesBySlug("sample-page");
  if (Array.isArray(samplePages)) {
    for (const page of samplePages) {
      const pageId = Number(page?.id ?? 0);
      const status = String(page?.status ?? "");
      if (!Number.isFinite(pageId) || pageId <= 0 || status === "trash" || pageId === Number(homePage.id)) {
        continue;
      }
      await trashPage(pageId);
      console.log(`[wp-import-rest] trashed default sample page id=${pageId}`);
    }
  }

  for (const post of payload.posts ?? []) {
    const categoryId = post.section === "blog-tech"
      ? techCategoryId
      : post.section === "works"
        ? worksCategoryId
        : blogCategoryId;
    const saved = await upsertPost(post, categoryId, mediaMap);
    if (saved?.__skipped) {
      console.log(`[wp-import-rest] skipped unchanged post ${post.section}/${post.slug} id=${saved.id}`);
      continue;
    }
    console.log(`[wp-import-rest] upserted post ${post.section}/${post.slug} id=${saved.id}`);
  }

  const managedByCategory = new Map([
    [blogCategoryId, new Set((payload.posts ?? []).filter((post) => post.section === "blog").map((post) => post.slug))],
    [
      techCategoryId,
      new Set((payload.posts ?? []).filter((post) => post.section === "blog-tech").map((post) => post.slug)),
    ],
    [
      worksCategoryId,
      new Set((payload.posts ?? []).filter((post) => post.section === "works").map((post) => post.slug)),
    ],
  ]);

  for (const [categoryId, payloadSlugs] of managedByCategory.entries()) {
    const existingPosts = await listPostsByCategory(categoryId);
    for (const existing of existingPosts) {
      const slug = String(existing?.slug ?? "");
      const status = String(existing?.status ?? "");
      if (!slug || status === "trash") {
        continue;
      }
      if (payloadSlugs.has(slug)) {
        continue;
      }
      await trashPost(existing.id);
      console.log(`[wp-import-rest] trashed missing post category=${categoryId} slug=${slug} id=${existing.id}`);
    }
  }

  console.log("[wp-import-rest] done");
}

main().catch((error) => {
  console.error(`[wp-import-rest] failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
