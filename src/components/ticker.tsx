"use client";
import type { CSSProperties } from "react";

type TickerProps = {
  text: string;
  durationSec: number | null;
  color?: string;
};

function calculateDaysUntil(month: number, day: number): number {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  let target = new Date(today.getFullYear(), month - 1, day);
  if (target < today) {
    target = new Date(today.getFullYear() + 1, month - 1, day);
  }

  const diffMs = target.getTime() - today.getTime();
  return Math.floor(diffMs / (24 * 60 * 60 * 1000));
}

function resolveCountdownText(text: string): string {
  // Example: {{countdown:12-24}}
  return text.replace(/\{\{countdown:(\d{1,2})-(\d{1,2})\}\}/g, (_, m, d) => {
    const month = Number.parseInt(m, 10);
    const day = Number.parseInt(d, 10);
    if (Number.isNaN(month) || Number.isNaN(day) || month < 1 || month > 12 || day < 1 || day > 31) {
      return "0";
    }
    return String(calculateDaysUntil(month, day));
  });
}

export function Ticker({ text, durationSec, color }: TickerProps) {
  const resolvedText = resolveCountdownText(text);
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
