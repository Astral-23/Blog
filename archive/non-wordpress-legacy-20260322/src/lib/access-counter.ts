import fs from "node:fs";
import path from "node:path";

const DEFAULT_COUNTER_STORE_PATH = path.join(
  process.cwd(),
  "content",
  ".meta",
  "access-counter.json",
);
const COUNTER_KEY_PATTERN = /^[a-z0-9][a-z0-9:_/-]{0,127}$/;

type CounterEntry = {
  total: number;
  updatedAt: string;
};

type CounterStore = {
  version: 1;
  counters: Record<string, CounterEntry>;
};

export type AccessCounterSnapshot = {
  key: string;
  total: number;
  updatedAt: string;
};

type AccessCounterOptions = {
  storePath?: string;
};

function getStorePath(options?: AccessCounterOptions): string {
  return options?.storePath || process.env.ACCESS_COUNTER_STORE_PATH || DEFAULT_COUNTER_STORE_PATH;
}

function createEmptyStore(): CounterStore {
  return { version: 1, counters: {} };
}

function sanitizeStore(raw: unknown): CounterStore {
  if (!raw || typeof raw !== "object") {
    return createEmptyStore();
  }

  const value = raw as { version?: unknown; counters?: unknown };
  if (value.version !== 1 || !value.counters || typeof value.counters !== "object") {
    return createEmptyStore();
  }

  const counters: Record<string, CounterEntry> = {};
  for (const [key, entry] of Object.entries(value.counters)) {
    if (!COUNTER_KEY_PATTERN.test(key)) {
      continue;
    }
    if (!entry || typeof entry !== "object") {
      continue;
    }

    const target = entry as {
      total?: unknown;
      updatedAt?: unknown;
    };

    const total = Number(target.total);
    const updatedAt = typeof target.updatedAt === "string" ? target.updatedAt : new Date().toISOString();

    counters[key] = {
      total: Number.isFinite(total) && total >= 0 ? Math.floor(total) : 0,
      updatedAt,
    };
  }

  return {
    version: 1,
    counters,
  };
}

function readStore(storePath: string): CounterStore {
  try {
    if (!fs.existsSync(storePath)) {
      return createEmptyStore();
    }
    const raw = fs.readFileSync(storePath, "utf8");
    const parsed: unknown = JSON.parse(raw);
    return sanitizeStore(parsed);
  } catch {
    return createEmptyStore();
  }
}

function writeStore(storePath: string, store: CounterStore): void {
  fs.mkdirSync(path.dirname(storePath), { recursive: true });
  fs.writeFileSync(storePath, `${JSON.stringify(store, null, 2)}\n`, "utf8");
}

function buildSnapshot(key: string, entry: CounterEntry): AccessCounterSnapshot {
  return {
    key,
    total: entry.total,
    updatedAt: entry.updatedAt,
  };
}

export function isValidCounterKey(key: string): boolean {
  return COUNTER_KEY_PATTERN.test(key);
}

export function readAccessCounter(
  key: string,
  now = new Date(),
  options?: AccessCounterOptions,
): AccessCounterSnapshot {
  if (!isValidCounterKey(key)) {
    throw new Error("invalid counter key");
  }

  const storePath = getStorePath(options);
  const store = readStore(storePath);
  const entry = store.counters[key] ?? {
    total: 0,
    updatedAt: now.toISOString(),
  };
  return buildSnapshot(key, entry);
}

export function hitAccessCounter(
  key: string,
  now = new Date(),
  options?: AccessCounterOptions,
): AccessCounterSnapshot {
  if (!isValidCounterKey(key)) {
    throw new Error("invalid counter key");
  }

  const storePath = getStorePath(options);
  const store = readStore(storePath);
  const entry = store.counters[key] ?? {
    total: 0,
    updatedAt: now.toISOString(),
  };

  entry.total += 1;
  entry.updatedAt = now.toISOString();

  store.counters[key] = entry;
  writeStore(storePath, store);

  return buildSnapshot(key, entry);
}
