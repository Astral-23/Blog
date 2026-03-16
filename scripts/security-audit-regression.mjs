#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

function getArg(name) {
  const prefix = `${name}=`;
  const found = process.argv.slice(2).find((a) => a.startsWith(prefix));
  return found ? found.slice(prefix.length) : undefined;
}

function listJsonSorted(dir) {
  if (!fs.existsSync(dir)) {
    throw new Error(`Directory not found: ${dir}`);
  }

  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => path.join(dir, f));

  files.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
  return files;
}

function parseReport(filePath) {
  const report = JSON.parse(fs.readFileSync(filePath, "utf8"));
  if (!report || typeof report !== "object" || !Array.isArray(report.checks)) {
    throw new Error(`Invalid report format: ${filePath}`);
  }
  return report;
}

function failedIds(report) {
  return new Set(
    report.checks
      .filter((c) => c && c.status !== "pass" && typeof c.id === "string")
      .map((c) => c.id),
  );
}

function main() {
  const inputDir = getArg("--input-dir") ?? "./audit-reports";
  const maxNewFailuresRaw = getArg("--max-new-failures") ?? "0";
  const output = getArg("--output");

  const maxNewFailures = Number.parseInt(maxNewFailuresRaw, 10);
  if (Number.isNaN(maxNewFailures) || maxNewFailures < 0) {
    throw new Error(`Invalid --max-new-failures: ${maxNewFailuresRaw}`);
  }

  const files = listJsonSorted(inputDir);
  if (files.length < 2) {
    throw new Error(`Need at least 2 JSON reports in ${inputDir} for regression check`);
  }

  const latestPath = files[0];
  const previousPath = files[1];
  const latest = parseReport(latestPath);
  const previous = parseReport(previousPath);

  const latestFailed = failedIds(latest);
  const previousFailed = failedIds(previous);

  const newFailures = [...latestFailed].filter((id) => !previousFailed.has(id));
  const resolvedFailures = [...previousFailed].filter((id) => !latestFailed.has(id));

  const lines = [];
  lines.push("# Security Audit Regression");
  lines.push("");
  lines.push(`- Latest: ${latestPath}`);
  lines.push(`- Previous: ${previousPath}`);
  lines.push(`- Latest failed: ${latestFailed.size}`);
  lines.push(`- Previous failed: ${previousFailed.size}`);
  lines.push(`- New failures: ${newFailures.length}`);
  lines.push(`- Resolved failures: ${resolvedFailures.length}`);
  lines.push("");

  lines.push("## New Failures");
  lines.push("");
  if (newFailures.length === 0) {
    lines.push("None");
  } else {
    for (const id of newFailures) {
      lines.push(`- ${id}`);
    }
  }
  lines.push("");

  lines.push("## Resolved Failures");
  lines.push("");
  if (resolvedFailures.length === 0) {
    lines.push("None");
  } else {
    for (const id of resolvedFailures) {
      lines.push(`- ${id}`);
    }
  }
  lines.push("");

  const reportText = lines.join("\n");

  if (output) {
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, `${reportText}\n`, "utf8");
    console.log(`[security-audit-regression] wrote: ${output}`);
  } else {
    process.stdout.write(`${reportText}\n`);
  }

  if (newFailures.length > maxNewFailures) {
    console.error(
      `[security-audit-regression] threshold exceeded: new_failures=${newFailures.length} > max_new_failures=${maxNewFailures}`,
    );
    process.exit(1);
  }

  console.log(
    `[security-audit-regression] threshold ok: new_failures=${newFailures.length}, max_new_failures=${maxNewFailures}`,
  );
}

main();
