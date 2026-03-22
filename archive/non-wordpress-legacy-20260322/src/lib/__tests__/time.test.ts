import { describe, expect, it } from "vitest";
import { compareIsoDesc, formatDisplayDate, getYmdInTimeZone, toEpochMs } from "@/lib/time";

describe("time utils", () => {
  it("compareIsoDesc sorts by absolute time", () => {
    const older = "2026-03-16T00:10:00+09:00";
    const newer = "2026-03-15T23:50:00+00:00";

    expect(compareIsoDesc(older, newer)).toBeGreaterThan(0);
    expect(compareIsoDesc(newer, older)).toBeLessThan(0);
  });

  it("formats display date in Asia/Tokyo", () => {
    expect(formatDisplayDate("2026-03-16T06:30:15+09:00")).toBe("2026/3/16");
    expect(formatDisplayDate("2026-03-15T23:50:00+00:00")).toBe("2026/3/16");
  });

  it("returns epoch fallback for invalid date", () => {
    expect(toEpochMs("not-a-date")).toBe(0);
    expect(formatDisplayDate("not-a-date")).toBe("not-a-date");
  });

  it("extracts Y/M/D in specified timezone", () => {
    const ymd = getYmdInTimeZone(new Date("2026-03-15T23:50:00+00:00"), "Asia/Tokyo");
    expect(ymd).toEqual({ year: 2026, month: 3, day: 16 });
  });
});
