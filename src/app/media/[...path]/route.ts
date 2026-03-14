import fs from "node:fs";
import path from "node:path";

const ASSET_ROOT = path.join(process.cwd(), "content", "assets");

type RouteProps = {
  params: Promise<{ path: string[] }>;
};

export async function GET(_: Request, { params }: RouteProps) {
  const { path: segments } = await params;
  const requested = path.join(...segments);
  const resolved = path.resolve(ASSET_ROOT, requested);

  if (!resolved.startsWith(ASSET_ROOT)) {
    return new Response("Invalid path", { status: 400 });
  }

  if (!fs.existsSync(resolved)) {
    return new Response("Not found", { status: 404 });
  }

  const file = fs.readFileSync(resolved);
  const ext = path.extname(resolved).toLowerCase();

  const contentTypeMap: Record<string, string> = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
  };

  return new Response(file, {
    status: 200,
    headers: {
      "Content-Type": contentTypeMap[ext] ?? "application/octet-stream",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
