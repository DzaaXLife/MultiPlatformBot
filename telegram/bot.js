/**
 * telegram/bot.js — Telegram Bot
 * ─────────────────────────────────────────────────────────────────
 * Menggunakan: node-telegram-bot-api (CJS wrapper di ESM)
 *
 * FLOW:
 * 1. Inisialisasi TelegramBot dengan token dari settings.js
 * 2. Setiap pesan masuk di-normalize ke objek `m` yang mirip WA
 * 3. Di-route ke shared handler (shared/router.js)
 * 4. Plugin WA bisa dipakai juga di Telegram karena interface sama
 *
 * OBJEK `m` yang dihasilkan:
 *   m.sender     → user ID Telegram (string)
 *   m.chat       → chat ID
 *   m.isGroup    → boolean
 *   m.body       → teks pesan
 *   m.pushName   → username/first name
 *   m.fromMe     → false (Telegram tidak kenal fromMe)
 *   m.reply(txt) → kirim pesan balasan
 *   m.platform   → "telegram"
 */

import TelegramBot from "node-telegram-bot-api";
import chalk from "chalk";
import { routeMessage } from "../shared/router.js";

let bot = null;

export async function startTelegramBot() {
  if (!global.teleToken) {
    console.log(chalk.yellow("[TELEGRAM] Token tidak diset di settings.js, dilewati."));
    return;
  }

  bot = new TelegramBot(global.teleToken, { polling: true });

  bot.on("polling_error", (err) => {
    console.error(chalk.red("[TELEGRAM] Polling error:"), err.message);
  });

  bot.on("message", async (msg) => {
    try {
      // ── NORMALIZE ke objek `m` ──────────────────────────────
      const m = normalizeTelegramMsg(bot, msg);
      if (!m) return;

      // ── ROUTE ke shared router ──────────────────────────────
      await routeMessage(m, "telegram");
    } catch (err) {
      console.error(chalk.red("[TELEGRAM] Error:"), err.message);
    }
  });

  // Callback query (inline keyboard)
  bot.on("callback_query", async (query) => {
    try {
      await bot.answerCallbackQuery(query.id);
    } catch (_) {}
  });

  const me = await bot.getMe();
  console.log(chalk.green(`[TELEGRAM] Bot @${me.username} aktif!`));
  return bot;
}

// ─── NORMALIZE TELEGRAM MESSAGE ───────────────────────────────────────────
function normalizeTelegramMsg(bot, msg) {
  if (!msg || !msg.from) return null;

  const chatId    = String(msg.chat.id);
  const senderId  = String(msg.from.id);
  const text      = msg.text || msg.caption || "";
  const isGroup   = msg.chat.type === "group" || msg.chat.type === "supergroup";
  const pushName  = msg.from.first_name + (msg.from.last_name ? ` ${msg.from.last_name}` : "");
  const isOwner   = global.teleOwner?.includes(senderId) || false;

  // Tentukan isAdmin jika di grup
  let isAdmin = false;
  // (cek admin secara async tidak ideal di sini, bisa di-cache terpisah)

  const m = {
    // ── Identity ─────────────────────────────────────────────
    platform : "telegram",
    id       : String(msg.message_id),
    chat     : chatId,
    sender   : senderId,
    fromMe   : false,
    isGroup,
    pushName,
    body     : text,
    text,

    // ── Raw ───────────────────────────────────────────────────
    raw      : msg,

    // ── Quoted ────────────────────────────────────────────────
    quoted   : msg.reply_to_message
      ? normalizeTelegramMsg(bot, msg.reply_to_message)
      : null,

    // ── Reply shortcut ────────────────────────────────────────
    reply: async (txt, opts = {}) => {
      // Format: WA menggunakan *bold*, Telegram pakai <b>bold</b> (HTML)
      const tgText = waFormatToTelegram(txt);
      return bot.sendMessage(chatId, tgText, {
        parse_mode: "HTML",
        reply_to_message_id: msg.message_id,
        ...opts,
      });
    },

    // ── Send image ────────────────────────────────────────────
    replyImage: async (buffer, caption = "") => {
      return bot.sendPhoto(chatId, buffer, {
        caption: waFormatToTelegram(caption),
        parse_mode: "HTML",
        reply_to_message_id: msg.message_id,
      });
    },

    // ── Send file ─────────────────────────────────────────────
    replyFile: async (buffer, filename = "file") => {
      return bot.sendDocument(chatId, buffer, {
        reply_to_message_id: msg.message_id,
      }, { filename });
    },

    // ── React (Telegram tidak punya native react, skip) ──────
    react: async () => {},
  };

  return m;
}

// ─── FORMAT CONVERTER WA → TELEGRAM HTML ─────────────────────────────────
/**
 * WA pakai *bold*, _italic_, ~strikethrough~, ```code```
 * Telegram HTML: <b>, <i>, <s>, <code>
 */
export function waFormatToTelegram(text) {
  if (typeof text !== "string") return String(text || "");
  return text
    .replace(/```([\s\S]*?)```/g, "<code>$1</code>")
    .replace(/\*([^*]+)\*/g, "<b>$1</b>")
    .replace(/_([^_]+)_/g, "<i>$1</i>")
    .replace(/~([^~]+)~/g, "<s>$1</s>");
}

export { bot };
