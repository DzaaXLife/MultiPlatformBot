/**
 * handler/plugins.js — Plugin Loader
 * ─────────────────────────────────────────────────────────────────
 *
 * CARA KERJA:
 * 1. Scan semua file di folder /plugins/** secara rekursif
 * 2. Untuk file .js → import() (ESM)
 * 3. Untuk file .cjs → require() (CommonJS)
 * 4. Plugin valid = fungsi dengan array .command
 * 5. Jika ada error "Cannot find package 'xxx'" → auto npm install
 *
 * FORMAT PLUGIN YANG VALID:
 * ─────────────────────────────────────────────────────────────────
 *   // ESM (.js)
 *   const handler = async (m, { sock, usedPrefix, isOwner, ... }) => {
 *     await m.reply("Halo!")
 *   }
 *   handler.command = ['halo', 'hi']
 *   export default handler
 *
 *   // CJS (.cjs)
 *   const handler = async (m, { sock, usedPrefix, isOwner, ... }) => {
 *     await m.reply("Halo!")
 *   }
 *   handler.command = ['halo', 'hi']
 *   module.exports = handler
 *
 * VARIABEL YANG TERSEDIA DI PLUGIN (dari pluginData):
 *   sock         → instance socket baileys
 *   usedPrefix   → prefix yang dipakai user (e.g. "." atau "!")
 *   text         → teks argumen (setelah command)
 *   args         → array argumen
 *   isOwner      → boolean apakah pengirim adalah owner
 *   isAdmin      → boolean apakah pengirim adalah admin grup
 *   isBotAdmin   → boolean apakah bot adalah admin
 *   command      → nama command yang dipanggil
 *   mime         → mimetype media (jika ada)
 *   qmsg         → quoted message
 *   reply        → shortcut m.reply(text)
 *   example      → fungsi untuk menampilkan contoh penggunaan
 *   getUser      → ambil data user dari DB
 *   getGroup     → ambil data group dari DB
 *   updateData   → update data ke DB
 *   getSettings  → ambil settings bot
 *   getPluginStats → statistik plugin yang loaded
 */

import fs from "fs";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { createRequire } from "module";
import { exec } from "child_process";

const require = createRequire(import.meta.url);

// ─── INSTALL PACKAGE ──────────────────────────────────────────────────────
function installPackage(pkg) {
  return new Promise((res, rej) => {
    exec(`npm install ${pkg}`, (err, stdout, stderr) => {
      if (err) return rej(stderr || err.message);
      res(stdout);
    });
  });
}

function extractMissingPackage(errMsg) {
  const m = errMsg.match(/Cannot find (?:package|module) '([^']+)'/i);
  return m ? m[1] : null;
}

// ─── LOAD SINGLE PLUGIN ───────────────────────────────────────────────────
async function loadPlugin(filePath) {
  const file = path.basename(filePath);
  const isCjs = filePath.endsWith(".cjs");

  try {
    let mod;

    if (isCjs) {
      /**
       * CJS: gunakan require() dari createRequire
       * Hapus cache dulu agar bisa reload saat hot-reload
       */
      delete require.cache[require.resolve(filePath)];
      mod = require(filePath);
    } else {
      /**
       * ESM: gunakan dynamic import()
       * Tambahkan ?t=timestamp agar tidak ter-cache oleh Node.js
       */
      const url = `${pathToFileURL(filePath).href}?t=${Date.now()}`;
      mod = await import(url);
    }

    const plugin = mod.default || mod;

    if (typeof plugin === "function" && Array.isArray(plugin.command)) {
      return plugin;
    } else {
      console.warn(`[PLUGIN] '${file}' tidak valid → harus function + .command[]`);
      return null;
    }
  } catch (err) {
    const missing = extractMissingPackage(err.message);

    if (missing) {
      console.log(`[AUTO-FIX] Package '${missing}' tidak ada, install otomatis...`);
      try {
        await installPackage(missing);
        console.log(`[AUTO-FIX] '${missing}' berhasil diinstall, retry load '${file}'`);

        // Retry load setelah install
        return loadPlugin(filePath);
      } catch (installErr) {
        console.error(`[AUTO-FIX GAGAL] '${file}':`, installErr);
      }
    } else {
      console.error(`[PLUGIN ERROR] '${file}':`, err.message);
    }
    return null;
  }
}

// ─── LOAD SEMUA PLUGIN DARI DIREKTORI ─────────────────────────────────────
async function loadPlugins(dir) {
  const plugins = [];

  if (!fs.existsSync(dir)) {
    console.warn(`[PLUGIN] Folder '${dir}' tidak ditemukan.`);
    return plugins;
  }

  const entries = fs.readdirSync(dir);
  for (const entry of entries) {
    const full = path.join(dir, entry);
    const stat = fs.statSync(full);

    if (stat.isDirectory()) {
      // Rekursif ke subfolder
      const sub = await loadPlugins(full);
      plugins.push(...sub);
    } else if (full.endsWith(".js") || full.endsWith(".cjs")) {
      const plugin = await loadPlugin(full);
      if (plugin) plugins.push(plugin);
    }
  }

  return plugins;
}

// ─── SIMILARITY CHECK (untuk "did you mean?") ─────────────────────────────
function editDistance(a, b) {
  a = a.toLowerCase(); b = b.toLowerCase();
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[a.length][b.length];
}

function similarity(s1, s2) {
  const longer = s1.length >= s2.length ? s1 : s2;
  const shorter = s1.length >= s2.length ? s2 : s1;
  if (!longer.length) return 1;
  return (longer.length - editDistance(longer, shorter)) / longer.length;
}

// ─── HANDLE MESSAGE ───────────────────────────────────────────────────────
/**
 * handleMessage: Dipanggil dari handle.js jika command TIDAK ada di case.js
 *
 * @param {object} m         - pesan (sudah di-normalize)
 * @param {object} sock      - socket baileys
 * @param {string} command   - nama command yang diminta
 * @param {object} Obj       - handleData dari handle.js
 */
export async function handleMessage(m, sock, command, Obj) {
  if (typeof command !== "string" || !command.length) return;

  const pluginDir = path.join(process.cwd(), "plugins");
  const plugins = await loadPlugins(pluginDir);

  // Inject prefix ke pluginData dengan nama usedPrefix
  const { prefix: usedPrefix, ...rest } = Obj;
  const pluginData = { sock, usedPrefix, ...rest };

  let executed = false;

  for (const plugin of plugins) {
    const cmds = plugin.command.map((c) => c.toLowerCase());
    if (cmds.includes(command.toLowerCase())) {
      try {
        await plugin(m, pluginData);
        executed = true;
      } catch (err) {
        console.error(`[PLUGIN RUN ERROR] ${command}:`, err.message);
        m.reply(`*Terjadi error saat menjalankan command!*\n\`\`\`${err.message}\`\`\``);
      }
      break;
    }
  }

  // ── DID YOU MEAN? ──────────────────────────────────────────────
  if (!executed) {
    const allCmds = plugins.flatMap((p) => p.command);
    let best = null, bestScore = 0;

    for (const cmd of allCmds) {
      const s = similarity(command, cmd);
      if (s > bestScore) { bestScore = s; best = cmd; }
    }

    const p = Obj.prefix || ".";
    if (bestScore > 0.65 && best) {
      m.reply(
        `*Command tidak ditemukan!*\n\nMungkin yang kamu maksud?\n` +
        `→ *${p + best}* (${(bestScore * 100).toFixed(0)}% mirip)`
      );
    }
  }
}

// ─── PLUGIN STATS ─────────────────────────────────────────────────────────
/**
 * getPluginStats: Untuk ditampilkan di command menu
 * Return: { totalCategory, totalFiles, data: [{category, count}] }
 */
export function getPluginStats() {
  const baseDir = path.join(process.cwd(), "plugins");
  if (!fs.existsSync(baseDir)) return { totalCategory: 0, totalFiles: 0, data: [] };

  const folders = fs
    .readdirSync(baseDir)
    .filter((f) => fs.statSync(path.join(baseDir, f)).isDirectory());

  let totalFiles = 0;
  const data = folders.map((folder) => {
    const files = fs
      .readdirSync(path.join(baseDir, folder))
      .filter((f) => /\.(js|cjs|mjs)$/.test(f));
    totalFiles += files.length;
    return { category: folder, count: files.length };
  });

  return {
    totalCategory: folders.length,
    totalFiles,
    data: data.sort((a, b) => a.category.localeCompare(b.category)),
  };
}
