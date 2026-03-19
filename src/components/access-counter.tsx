"use client";

import { useEffect, useMemo, useState } from "react";

type CounterResponse = {
  total: number;
};

type AccessCounterDigitsProps = {
  counterKey: string;
  digits?: number;
};

function padCount(value: number, digits: number): string {
  const safeValue = Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;
  return String(safeValue).padStart(digits, "0");
}

function toFullWidthDigits(value: string): string {
  return value.replace(/[0-9]/g, (digit) => String.fromCharCode(digit.charCodeAt(0) + 0xfee0));
}

export function AccessCounterDigits({ counterKey, digits = 7 }: AccessCounterDigitsProps) {
  const [counter, setCounter] = useState<CounterResponse | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let ignore = false;

    const run = async () => {
      try {
        const response = await fetch("/api/access-counter", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ key: counterKey }),
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error(`counter request failed: ${response.status}`);
        }
        const payload = (await response.json()) as CounterResponse;
        if (!ignore) {
          setCounter(payload);
        }
      } catch {
        if (!ignore) {
          setFailed(true);
        }
      }
    };

    run();

    return () => {
      ignore = true;
    };
  }, [counterKey]);

  const paddedTotal = useMemo(() => padCount(counter?.total ?? 0, digits), [counter?.total, digits]);
  const displayTotal = useMemo(() => toFullWidthDigits(paddedTotal), [paddedTotal]);

  if (failed) {
    return <span className="retro-counter-inline-error">----</span>;
  }

  return (
    <span className="retro-counter-inline" aria-live="polite">
      <span className="retro-counter-inline-digits" aria-label={`total ${paddedTotal}`}>
        {displayTotal}
      </span>
    </span>
  );
}
