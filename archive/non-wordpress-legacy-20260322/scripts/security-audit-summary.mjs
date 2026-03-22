#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

function getArg(name) {
  const prefix = `${name}=`;
  const found = process.argv.slice(2).find((a) => a.startsWith(prefix));
  return found ? found.slice(prefix.length) : undefined;
}

function latestJsonInDir(dir) {
  if (!fs.existsSync(dir)) {
    throw new Error(`Directory not found: ${dir}`);
  }

  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => path.join(dir, f));

  if (files.length === 0) {
    throw new Error(`No JSON files found in: ${dir}`);
  }

  files.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
  return files[0];
}

function readJson(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  return JSON.parse(raw);
}

function toMarkdown(report, sourcePath) {
  const summary = report.summary ?? {};
  const checks = Array.isArray(report.checks) ? report.checks : [];
  const failed = checks.filter((c) => c.status !== "pass");

  const lines = [];
  lines.push("# Security Audit Summary");
  lines.push("");
  lines.push(`- Source: ${sourcePath}`);
  lines.push(`- Host: ${report.host ?? "unknown"}`);
  lines.push(`- Timestamp: ${report.timestamp ?? "unknown"}`);
  lines.push(`- Total: ${summary.total ?? checks.length}`);
  lines.push(`- Passed: ${summary.passed ?? checks.filter((c) => c.status === "pass").length}`);
  lines.push(`- Failed: ${summary.failed ?? failed.length}`);
  lines.push("");

  if (failed.length === 0) {
    lines.push("## Failed Checks");
    lines.push("");
    lines.push("None");
    lines.push("");
  } else {
    lines.push("## Failed Checks");
    lines.push("");
    for (const c of failed) {
      lines.push(`- ${c.id ?? "unknown"}: ${c.detail ?? "(no detail)"}`);
    }
    lines.push("");
  }

  lines.push("## All Checks");
  lines.push("");
  for (const c of checks) {
    const icon = c.status === "pass" ? "PASS" : "FAIL";
    lines.push(`- [${icon}] ${c.id ?? "unknown"}: ${c.detail ?? "(no detail)"}`);
  }
  lines.push("");

  return lines.join("\n");
}

function main() {
  const input = getArg("--input");
  const inputDir = getArg("--input-dir") ?? "./audit-reports";
  const output = getArg("--output");
  const maxFailedRaw = getArg("--max-failed") ?? "0";
  const maxFailed = Number.parseInt(maxFailedRaw, 10);

  if (Number.isNaN(maxFailed) || maxFailed < 0) {
    throw new Error(`Invalid --max-failed: ${maxFailedRaw}`);
  }

  const reportPath = input ?? latestJsonInDir(inputDir);
  const report = readJson(reportPath);

  if (!report || typeof report !== "object" || !report.summary || !Array.isArray(report.checks)) {
    throw new Error("Invalid audit report format");
  }

  const markdown = toMarkdown(report, reportPath);

  if (output) {
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, `${markdown}\n`, "utf8");
    console.log(`[security-audit-summary] wrote: ${output}`);
  } else {
    process.stdout.write(`${markdown}\n`);
  }

  const failed = typeof report.summary.failed === "number"
    ? report.summary.failed
    : report.checks.filter((c) => c.status !== "pass").length;

  if (failed > maxFailed) {
    console.error(
      `[security-audit-summary] threshold exceeded: failed=${failed} > max-failed=${maxFailed}`,
    );
    process.exit(1);
  }

  console.log(`[security-audit-summary] threshold ok: failed=${failed}, max-failed=${maxFailed}`);
}

main();
