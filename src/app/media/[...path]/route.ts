import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const ASSET_ROOT = path.join(process.cwd(), "content", "assets");
const ALLOWED_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".avif", ".svg", ".mp4", ".webm"]);
const RESIZABLE_IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp", ".avif"]);
const IMAGE_CONTENT_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".svg": "image/svg+xml",
};

type ImageFormat = "auto" | "avif" | "webp" | "jpeg" | "png";

type RouteProps = {
  params: Promise<{ path: string[] }>;
};

function parsePositiveInt(raw: string | null): number | null {
  if (!raw) {
    return null;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

function parseQuality(raw: string | null): number | null {
  if (!raw) {
    return null;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 100) {
    return null;
  }
  return parsed;
}

function resolveOutputFormat(requested: ImageFormat, acceptHeader: string | null, ext: string): ImageFormat {
  if (requested !== "auto") {
    return requested;
  }

  if (acceptHeader?.includes("image/avif")) {
    return "avif";
  }
  if (acceptHeader?.includes("image/webp")) {
    return "webp";
  }
  if (ext === ".png") {
    return "png";
  }
  return "jpeg";
}

export async function GET(request: Request, { params }: RouteProps) {
  const { path: segments } = await params;
  if (!segments || segments.length === 0) {
    return new Response("Not found", { status: 404 });
  }

  const requested = path.join(...segments);
  const resolved = path.resolve(ASSET_ROOT, requested);
  const relative = path.relative(ASSET_ROOT, resolved);

  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    return new Response("Invalid path", { status: 400 });
  }

  if (!fs.existsSync(resolved)) {
    return new Response("Not found", { status: 404 });
  }

  const ext = path.extname(resolved).toLowerCase();
  const stat = fs.statSync(resolved);
  if (!stat.isFile()) {
    return new Response("Not found", { status: 404 });
  }
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return new Response("Unsupported media type", { status: 415 });
  }

  const url = new URL(request.url);
  const widthParam = url.searchParams.get("w");
  const qualityParam = url.searchParams.get("q");
  const formatParam = (url.searchParams.get("fm") ?? "auto").toLowerCase() as ImageFormat;

  const width = parsePositiveInt(widthParam);
  const quality = parseQuality(qualityParam) ?? 76;
  const shouldTransform = RESIZABLE_IMAGE_EXTENSIONS.has(ext) && (widthParam !== null || qualityParam !== null || formatParam !== "auto");

  if (widthParam !== null && width === null) {
    return new Response("Invalid width", { status: 400 });
  }
  if (qualityParam !== null && parseQuality(qualityParam) === null) {
    return new Response("Invalid quality", { status: 400 });
  }
  if (!["auto", "avif", "webp", "jpeg", "png"].includes(formatParam)) {
    return new Response("Invalid format", { status: 400 });
  }

  const contentTypeMap: Record<string, string> = {
    ...IMAGE_CONTENT_TYPES,
    ".mp4": "video/mp4",
    ".webm": "video/webm",
  };

  if (!shouldTransform) {
    const file = fs.readFileSync(resolved);
    return new Response(file, {
      status: 200,
      headers: {
        "Content-Type": contentTypeMap[ext] ?? "application/octet-stream",
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }

  const input = fs.readFileSync(resolved);
  const metadata = await sharp(input).metadata();
  const maxWidth = metadata.width ?? width ?? 0;
  const targetWidth = width ? Math.min(width, maxWidth) : undefined;
  const outputFormat = resolveOutputFormat(formatParam, request.headers.get("accept"), ext);

  let pipeline = sharp(input, { animated: false, failOn: "none" });
  if (targetWidth && targetWidth > 0) {
    pipeline = pipeline.resize({ width: targetWidth, withoutEnlargement: true });
  }

  if (outputFormat === "avif") {
    pipeline = pipeline.avif({ quality });
  } else if (outputFormat === "webp") {
    pipeline = pipeline.webp({ quality });
  } else if (outputFormat === "png") {
    pipeline = pipeline.png({ compressionLevel: 9, palette: true });
  } else {
    pipeline = pipeline.jpeg({ quality, mozjpeg: true });
  }

  const transformed = await pipeline.toBuffer();
  const transformedExt = outputFormat === "jpeg" ? ".jpg" : `.${outputFormat}`;

  return new Response(new Uint8Array(transformed), {
    status: 200,
    headers: {
      "Content-Type": contentTypeMap[transformedExt] ?? "application/octet-stream",
      "Content-Length": String(transformed.length),
      "Cache-Control": "public, max-age=31536000, immutable",
      Vary: "Accept",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
