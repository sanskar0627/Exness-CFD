#!/usr/bin/env bun

/**
 * Watch script for development mode
 * Runs a TypeScript file with Bun's watch mode and watches shared packages
 */

// Empty export to make this file a module (enables top-level await)
export {};

import { join, dirname } from "path";
import { fileURLToPath } from "url";

const args = process.argv.slice(2);

if (args.length === 0) {
  console.error("Usage: bun watch-quiet.ts <file-to-watch>");
  process.exit(1);
}

const fileToWatch = args[0];

// Get the monorepo root by going up from the script location
// Script is at: monorepo/scripts/watch-quiet.ts
// So go up one level to get monorepo root
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const monorepoRoot = join(__dirname, "..");

// Run bun with watch mode, including packages directory
const proc = Bun.spawn(
  [
    "bun",
    "--watch",
    fileToWatch,
    // Watch shared packages for changes (absolute paths)
    "--watch-path",
    join(monorepoRoot, "packages", "shared"),
    "--watch-path",
    join(monorepoRoot, "packages", "database"),
  ],
  {
    stdout: "inherit",
    stderr: "pipe", // Pipe stderr to filter warnings
    stdin: "inherit",
    cwd: process.cwd(),
  }
);

// Filter stderr to suppress "not in the project directory" warnings
if (proc.stderr) {
  const decoder = new TextDecoder();
  (async () => {
    for await (const chunk of proc.stderr) {
      const text = decoder.decode(chunk);
      // Only show stderr that's NOT the "not in the project directory" warning
      if (!text.includes("is not in the project directory and will not be watched")) {
        process.stderr.write(chunk);
      }
    }
  })();
}

// Handle process exit
process.on("SIGINT", () => {
  proc.kill();
  process.exit(0);
});

process.on("SIGTERM", () => {
  proc.kill();
  process.exit(0);
});

// Wait for the process to exit
await proc.exited;
process.exit(proc.exitCode ?? 0);
