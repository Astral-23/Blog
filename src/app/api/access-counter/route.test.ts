import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GET, POST } from "./route";

let previousStorePath: string | undefined;
let storePath: string;

beforeEach(() => {
  previousStorePath = process.env.ACCESS_COUNTER_STORE_PATH;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "access-counter-route-"));
  storePath = path.join(dir, "store.json");
  process.env.ACCESS_COUNTER_STORE_PATH = storePath;
});

afterEach(() => {
  if (previousStorePath === undefined) {
    delete process.env.ACCESS_COUNTER_STORE_PATH;
  } else {
    process.env.ACCESS_COUNTER_STORE_PATH = previousStorePath;
  }
  fs.rmSync(path.dirname(storePath), { recursive: true, force: true });
});

describe("/api/access-counter route", () => {
  it("returns 400 when key is invalid", async () => {
    const res = await POST(
      new Request("http://localhost/api/access-counter", {
        method: "POST",
        body: JSON.stringify({ key: "INVALID KEY" }),
      }),
    );

    expect(res.status).toBe(400);
  });

  it("increments home counter on POST", async () => {
    const first = await POST(
      new Request("http://localhost/api/access-counter", {
        method: "POST",
        body: JSON.stringify({ key: "home" }),
      }),
    );
    const firstBody = (await first.json()) as { total: number };
    expect(first.status).toBe(200);
    expect(firstBody.total).toBe(1);

    const second = await POST(
      new Request("http://localhost/api/access-counter", {
        method: "POST",
        body: JSON.stringify({ key: "home" }),
      }),
    );
    const secondBody = (await second.json()) as { total: number };
    expect(secondBody.total).toBe(2);
  });

  it("returns current counter via GET", async () => {
    await POST(
      new Request("http://localhost/api/access-counter", {
        method: "POST",
        body: JSON.stringify({ key: "home" }),
      }),
    );

    const res = await GET(new Request("http://localhost/api/access-counter?key=home"));
    const body = (await res.json()) as { total: number };

    expect(res.status).toBe(200);
    expect(body.total).toBe(1);
  });
});
