import { describe, expect, it } from "vitest";
import { formatDisplayDate } from "@/lib/date";

describe("formatDisplayDate", () => {
  it("formats with Asia/Tokyo timezone regardless of runtime timezone", () => {
    expect(formatDisplayDate("2026-03-16T06:30:15+09:00")).toBe("2026/3/16");
    expect(formatDisplayDate("2026-03-15T23:50:00+00:00")).toBe("2026/3/16");
  });

  it("returns original input for invalid date", () => {
    expect(formatDisplayDate("not-a-date")).toBe("not-a-date");
  });
});
