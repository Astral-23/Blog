import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { hitAccessCounter, isValidCounterKey, readAccessCounter } from "@/lib/access-counter";

function makeStorePath(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "access-counter-"));
  return path.join(dir, "store.json");
}

function cleanupStorePath(storePath: string): void {
  const dir = path.dirname(storePath);
  fs.rmSync(dir, { recursive: true, force: true });
}

const createdStorePaths: string[] = [];

afterEach(() => {
  for (const storePath of createdStorePaths.splice(0)) {
    cleanupStorePath(storePath);
  }
});

describe("access counter library", () => {
  it("validates keys", () => {
    expect(isValidCounterKey("home")).toBe(true);
    expect(isValidCounterKey("blog/entry-1")).toBe(true);
    expect(isValidCounterKey("UPPERCASE")).toBe(false);
    expect(isValidCounterKey("../escape")).toBe(false);
  });

  it("increments total", () => {
    const storePath = makeStorePath();
    createdStorePaths.push(storePath);

    const now = new Date("2026-03-19T10:00:00+09:00");
    const first = hitAccessCounter("home", now, { storePath });
    const second = hitAccessCounter("home", now, { storePath });

    expect(first.total).toBe(1);
    expect(second.total).toBe(2);
  });

  it("stores and reads total without incrementing", () => {
    const storePath = makeStorePath();
    createdStorePaths.push(storePath);

    hitAccessCounter("home", new Date("2026-03-19T08:00:00+09:00"), { storePath });
    const current = readAccessCounter("home", new Date("2026-03-19T12:00:00+09:00"), { storePath });

    expect(current.total).toBe(1);
  });
});
