#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { collectMigrationContent } from "./wp-migrate-utils.mjs";

const outputDirArg = process.argv.find((arg) => arg.startsWith("--out="));
const outputDir = outputDirArg ? outputDirArg.replace("--out=", "") : path.join(process.cwd(), "migration", "wordpress");

fs.mkdirSync(outputDir, { recursive: true });

const payload = collectMigrationContent();
const outputPath = path.join(outputDir, "payload.json");
fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

console.log(`[wp-export-content] wrote ${outputPath}`);
console.log(`[wp-export-content] posts=${payload.posts.length}, media=${payload.media.length}`);
