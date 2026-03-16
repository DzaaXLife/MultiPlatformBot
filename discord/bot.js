/**
 * discord/bot.js — Discord Bot
 * ─────────────────────────────────────────────────────────────────
 * Menggunakan: discord.js v14
 *
 * FLOW:
 * 1. Inisialisasi Client dengan Intents yang dibutuhkan
 * 2. Setiap pesan masuk di-normalize ke objek `m` yang mirip WA
 * 3. Di-route ke shared handler (shared/router.js)
 *
 * OBJEK `m` yang dihasilkan (sama dengan WA/Telegram):
 *   m.sender     → user ID Discord
 *   m.chat       → channel ID
 *   m.isGroup    → boolean (true jika di guild channel)
 *   m.body       → teks pesan
 *   m.pushName   → username
 *   m.reply(txt) → kirim balasan
 *   m.platform   → "discord"
 */

import { Client, GatewayIntentBits, Partials } from "discord.js";
import chalk from "chalk";
import { routeMessage } from "../shared/router.js";

let client = null;

export async function startDiscordBot() {
  if (!global.discordToken) {
    console.log(chalk.yellow("[DISCORD] Token tidak diset di settings.js, dilewati."));
    return;
  }

  client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,  // Wajib untuk baca isi pesan
      GatewayIntentBits.DirectMessages,
    ],
    partials: [Partials.Channel, Partials.Message],
  });

  client.once("ready", () => {
    console.log(chalk.green(`[DISCORD] Bot ${client.user.tag} aktif!`));
  });

  client.on("error", (err) => {
    console.error(chalk.red("[DISCORD] Client error:"), err.message);
  });

  client.on("messageCreate", async (msg) => {
    // Abaikan pesan dari bot sendiri
    if (msg.author.bot) return;

    try {
      const m = normalizeDiscordMsg(msg);
      if (!m) return;
      await routeMessage(m, "discord");
    } catch (err) {
      console.error(chalk.red("[DISCORD] Error:"), err.message);
    }
  });

  await client.login(global.discordToken);
  return client;
}

// ─── NORMALIZE DISCORD MESSAGE ────────────────────────────────────────────
function normalizeDiscordMsg(msg) {
  if (!msg) return null;

  const senderId = msg.author.id;
  const chatId   = msg.channel.id;
  const isGroup  = !!msg.guild; // DM = false, server channel = true
  const text     = msg.content || "";

  const m = {
    // ── Identity ─────────────────────────────────────────────
    platform : "discord",
    id       : msg.id,
    chat     : chatId,
    sender   : senderId,
    fromMe   : false,
    isGroup,
    pushName : msg.member?.displayName || msg.author.username,
    body     : text,
    text,

    // ── Raw ───────────────────────────────────────────────────
    raw: msg,

    // ── Quoted ────────────────────────────────────────────────
    quoted: msg.reference ? {
      id     : msg.reference.messageId,
      sender : null, // bisa di-fetch jika perlu
      text   : null,
    } : null,

    // ── Reply shortcut ────────────────────────────────────────
    reply: async (txt, opts = {}) => {
      // Konversi format WA → Discord markdown
      const dcText = waFormatToDiscord(txt);
      return msg.reply({ content: dcText, ...opts });
    },

    // ── Send image ────────────────────────────────────────────
    replyImage: async (buffer, caption = "") => {
      const { AttachmentBuilder } = await import("discord.js");
      const attachment = new AttachmentBuilder(buffer, { name: "image.png" });
      return msg.reply({
        content: waFormatToDiscord(caption) || undefined,
        files: [attachment],
      });
    },

    // ── Send file ─────────────────────────────────────────────
    replyFile: async (buffer, filename = "file.bin") => {
      const { AttachmentBuilder } = await import("discord.js");
      const attachment = new AttachmentBuilder(buffer, { name: filename });
      return msg.reply({ files: [attachment] });
    },

    // ── React ─────────────────────────────────────────────────
    react: async (emoji = "✅") => {
      try { await msg.react(emoji); } catch (_) {}
    },
  };

  return m;
}

// ─── FORMAT CONVERTER WA → DISCORD MARKDOWN ──────────────────────────────
/**
 * WA   : *bold*, _italic_, ~strike~, ```code```
 * Discord: **bold**, *italic*, ~~strike~~, `code`
 */
export function waFormatToDiscord(text) {
  if (typeof text !== "string") return String(text || "");
  return text
    .replace(/```([\s\S]*?)```/g, "`$1`")
    .replace(/\*([^*\n]+)\*/g, "**$1**")
    .replace(/_([^_\n]+)_/g, "*$1*")
    .replace(/~([^~\n]+)~/g, "~~$1~~");
}

export { client };
