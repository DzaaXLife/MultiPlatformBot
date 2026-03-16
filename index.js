/**
 * index.js — Entry Point (WA + Telegram + Discord)
 */
process.on("uncaughtException", (err) => { console.error("[UNCAUGHT]", err); });

import "./settings.js";
import "./lib/function.js";

import {
  makeWASocket, useMultiFileAuthState, fetchLatestWaWebVersion,
  DisconnectReason, downloadContentFromMessage, makeInMemoryStore, jidDecode, Browsers,
} from "@whiskeysockets/baileys";

import fs from "fs";
import chalk from "chalk";
import { fileURLToPath, pathToFileURL } from "url";
import pino from "pino";
import { Boom } from "@hapi/boom";
import path from "path";
import readline from "readline";
import { fileTypeFromBuffer } from "file-type";

import ConfigBaileys from "./lib/config.js";
import { caseHandler } from "./handler/handle.js";
import { initDb, getSettings } from "./lib/database.js";
import { startTelegramBot } from "./telegram/bot.js";
import { startDiscordBot } from "./discord/bot.js";

const __filename = fileURLToPath(import.meta.url);
const store = makeInMemoryStore({ logger: pino().child({ level: "silent", stream: "store" }) });

console.log(chalk.cyan("[DB] Memuat database..."));
await initDb();
console.log(chalk.green("[DB] Siap!\n"));

const botSet = await getSettings();
global.public      = botSet.public === 1;
global.prefix      = botSet.prefix;
global.multiprefix = botSet.multiprefix === 1;

async function inputNumber(prompt) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((res) => { rl.question(prompt, (a) => { rl.close(); res(a); }); });
}

// ══════════════════════════════════════════════════════════════════
//  WHATSAPP BOT
// ══════════════════════════════════════════════════════════════════
async function startWABot() {
  const { state, saveCreds } = await useMultiFileAuthState("Auth");
  const { version } = await fetchLatestWaWebVersion();

  const sock = makeWASocket({
    browser: Browsers.ubuntu("Firefox"),
    generateHighQualityLinkPreview: true,
    printQRInTerminal: false,
    auth: state,
    version,
    getMessage: async (key) => {
      const msg = await store.loadMessage(key.remoteJid, key.id);
      return msg?.message || undefined;
    },
    logger: pino({ level: "silent" }),
  });

  store?.bind(sock.ev);

  if (!sock.authState.creds.registered) {
    let phone = await inputNumber(chalk.cyan("[WA] Masukkan nomor HP (628xxx):\n> "));
    phone = phone.replace(/\D/g, "");
    setTimeout(async () => {
      const raw  = await sock.requestPairingCode(phone);
      const code = raw.slice(0, 4) + "-" + raw.slice(4, 8);
      console.log(chalk.green(`[WA] Kode pairing: `) + chalk.bold.yellow(code));
    }, 3000);
  }

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async ({ connection, lastDisconnect }) => {
    if (!connection) return;
    if (connection === "close") {
      const reason = new Boom(lastDisconnect?.error)?.output?.statusCode;
      const reconnects = [DisconnectReason.connectionClosed, DisconnectReason.connectionLost, DisconnectReason.restartRequired, DisconnectReason.timedOut];
      if (reconnects.includes(reason)) return startWABot();
      if ([DisconnectReason.loggedOut, DisconnectReason.badSession].includes(reason)) {
        console.log(chalk.red("[WA] Sesi tidak valid. Hapus folder Auth dan restart.")); return;
      }
      return startWABot();
    }
    if (connection === "open") {
      const num = sock?.user?.id?.split(":")[0] || "???";
      console.log(chalk.green.bold(`[WA] ✓ Terhubung! ${sock?.user?.name} (${num})`));
    }
  });

  sock.ev.on("messages.upsert", async (chatUpdate) => {
    try {
      const msg = chatUpdate.messages[0];
      if (!msg?.message) return;
      const m = await ConfigBaileys(sock, msg);
      const isOwner = global.owner.includes(m.sender.replace(/@s\.whatsapp\.net$/, "")) || m.fromMe;
      if (!global.public && !isOwner && !m.key?.fromMe) return;
      caseHandler(sock, m, chatUpdate);
    } catch (err) { console.error(chalk.red("[WA ERROR]"), err.message); }
  });

  sock.decodeJid = (jid) => {
    if (!jid) return jid;
    if (/:\d+@/gi.test(jid)) { const d = jidDecode(jid) || {}; return d.user && d.server ? `${d.user}@${d.server}` : jid; }
    return jid;
  };

  sock.downloadM = async (m, type, filename = "") => {
    if (!m || !(m.url || m.directPath)) return Buffer.alloc(0);
    const stream = await downloadContentFromMessage(m, type);
    let buf = Buffer.from([]);
    for await (const chunk of stream) buf = Buffer.concat([buf, chunk]);
    if (filename) await fs.promises.writeFile(filename, buf);
    return filename && fs.existsSync(filename) ? filename : buf;
  };
}

// ══════════════════════════════════════════════════════════════════
//  MULAI SEMUA BOT SECARA PARALEL
// ══════════════════════════════════════════════════════════════════
console.log(chalk.bold.cyan("╔══════════════════════════════╗"));
console.log(chalk.bold.cyan("║     Multi-Platform Bot v1     ║"));
console.log(chalk.bold.cyan("╚══════════════════════════════╝\n"));
console.log(chalk.white("Platform aktif yang token-nya terisi:\n"));

await Promise.allSettled([
  startWABot(),
  startTelegramBot(),
  startDiscordBot(),
]);

fs.watchFile(__filename, () => {
  fs.unwatchFile(__filename);
  console.log(chalk.yellow("[HOT] index.js berubah, reload..."));
  import(`${pathToFileURL(__filename).href}?t=${Date.now()}`);
});
