"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent } from "react";

type SceneOverlayImageProps = {
  src: string;
  alt: string;
  caption: string;
  voices: string[];
  imageStyle?: CSSProperties;
};

type SceneBurst = {
  id: number;
  text: string;
  top: number;
  left: number;
};

const BURST_LIFETIME_MS = 3000;
const SMALL_KANA_RE = /[ぁぃぅぇぉっゃゅょゎゕゖァィゥェォッャュョヮヵヶ]/;

function renderBurstText(text: string) {
  return [...text].map((char, index) =>
    SMALL_KANA_RE.test(char) ? (
      <span key={`${char}-${index}`} className="scene-small-kana">
        {char}
      </span>
    ) : (
      <span key={`${char}-${index}`}>{char}</span>
    ),
  );
}

export function SceneOverlayImage({ src, alt, caption, voices, imageStyle }: SceneOverlayImageProps) {
  const [bursts, setBursts] = useState<SceneBurst[]>([]);
  const nextIdRef = useRef(0);
  const lineIndexRef = useRef(0);

  const normalizedVoices = useMemo(() => voices.filter((line) => line.trim().length > 0), [voices]);

  const spawnBurst = useCallback(() => {
    if (normalizedVoices.length === 0) {
      return;
    }

    const id = nextIdRef.current++;
    const text = normalizedVoices[lineIndexRef.current % normalizedVoices.length];
    lineIndexRef.current += 1;

    const burst: SceneBurst = {
      id,
      text,
      top: 14 + Math.random() * 72,
      left: 10 + Math.random() * 76,
    };

    setBursts((current) => [...current, burst]);
    window.setTimeout(() => {
      setBursts((current) => current.filter((item) => item.id !== id));
    }, BURST_LIFETIME_MS);
  }, [normalizedVoices]);

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        spawnBurst();
      }
    },
    [spawnBurst],
  );

  return (
    <figure className="markdown-figure scene-figure">
      <button
        type="button"
        className="scene-image-button"
        onClick={spawnBurst}
        onKeyDown={onKeyDown}
        aria-label="セリフ演出を再生"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="markdown-image" src={src} alt={alt} loading="lazy" style={imageStyle} />
        <span className="scene-overlay" aria-live="polite">
          {bursts.map((burst) => (
            <span
              key={burst.id}
              className="scene-burst"
              style={
                {
                  top: `${burst.top}%`,
                  left: `${burst.left}%`,
                } as CSSProperties
              }
            >
              {renderBurstText(burst.text)}
            </span>
          ))}
        </span>
      </button>
      <figcaption className="markdown-figcaption">{caption}</figcaption>
    </figure>
  );
}
