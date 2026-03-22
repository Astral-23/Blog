const RESPONSIVE_WIDTHS = [360, 540, 720, 960, 1280, 1600] as const;
const RESPONSIVE_IMAGE_EXTENSION_RE = /\.(avif|webp|png|jpe?g)$/i;

function addMediaQuery(src: string, values: Record<string, string | number>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    params.set(key, String(value));
  }
  return `${src}?${params.toString()}`;
}

function parsePixelWidth(value?: string): number | null {
  if (!value) {
    return null;
  }
  const match = value.trim().match(/^(\d+)(px)?$/i);
  if (!match) {
    return null;
  }
  const parsed = Number.parseInt(match[1], 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function isOptimizableMediaImage(src: string): boolean {
  return src.startsWith("/media/") && RESPONSIVE_IMAGE_EXTENSION_RE.test(src);
}

export function buildResponsiveImageAttrs(src: string, preferredWidth?: string, maxWidth?: string) {
  const widths = [...RESPONSIVE_WIDTHS];
  const fixedWidth = parsePixelWidth(preferredWidth) ?? parsePixelWidth(maxWidth);
  const sizes = fixedWidth
    ? `(max-width: ${fixedWidth}px) 100vw, ${fixedWidth}px`
    : "(max-width: 768px) 100vw, 768px";
  const targetWidth = fixedWidth ?? 768;
  const srcSet = widths.map((width) => `${addMediaQuery(src, { w: width, q: 76, fm: "auto" })} ${width}w`).join(", ");

  return {
    src: addMediaQuery(src, { w: targetWidth, q: 76, fm: "auto" }),
    srcSet,
    sizes,
  };
}
