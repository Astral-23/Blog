export function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function parseDateValue(value) {
  const time = Date.parse(String(value || ""));
  return Number.isFinite(time) ? time : 0;
}

export function formatWpDate(value) {
  const date = new Date(String(value || ""));
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

export function sortPostsByPublishedDesc(posts) {
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

export function isValidCounterKey(key) {
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

function renderBoxShortcode(attrs) {
  const html = String(attrs.html || "").trim();
  if (html) {
    return `<div class="hutaro-embed-box">${html}</div>`;
  }

  const text = String(attrs.text || "").trim();
  if (!text) {
    return "";
  }

  return `<div class="hutaro-embed-box"><p>${escapeHtml(text).replaceAll("\n", "<br />")}</p></div>`;
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

export function renderPostCards(posts) {
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

export const PREVIEW_RENDERERS = {
  text: (attrs) => renderTextShortcode(attrs),
  box: (attrs) => renderBoxShortcode(attrs),
  ticker: (attrs) => renderTickerShortcode(attrs),
  counter: (attrs) => renderCounterShortcode(attrs),
  latestPosts: (attrs, allPosts) => renderLatestPostsShortcode(attrs, allPosts),
  tweet: (attrs) => renderTweetShortcode(attrs),
  jokeButtons: (attrs) => renderJokeButtonsShortcode(attrs),
  comments: (attrs) => renderCommentsShortcode(attrs),
};
