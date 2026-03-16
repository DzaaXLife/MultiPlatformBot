/**
 * lib/config.js — Message Normalizer (ConfigBaileys)
 * ─────────────────────────────────────────────────────────────────
 * Fungsi ini menerima (sock, msg) mentah dari Baileys lalu
 * mengembalikan objek `m` yang lebih mudah dipakai.
 *
 * Properti penting yang ditambahkan:
 *   m.id         → ID pesan
 *   m.chat       → JID chat (grup / personal)
 *   m.sender     → JID pengirim
 *   m.fromMe     → boolean apakah dari bot sendiri
 *   m.isGroup    → boolean apakah di grup
 *   m.mtype      → tipe pesan (conversation, imageMessage, dll)
 *   m.msg        → isi pesan (tergantung mtype)
 *   m.body       → teks isi pesan (caption / text)
 *   m.quoted     → pesan yang di-quote
 *   m.mentionedJid → array JID yang di-mention
 *   m.reply(txt) → shortcut sendMessage dengan quote
 */

import * as baileys from "@whiskeysockets/baileys";
import fs from "fs";
import { fileURLToPath, pathToFileURL } from "url";

const {
  extractMessageContent,
  jidNormalizedUser,
  proto,
  getContentType,
  areJidsSameUser,
} = baileys;

const __filename = fileURLToPath(import.meta.url);

export default function ConfigBaileys(sock, msg) {
  if (!msg) return msg;

  // ── KEY / METADATA ────────────────────────────────────────────
  if (msg.key) {
    msg.id      = msg.key.id;
    msg.chat    = msg.key.remoteJid;
    msg.fromMe  = msg.key.fromMe;
    msg.isGroup = msg.chat.endsWith("@g.us");
    msg.sender  = sock.decodeJid(
      msg.fromMe
        ? sock.user.id
        : (msg.key.participant || msg.key.remoteJid)
    );
    if (msg.isGroup) msg.participant = sock.decodeJid(msg.key.participant) || "";
  }

  // ── MESSAGE TYPE & BODY ───────────────────────────────────────
  if (msg.message) {
    msg.mtype = getContentType(msg.message);

    const raw = msg.message[msg.mtype];
    msg.msg   =
      msg.mtype === "viewOnceMessage"
        ? raw.message[getContentType(raw.message)]
        : raw;

    // Teks isi pesan (body)
    msg.body =
      msg.message.conversation ||
      msg.msg?.caption ||
      msg.msg?.text ||
      (msg.mtype === "extendedTextMessage" && msg.msg?.text) ||
      (msg.mtype === "buttonsResponseMessage" && msg.msg?.selectedButtonId) ||
      (msg.mtype === "templateButtonReplyMessage" && msg.msg?.selectedId) ||
      (msg.mtype === "listResponseMessage" && msg.msg?.singleSelectReply?.selectedRowId) ||
      "";

    msg.text = msg.body;

    // ── QUOTED MESSAGE ──────────────────────────────────────────
    let rawQuoted = msg.quoted = msg.msg?.contextInfo?.quotedMessage || null;
    msg.mentionedJid = msg.msg?.contextInfo?.mentionedJid || [];

    if (rawQuoted) {
      let qtype = getContentType(rawQuoted);
      msg.quoted = rawQuoted[qtype];

      // Jika product, drill down satu level lagi
      if (qtype === "productMessage") {
        qtype = getContentType(msg.quoted);
        msg.quoted = msg.quoted[qtype];
      }

      if (typeof msg.quoted === "string") msg.quoted = { text: msg.quoted };

      // Key quoted
      msg.quoted.key = {
        remoteJid: msg.msg.contextInfo.remoteJid || msg.chat,
        participant: jidNormalizedUser(msg.msg.contextInfo.participant),
        fromMe: areJidsSameUser(
          jidNormalizedUser(msg.msg.contextInfo.participant),
          jidNormalizedUser(sock.user.id)
        ),
        id: msg.msg.contextInfo.stanzaId,
      };

      msg.quoted.mtype  = qtype;
      msg.quoted.chat   = msg.quoted.key.remoteJid;
      msg.quoted.id     = msg.quoted.key.id;
      msg.quoted.sender = sock.decodeJid(msg.quoted.key.participant);
      msg.quoted.fromMe = msg.quoted.key.fromMe;
      msg.quoted.text   =
        msg.quoted.text || msg.quoted.caption ||
        msg.quoted.conversation || "";
      msg.quoted.mentionedJid = msg.msg.contextInfo?.mentionedJid || [];

      // Metode download untuk quoted media
      msg.quoted.download = (saveToFile = false) =>
        sock.downloadM(
          msg.quoted,
          msg.quoted.mtype.replace(/[Mm]essage$/, ""),
          saveToFile
        );
    }
  }

  // Download shortcut untuk pesan sendiri
  if (msg.msg?.url) {
    msg.download = (saveToFile = false) =>
      sock.downloadM(msg.msg, msg.mtype.replace(/[Mm]essage$/, ""), saveToFile);
  }

  // ── REPLY SHORTCUT ────────────────────────────────────────────
  /**
   * m.reply(text) → kirim pesan teks dengan quote ke m
   * Mendukung mention otomatis dari teks @628xxx
   */
  msg.reply = async (text, opts = {}) => {
    const jid = opts.chat || msg.chat;
    const quoted = opts.quoted || msg;
    const mentions = [...(text.matchAll(/@(\d{0,16})/g))].map(
      (v) => v[1] + "@s.whatsapp.net"
    );
    return sock.sendMessage(jid, { text, mentions, ...opts }, { quoted });
  };

  return msg;
}

// ── HOT RELOAD ────────────────────────────────────────────────────────────
fs.watchFile(__filename, () => {
  fs.unwatchFile(__filename);
  import(`${pathToFileURL(__filename).href}?t=${Date.now()}`);
});
