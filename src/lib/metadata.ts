const DEFAULT_SITE_URL = "http://localhost:3000";
const DEFAULT_OG_IMAGE_PATH = "/media/fuko_top.jpg";

function trimTrailingSlash(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

export function getSiteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!raw) {
    return DEFAULT_SITE_URL;
  }

  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return DEFAULT_SITE_URL;
    }
    return trimTrailingSlash(url.toString());
  } catch {
    return DEFAULT_SITE_URL;
  }
}

export function toAbsoluteUrl(pathOrUrl: string): string {
  if (/^https?:\/\//i.test(pathOrUrl)) {
    return pathOrUrl;
  }
  const normalizedPath = pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`;
  return `${getSiteUrl()}${normalizedPath}`;
}

export function resolveCardImage(cardImage: string | null | undefined): string {
  if (!cardImage || cardImage.trim().length === 0) {
    return toAbsoluteUrl(DEFAULT_OG_IMAGE_PATH);
  }
  return toAbsoluteUrl(cardImage.trim());
}
