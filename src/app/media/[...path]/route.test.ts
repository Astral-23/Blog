import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { GET } from "./route";

const ASSET_ROOT = path.join(process.cwd(), "content", "assets");
const TMP_TXT = path.join(ASSET_ROOT, "__media_route_test__.txt");

afterEach(() => {
  if (fs.existsSync(TMP_TXT)) {
    fs.unlinkSync(TMP_TXT);
  }
});

describe("/media route", () => {
  test("returns 400 for path traversal", async () => {
    const res = await GET(new Request("http://localhost/media"), {
      params: Promise.resolve({ path: ["..", "package.json"] }),
    });
    expect(res.status).toBe(400);
  });

  test("returns 404 for directory path", async () => {
    const res = await GET(new Request("http://localhost/media"), {
      params: Promise.resolve({ path: ["."] }),
    });
    expect(res.status).toBe(404);
  });

  test("returns 415 for unsupported extension", async () => {
    fs.writeFileSync(TMP_TXT, "test");
    const res = await GET(new Request("http://localhost/media"), {
      params: Promise.resolve({ path: [path.basename(TMP_TXT)] }),
    });
    expect(res.status).toBe(415);
  });

  test("serves allowed file with safe headers", async () => {
    const res = await GET(new Request("http://localhost/media"), {
      params: Promise.resolve({ path: ["sample-grid.svg"] }),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/svg+xml");
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });
});
