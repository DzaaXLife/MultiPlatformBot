/**
 * handler/handle.js — Command Router / Orchestrator
 * ─────────────────────────────────────────────────────────────────
 *
 * FLOW:
 * 1. Terima (sock, m, chatUpdate) dari index.js
 * 2. Parse body → prefix, command, args, text
 * 3. Bangun variabel konteks: isOwner, isAdmin, isBotAdmin, dll
 * 4. Buat handleData (objek yang di-pass ke case & plugin)
 * 5. Coba runCase(case.js) dulu → jika tidak ada, handleMessage(plugins.js)
 * 6. Log command ke console
 *
 * KENAPA DUA SISTEM (case + plugin)?
 * - case.js : command ringan tanpa file baru, cepat, tidak perlu load disk
 * - plugins  : command kompleks, terpisah per file, bisa hot-reload
 */

import * as fsSync from "fs";
import chalk from "chalk";
import { fileURLToPath, pathToFileURL } from "url";
import { handleMessage, getPluginStats } from "./plugins.js";
import { runCase } from "../case.js";
import { getUser, getGroup, updateData, getSettings } from "../lib/database.js";

const __filename = fileURLToPath(import.meta.url);

export async function caseHandler(sock, m, chatUpdate) {
  try {
    // ── PARSE BODY ──────────────────────────────────────────────
    const body =
      m.mtype === "conversation"          ? m.message.conversation :
      m.mtype === "imageMessage"          ? m.message.imageMessage.caption :
      m.mtype === "videoMessage"          ? m.message.videoMessage.caption :
      m.mtype === "extendedTextMessage"   ? m.message.extendedTextMessage.text :
      m.mtype === "buttonsResponseMessage"? m.message.buttonsResponseMessage.selectedButtonId :
      m.mtype === "listResponseMessage"   ? m.message.listResponseMessage.singleSelectReply.selectedRowId :
      m.mtype === "templateButtonReplyMessage" ? m.message.templateButtonReplyMessage.selectedId :
      "" || "";

    // ── PREFIX DETECTION ────────────────────────────────────────
    /**
     * Mode multiprefix (prefix ketat):
     *   - Hanya merespon jika body dimulai dengan global.prefix (e.g. ".")
     *   - Jika pakai prefix lain → reply "prefix tidak valid"
     *
     * Mode noprefix (global.multiprefix = false):
     *   - Merespon semua pesan yang ada prefix karakter khusus
     *   - Lebih fleksibel tapi kurang kontrol
     */
    const globalPrefix = global.prefix || ".";
    const anyPrefixRegex = /^[°•π÷×¶∆£¢€¥®™+✓_=|~!?@#%^&©.]/i;

    let prefix = "";
    let isCmd = false;

    if (global.multiprefix) {
      if (body.startsWith(globalPrefix)) {
        prefix = globalPrefix;
        isCmd = true;
      } else {
        // Gunakan karakter apapun sebagai prefix? Tidak. Peringati user.
        const hasWrongPrefix =
          anyPrefixRegex.test(body) &&
          !body.startsWith(globalPrefix) &&
          /^[°•π÷×¶∆£¢€¥®™+✓_=|~!?@#%^&©.][a-zA-Z0-9]/.test(body);

        if (hasWrongPrefix) {
          await m.reply(
            `*Prefix tidak valid!*\nGunakan prefix *[ ${globalPrefix} ]* agar bot merespon.\nContoh: *${globalPrefix}menu*`
          );
        }
        return;
      }
    } else {
      const match = body.match(anyPrefixRegex);
      prefix = match ? match[0] : "";
      isCmd = true;
    }

    if (!isCmd) return;

    // ── PARSE COMMAND & ARGS ─────────────────────────────────────
    const command = body.slice(prefix.length).trim().split(/\s+/)[0].toLowerCase();
    const args    = body.slice(prefix.length + command.length).trim().split(/\s+/).filter(Boolean);
    const text    = args.join(" ");

    // ── QUOTED / MIME ─────────────────────────────────────────────
    const quoted = m.quoted ? m.quoted : m;
    const mime   = quoted?.msg?.mimetype || quoted?.mimetype || null;
    const qmsg   = m.quoted || m;
    const botNumber = await sock.decodeJid(sock.user.id);

    // ── ROLE CHECKS ───────────────────────────────────────────────
    /**
     * isOwner: apakah sender ada di global.owner ATAU pesannya from bot sendiri
     */
    const isOwner =
      global.owner.includes(m.sender.replace(/@s\.whatsapp\.net$/, "")) ||
      m.fromMe;

    /**
     * isAdmin / isBotAdmin: ambil dari groupMetadata
     * Hanya relevan di grup; di private chat keduanya false
     */
    let groupMetadata = {}, groupName = "", groupAdmins = [], isAdmin = false, isBotAdmin = false;

    if (m.isGroup) {
      groupMetadata = await sock.groupMetadata(m.chat).catch(() => ({}));
      groupName     = groupMetadata.subject || "";
      const participants = groupMetadata.participants || [];
      groupAdmins = participants
        .filter((p) => p.admin === "admin" || p.admin === "superadmin")
        .map((p) => p.id);
      isAdmin    = groupAdmins.includes(m.sender);
      isBotAdmin = groupAdmins.includes(botNumber);
    }

    // ── REPLY SHORTCUT ────────────────────────────────────────────
    /**
     * Redefinisi reply() agar tampil lebih keren (dengan channel forward)
     * Bisa juga pakai m.reply() langsung dari config.js
     */
    const reply = async (text) =>
      sock.sendMessage(
        m.chat,
        {
          text: `${text}`,
          contextInfo: {
            mentionedJid: [m.sender],
            isForwarded: true,
            forwardedNewsletterMessageInfo: {
              newsletterJid: global.idCh || "",
              newsletterName: "reply",
            },
          },
        },
        { quoted: m }
      );

    // Shortcut untuk tampilkan contoh penggunaan
    const example = (usage) =>
      `Cara penggunaan:\n*${prefix + command}* ${usage}`;

    // ── HANDLE DATA ───────────────────────────────────────────────
    /**
     * handleData: objek yang di-pass ke case.js dan semua plugin
     *
     * DI PLUGIN, prefix diterima sebagai `usedPrefix` (bukan `prefix`)
     * karena di plugins.js ada destructuring:
     *   const { prefix: usedPrefix, ...rest } = Obj
     *
     * Ini pattern penting agar plugin tahu prefix yang sedang aktif.
     */
    const handleData = {
      text,
      args,
      isCmd,
      mime,
      qmsg,
      isOwner,
      isAdmin,
      isBotAdmin,
      command,
      reply,
      example,
      prefix,           // → akan jadi usedPrefix di plugin
      groupMetadata,
      groupName,
      groupAdmins,
      botNumber,
      getUser,
      getGroup,
      updateData,
      getSettings,
      getPluginStats,
    };

    // ── ROUTING: CASE DULU, BARU PLUGIN ───────────────────────────
    if (isCmd) {
      const handled = await runCase(command, m, sock, handleData);
      if (!handled) {
        await handleMessage(m, sock, command, handleData);
      }
    }

    // ── CONSOLE LOG ───────────────────────────────────────────────
    if (isCmd && command) {
      const chatType = m.chat.endsWith("@g.us") ? "GROUP" : "PRIVATE";
      console.log(
        chalk.bgCyan.white.bold("\n [CMD] ") +
        chalk.yellow.bold(` ${prefix}${command}`) +
        chalk.white(` | ${chatType} | `) +
        chalk.cyan(m.pushName || "N/A") +
        chalk.gray(` (${m.sender})`)
      );
    }

  } catch (err) {
    console.error(chalk.red("[HANDLER ERROR]"), err);
    try {
      if (global.owner?.[0]) {
        await sock.sendMessage(
          global.owner[0] + "@s.whatsapp.net",
          { text: `[ERROR]\n${err.toString()}` },
          { quoted: m }
        );
      }
    } catch (_) {}
  }
}

// ── HOT RELOAD ────────────────────────────────────────────────────────────
fsSync.watchFile(__filename, () => {
  fsSync.unwatchFile(__filename);
  console.log(chalk.yellow("[HOT] handle.js berubah, reload..."));
  import(`${pathToFileURL(__filename).href}?t=${Date.now()}`);
});
