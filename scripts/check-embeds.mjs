import fs from "node:fs";
import path from "node:path";
import { loadEmbedSpec, getShortcodeSpecMap } from "./embed-spec.mjs";
import { PREVIEW_RENDERERS } from "./embed-preview-renderers.mjs";

function camelToSnake(value) {
  return String(value || "")
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[\s-]+/g, "_")
    .toLowerCase();
}

function fail(message) {
  console.error(`[embeds:check] ${message}`);
  process.exitCode = 1;
}

const spec = loadEmbedSpec();
const phpPath = path.join(process.cwd(), "wordpress", "plugins", "hutaro-bridge", "hutaro-bridge.php");
const phpSource = fs.readFileSync(phpPath, "utf8");

for (const [type, typeSpec] of Object.entries(spec.types || {})) {
  const shortcode = String(typeSpec?.shortcode || "").trim();
  const renderer = String(typeSpec?.renderer || "").trim();
  if (!shortcode) {
    fail(`type "${type}" is missing shortcode`);
  }
  if (!renderer) {
    fail(`type "${type}" is missing renderer`);
    continue;
  }
  if (!PREVIEW_RENDERERS[renderer]) {
    fail(`renderer "${renderer}" for type "${type}" is missing in preview renderer registry`);
  }
  const phpMethod = `render_${camelToSnake(renderer)}_shortcode`;
  if (!phpSource.includes(`function ${phpMethod}`)) {
    fail(`renderer "${renderer}" for type "${type}" is missing PHP method ${phpMethod}`);
  }
}

const shortcodes = getShortcodeSpecMap();
for (const [shortcode, typeSpec] of Object.entries(shortcodes)) {
  if (!String(typeSpec.renderer || "").trim()) {
    fail(`shortcode "${shortcode}" is missing renderer`);
  }
}

if (process.exitCode) {
  process.exit(process.exitCode);
}

console.log(`[embeds:check] ok: ${Object.keys(spec.types || {}).length} embed types`);
