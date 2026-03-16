/**
 * shared/router.js — Shared Command Router
 * ─────────────────────────────────────────────────────────────────
 * Semua platform (WA, Telegram, Discord) melewatkan pesan mereka
 * ke sini setelah di-normalize ke format `m` yang seragam.
 *
 * Router ini menentukan:
 * 1. Apakah pesan ada command-nya?
 * 2. Siapa pengirimnya (isOwner, dll)?
 * 3. Route ke: shared case → shared plugin → platform-specific plugin
 *
 * KENAPA SHARED?
 * Satu plugin bisa jalan di WA, Telegram, DAN Discord sekaligus.
 * Platform-specific logic hanya ada di m.reply, m.replyImage, dll.
 */

import path from "path";
import fs from "fs";
import { fileURLToPath, pathToFileURL } from "url";
import { createRequire } from "module";
import { getUser, getGroup, updateData, getSettings } from "../lib/database.js";
import chalk from "chalk";

const require = createRequire(import.meta.url);

// ─── PREFIX DETECTION ─────────────────────────────────────────────────────
const ANY_PREFIX_RE = /^[°•π÷×¶∆£¢€¥®™+✓_=|~!?@#%^&©.!/]/i;

function parseCommand(body) {
  const prefix = global.prefix || ".";

  if (global.multiprefix) {
    if (!body.startsWith(prefix)) return null;
    const rest    = body.slice(prefix.length).trim();
    const command = rest.split(/\s+/)[0].toLowerCase();
    const args    = rest.slice(command.length).trim().split(/\s+/).filter(Boolean);
    return { prefix, command, args, text: args.join(" ") };
  }

  // noprefix: coba ambil prefix dari karakter pertama
  const match = body.match(ANY_PREFIX_RE);
  const p     = match ? match[0] : "";
  const rest  = body.slice(p.length).trim();
  const command = rest.split(/\s+/)[0].toLowerCase();
  const args  = rest.slice(command.length).trim().split(/\s+/).filter(Boolean);
  return { prefix: p, command, args, text: args.join(" ") };
}

// ─── MAIN ROUTE ───────────────────────────────────────────────────────────
/**
 * @param {object} m        - normalized message object
 * @param {string} platform - "whatsapp" | "telegram" | "discord"
 */
export async function routeMessage(m, platform = "whatsapp") {
  const body = m.body || "";
  if (!body.trim()) return;

  const parsed = parseCommand(body);
  if (!parsed || !parsed.command) return;

  const { prefix, command, args, text } = parsed;

  // ── isOwner check ────────────────────────────────────────────
  /**
   * Owner dicek berdasarkan platform:
   * - WA       : global.owner (nomor HP)
   * - Telegram : global.teleOwner (user ID)
   * - Discord  : global.discordOwner (user ID)
   */
  let ownerList = [];
  if (platform === "whatsapp")  ownerList = global.owner        || [];
  if (platform === "telegram")  ownerList = global.teleOwner    || [];
  if (platform === "discord")   ownerList = global.discordOwner || [];

  const isOwner = ownerList.includes(String(m.sender).replace(/@s\.whatsapp\.net$/, "")) || m.fromMe || false;

  // ── Mode self check ──────────────────────────────────────────
  if (!global.public && !isOwner) return;

  // ── Build handleData ──────────────────────────────────────────
  const quoted  = m.quoted || m;
  const mime    = quoted?.mimetype || null;
  const example = (usage) => `Cara penggunaan:\n*${prefix + command}* ${usage}`;

  const handleData = {
    text,
    args,
    isOwner,
    isAdmin  : false, // bisa dikembangkan per-platform
    isBotAdmin: false,
    command,
    prefix,
    mime,
    qmsg     : quoted,
    reply    : m.reply.bind(m),
    example,
    platform,
    getUser,
    getGroup,
    updateData,
    getSettings,
    getPluginStats,
  };

  // ── Log ──────────────────────────────────────────────────────
  const icon = platform === "telegram" ? "🔵" : platform === "discord" ? "🟣" : "🟢";
  console.log(
    chalk.bold(`${icon} [${platform.toUpperCase()}]`) +
    chalk.yellow(` ${prefix}${command}`) +
    chalk.gray(` | ${m.pushName || m.sender}`)
  );

  // ── Route: shared case → shared plugin → platform plugin ─────
  const caseHandled = await runSharedCase(command, m, handleData);
  if (caseHandled) return;

  await runSharedPlugins(m, command, handleData, platform);
}

// ─── SHARED CASE ──────────────────────────────────────────────────────────
async function runSharedCase(command, m, handleData) {
  const { text, args, reply, example, isOwner, updateData } = handleData;

  switch (command) {
    case "hai":
    case "halo":
    case "hello":
    case "hi": {
      await reply(`Halo, *${m.pushName || "kak"}*! 👋\nPlatform: *${handleData.platform}*`);
      return true;
    }

    case "mode": {
      if (!isOwner) { await reply(global.mess.owner); return true; }
      const val = args[0]?.toLowerCase();
      if (val === "public") {
        global.public = true;
        await updateData("settings", "bot", "public", 1);
        await reply("✅ Bot sekarang *PUBLIC*");
      } else if (val === "self") {
        global.public = false;
        await updateData("settings", "bot", "public", 0);
        await reply("✅ Bot sekarang *SELF*");
      } else {
        await reply(`Mode: *${global.public ? "Public" : "Self"}*\nGunakan: mode public / mode self`);
      }
      return true;
    }

    case "say": {
      if (!text) { await reply(example("<teks>")); return true; }
      await reply(text);
      return true;
    }

    default:
      return false;
  }
}

// ─── SHARED PLUGIN LOADER ─────────────────────────────────────────────────
async function runSharedPlugins(m, command, handleData, platform) {
  // Load dari /plugins/ (shared) + /plugins-{platform}/ (platform-specific)
  const dirs = [
    path.join(process.cwd(), "plugins"),
    path.join(process.cwd(), `plugins-${platform}`),
  ];

  let executed = false;
  const allCmds = [];

  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    const plugins = await loadPluginsFromDir(dir);

    for (const plugin of plugins) {
      allCmds.push(...plugin.command);

      if (plugin.command.map((c) => c.toLowerCase()).includes(command.toLowerCase())) {
        try {
          const { prefix: usedPrefix, ...rest } = handleData;
          await plugin(m, { usedPrefix, ...rest });
          executed = true;
        } catch (err) {
          console.error(`[PLUGIN ERROR] ${command}:`, err.message);
          await m.reply(`*Error!*\n\`${err.message}\``);
        }
        break;
      }
    }

    if (executed) break;
  }

  // Did you mean?
  if (!executed) {
    const best = findBestMatch(command, allCmds);
    if (best && best.score > 0.65) {
      const p = handleData.prefix || ".";
      await m.reply(
        `*Command tidak ditemukan!*\n\nMungkin maksudmu:\n→ *${p + best.cmd}* (${(best.score * 100).toFixed(0)}% mirip)`
      );
    }
  }
}

// ─── LOAD PLUGINS FROM DIR ────────────────────────────────────────────────
async function loadPluginsFromDir(dir) {
  const plugins = [];
  if (!fs.existsSync(dir)) return plugins;

  const entries = fs.readdirSync(dir);
  for (const entry of entries) {
    const full = path.join(dir, entry);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      plugins.push(...await loadPluginsFromDir(full));
      continue;
    }
    if (!full.endsWith(".js") && !full.endsWith(".cjs")) continue;

    try {
      let mod;
      if (full.endsWith(".cjs")) {
        delete require.cache[require.resolve(full)];
        mod = require(full);
      } else {
        mod = await import(`${pathToFileURL(full).href}?t=${Date.now()}`);
      }
      const plugin = mod.default || mod;
      if (typeof plugin === "function" && Array.isArray(plugin.command)) {
        plugins.push(plugin);
      }
    } catch (err) {
      console.warn(`[SHARED PLUGIN] Gagal load '${entry}':`, err.message);
    }
  }
  return plugins;
}

// ─── PLUGIN STATS ─────────────────────────────────────────────────────────
export function getPluginStats() {
  const baseDir = path.join(process.cwd(), "plugins");
  if (!fs.existsSync(baseDir)) return { totalCategory: 0, totalFiles: 0, data: [] };

  const folders = fs.readdirSync(baseDir)
    .filter((f) => fs.statSync(path.join(baseDir, f)).isDirectory());

  let totalFiles = 0;
  const data = folders.map((folder) => {
    const files = fs.readdirSync(path.join(baseDir, folder))
      .filter((f) => /\.(js|cjs)$/.test(f));
    totalFiles += files.length;
    return { category: folder, count: files.length };
  });

  return { totalCategory: folders.length, totalFiles, data };
}

// ─── STRING SIMILARITY ────────────────────────────────────────────────────
function findBestMatch(cmd, list) {
  let best = null, score = 0;
  for (const c of list) {
    const s = strSimilarity(cmd, c);
    if (s > score) { score = s; best = c; }
  }
  return best ? { cmd: best, score } : null;
}

function strSimilarity(a, b) {
  const l = a.length > b.length ? a : b;
  const s = a.length > b.length ? b : a;
  if (!l.length) return 1;
  return (l.length - editDist(l, s)) / l.length;
}

function editDist(a, b) {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = a[i-1] === b[j-1] ? dp[i-1][j-1] : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
  return dp[a.length][b.length];
}
