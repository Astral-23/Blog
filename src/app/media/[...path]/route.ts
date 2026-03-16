import fs from "node:fs";
import path from "node:path";

const ASSET_ROOT = path.join(process.cwd(), "content", "assets");
const ALLOWED_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".mp4", ".webm"]);

type RouteProps = {
  params: Promise<{ path: string[] }>;
};

export async function GET(_: Request, { params }: RouteProps) {
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

  const file = fs.readFileSync(resolved);

  const contentTypeMap: Record<string, string> = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
    ".mp4": "video/mp4",
    ".webm": "video/webm",
  };

  return new Response(file, {
    status: 200,
    headers: {
      "Content-Type": contentTypeMap[ext] ?? "application/octet-stream",
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
