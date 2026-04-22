import fs from "node:fs";
import path from "node:path";

const specPath = path.join(process.cwd(), "wordpress", "plugins", "hutaro-bridge", "embed-spec.json");
let cachedSpec = null;

function escapeShortcodeAttr(value) {
  return String(value)
    .replaceAll("\\", "\\\\")
    .replace(/\r\n/g, "\n")
    .replaceAll("\r", "\n")
    .replaceAll("\n", "\\n")
    .replaceAll('"', "'");
}

export function decodeShortcodeAttr(value) {
  return String(value || "")
    .replace(/\\\\/g, "\u0000")
    .replace(/\\n/g, "\n")
    .replace(/\u0000/g, "\\");
}

export function loadEmbedSpec() {
  if (cachedSpec) {
    return cachedSpec;
  }

  const raw = fs.readFileSync(specPath, "utf8");
  const parsed = JSON.parse(raw);
  cachedSpec = parsed && typeof parsed === "object" ? parsed : { types: {} };
  if (!cachedSpec.types || typeof cachedSpec.types !== "object") {
    cachedSpec.types = {};
  }
  return cachedSpec;
}

export function getEmbedTypeSpec(type) {
  const spec = loadEmbedSpec();
  if (!type || !Object.prototype.hasOwnProperty.call(spec.types, type)) {
    return null;
  }
  return spec.types[type];
}

export function getShortcodeSpecMap() {
  const out = {};
  for (const [type, typeSpec] of Object.entries(loadEmbedSpec().types || {})) {
    const shortcode = String(typeSpec?.shortcode || "").trim();
    if (!shortcode || Object.prototype.hasOwnProperty.call(out, shortcode)) {
      continue;
    }
    out[shortcode] = { ...typeSpec, type };
  }
  return out;
}

export function mdEmbedToShortcode(attrs, body = "") {
  const type = String(attrs.type || "").trim();
  const typeSpec = getEmbedTypeSpec(type);
  if (!typeSpec || !typeSpec.shortcode) {
    return "";
  }

  const parts = [];
  for (const key of typeSpec.attrs || []) {
    if (!Object.prototype.hasOwnProperty.call(attrs, key)) {
      continue;
    }
    const value = String(attrs[key] || "").trim();
    if (!value) {
      continue;
    }
    const shortcodeKey = key === "counterkey" ? "counterKey" : key;
    parts.push(`${shortcodeKey}="${escapeShortcodeAttr(value)}"`);
  }

  if (typeSpec.bodyAttr && !String(attrs[typeSpec.bodyAttr] || "").trim() && String(body || "").trim()) {
    parts.push(`${typeSpec.bodyAttr}="${escapeShortcodeAttr(String(body).trim())}"`);
  }

  return `[${typeSpec.shortcode}${parts.length ? ` ${parts.join(" ")}` : ""}]`;
}
