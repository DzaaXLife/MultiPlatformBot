/**
 * lib/function.js — Global Helper Functions
 * ─────────────────────────────────────────────────────────────────
 * Semua fungsi di sini di-assign ke global agar bisa dipakai
 * dari mana saja tanpa perlu import lagi.
 *
 * Fungsi tersedia secara global:
 *   runtime(seconds) → "1h 30m 5s"
 *   formatBytes(n)   → "1.2 MB"
 *   sleep(ms)        → Promise delay
 *   getBuffer(url)   → fetch URL → Buffer
 *   isUrl(str)       → boolean
 */

import axios from "axios";
import fs from "fs";
import { fileURLToPath, pathToFileURL } from "url";
import chalk from "chalk";

const __filename = fileURLToPath(import.meta.url);

// ─── RUNTIME FORMAT ───────────────────────────────────────────────────────
global.runtime = (seconds) => {
  seconds = Math.floor(Number(seconds));
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${s}s`;
};

// ─── FORMAT BYTES ─────────────────────────────────────────────────────────
global.formatBytes = (bytes) => {
  if (bytes === 0) return "0 B";
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return (bytes / Math.pow(1024, i)).toFixed(2) + " " + sizes[i];
};

// ─── SLEEP / DELAY ────────────────────────────────────────────────────────
global.sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ─── FETCH URL → BUFFER ───────────────────────────────────────────────────
global.getBuffer = async (url, options = {}) => {
  const res = await axios.get(url, {
    responseType: "arraybuffer",
    ...options,
  });
  return Buffer.from(res.data);
};

// ─── IS URL ───────────────────────────────────────────────────────────────
global.isUrl = (str) => {
  try {
    new URL(str);
    return true;
  } catch {
    return false;
  }
};

// ─── HOT RELOAD ───────────────────────────────────────────────────────────
fs.watchFile(__filename, () => {
  fs.unwatchFile(__filename);
  console.log(chalk.yellow("[HOT] function.js berubah, reload..."));
  import(`${pathToFileURL(__filename).href}?t=${Date.now()}`);
});
