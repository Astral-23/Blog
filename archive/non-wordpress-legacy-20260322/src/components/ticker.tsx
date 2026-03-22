"use client";
import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { DISPLAY_TIME_ZONE, getYmdInTimeZone } from "@/lib/time";

type TickerProps = {
  text: string;
  durationSec: number | null;
  color?: string;
  initialNowIso?: string;
};

function calculateDaysUntil(month: number, day: number, now: Date): number {
  const today = getYmdInTimeZone(now, DISPLAY_TIME_ZONE);
  const currentDayUtc = Date.UTC(today.year, today.month - 1, today.day);

  let targetYear = today.year;
  if (month < today.month || (month === today.month && day < today.day)) {
    targetYear += 1;
  }

  const targetDayUtc = Date.UTC(targetYear, month - 1, day);
  const diffMs = targetDayUtc - currentDayUtc;
  return Math.floor(diffMs / (24 * 60 * 60 * 1000));
}

function resolveCountdownText(text: string, now: Date): string {
  // Example: {{countdown:12-24}}
  return text.replace(/\{\{countdown:(\d{1,2})-(\d{1,2})\}\}/g, (_, m, d) => {
    const month = Number.parseInt(m, 10);
    const day = Number.parseInt(d, 10);
    if (Number.isNaN(month) || Number.isNaN(day) || month < 1 || month > 12 || day < 1 || day > 31) {
      return "0";
    }
    return String(calculateDaysUntil(month, day, now));
  });
}

export function Ticker({ text, durationSec, color, initialNowIso }: TickerProps) {
  const initialNow = (() => {
    if (!initialNowIso) {
      return new Date();
    }
    const parsed = new Date(initialNowIso);
    return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  })();
  const [resolvedText, setResolvedText] = useState(() => resolveCountdownText(text, initialNow));

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setResolvedText(resolveCountdownText(text, new Date()));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [text]);

  const isStatic = durationSec === null;
  const resolvedColor = (() => {
    if (!color) {
      return { mode: "rainbow" as const };
    }
    const lower = color.trim().toLowerCase();
    if (lower === "rainbow" || lower === "white" || lower === "accent") {
      return { mode: lower };
    }
    if (/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(lower)) {
      return { mode: "custom" as const, value: lower };
    }
    if (/^([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(lower)) {
      return { mode: "custom" as const, value: `#${lower}` };
    }
    return { mode: "rainbow" as const };
  })();

  return (
    <div
      className={`ticker ticker-text-${resolvedColor.mode}${isStatic ? " ticker-static" : ""}`}
      aria-label={resolvedText}
      style={
        resolvedColor.mode === "custom"
          ? ({ ["--ticker-solid-color" as const]: resolvedColor.value } as CSSProperties)
          : undefined
      }
    >
      <div className="ticker-track" style={isStatic ? undefined : { animationDuration: `${durationSec}s` }}>
        <span>{resolvedText}</span>
      </div>
    </div>
  );
}
