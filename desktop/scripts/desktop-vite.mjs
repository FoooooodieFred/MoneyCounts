#!/usr/bin/env node
/**
 * Cross-platform VITE_DESKTOP=1 wrapper so Windows cmd and Unix shells share one command.
 */
import { spawn } from "node:child_process";

process.env.VITE_DESKTOP = "1";

const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
const script = process.argv[2] === "dev" ? "dev" : "build";
const child = spawn(npmCmd, ["run", script], {
  stdio: "inherit",
  env: process.env,
  shell: process.platform === "win32",
});

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});
