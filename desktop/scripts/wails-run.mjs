#!/usr/bin/env node
/**
 * Run the Wails CLI with cwd = desktop/, so commands work from the repo root on macOS and Windows.
 */
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const desktopDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const child = spawn("wails", process.argv.slice(2), {
  cwd: desktopDir,
  stdio: "inherit",
  env: process.env,
  shell: process.platform === "win32",
});

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});
