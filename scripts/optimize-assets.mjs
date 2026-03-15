import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const args = process.argv.slice(2);

function getArg(name, fallback) {
  const index = args.indexOf(`--${name}`);
  if (index === -1 || index + 1 >= args.length) {
    return fallback;
  }
  return args[index + 1];
}

function hasFlag(name) {
  return args.includes(`--${name}`);
}

const ASSET_DIR = path.join(process.cwd(), "content", "assets");
const targetFile = getArg("file", "");
const quality = Number.parseInt(getArg("quality", "82"), 10);
const maxWidth = Number.parseInt(getArg("max-width", "1920"), 10);
const forceWidth = Number.parseInt(getArg("width", "0"), 10);
const dryRun = hasFlag("dry-run");

const SUPPORTED_EXT = new Set([".jpg", ".jpeg", ".png", ".webp", ".avif"]);

function listFiles(dir) {
  if (!fs.existsSync(dir)) {
    return [];
  }
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listFiles(p));
      continue;
    }
    if (SUPPORTED_EXT.has(path.extname(entry.name).toLowerCase())) {
      files.push(p);
    }
  }
  return files;
}

function optimizePipeline(image, ext) {
  if (ext === ".jpg" || ext === ".jpeg") {
    return image.jpeg({ quality, mozjpeg: true });
  }
  if (ext === ".png") {
    return image.png({ compressionLevel: 9, palette: true });
  }
  if (ext === ".webp") {
    return image.webp({ quality });
  }
  if (ext === ".avif") {
    return image.avif({ quality });
  }
  return image;
}

async function optimizeFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const original = fs.readFileSync(filePath);
  const image = sharp(original, { animated: false });
  const meta = await image.metadata();

  if (!meta.width) {
    console.log(`skip(no width): ${path.relative(process.cwd(), filePath)}`);
    return;
  }

  let resized = false;
  let targetWidth = meta.width;
  if (forceWidth > 0) {
    targetWidth = forceWidth;
  } else if (meta.width > maxWidth) {
    targetWidth = maxWidth;
  }

  let pipeline = sharp(original, { animated: false });
  if (targetWidth !== meta.width) {
    resized = true;
    pipeline = pipeline.resize({ width: targetWidth, withoutEnlargement: true });
  }

  pipeline = optimizePipeline(pipeline, ext);
  const optimized = await pipeline.toBuffer();

  const beforeKB = (original.length / 1024).toFixed(1);
  const afterKB = (optimized.length / 1024).toFixed(1);
  const fileLabel = path.relative(process.cwd(), filePath);

  if (dryRun) {
    console.log(`[dry-run] ${fileLabel} ${beforeKB}KB -> ${afterKB}KB${resized ? " resized" : ""}`);
    return;
  }

  if (optimized.length <= original.length || resized) {
    fs.writeFileSync(filePath, optimized);
    console.log(`updated: ${fileLabel} ${beforeKB}KB -> ${afterKB}KB${resized ? " resized" : ""}`);
    return;
  }

  console.log(`kept: ${fileLabel} ${beforeKB}KB -> ${afterKB}KB`);
}

async function main() {
  const files = targetFile
    ? [path.isAbsolute(targetFile) ? targetFile : path.join(process.cwd(), targetFile)]
    : listFiles(ASSET_DIR);

  if (files.length === 0) {
    console.log("no files");
    return;
  }

  for (const file of files) {
    await optimizeFile(file);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
