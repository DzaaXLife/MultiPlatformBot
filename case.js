/**
 * case.js — Switch-Case Command Handler
 * ─────────────────────────────────────────────────────────────────
 *
 * KAPAN PAKAI CASE vs PLUGIN?
 * ┌──────────────┬───────────────────────────────────────────────┐
 * │  case.js     │ Command sederhana, cepat, tidak butuh file    │
 * │              │ baru. Langsung di sini saja.                  │
 * ├──────────────┼───────────────────────────────────────────────┤
 * │  plugins/**  │ Command kompleks, butuh library khusus,       │
 * │              │ ingin bisa di-add/remove tanpa restart.       │
 * └──────────────┴───────────────────────────────────────────────┘
 *
 * FORMAT:
 *   case 'namacommand': {
 *     // logic kamu
 *     break
 *   }
 *
 * VARIABEL TERSEDIA (dari handleData):
 *   m, sock, text, args, reply, example
 *   isOwner, isAdmin, isBotAdmin
 *   prefix, command, mime, qmsg
 *   getUser, getGroup, updateData, getSettings
 *
 * Return: true  → command ini sudah dihandle, skip plugin
 *         false → tidak ada di case, lanjut ke plugin
 */

import * as fsSync from "fs";
import { fileURLToPath, pathToFileURL } from "url";

const __filename = fileURLToPath(import.meta.url);

// ─── AUTO-PARSE CASE COMMANDS (untuk menu) ────────────────────────────────
export function getCaseCommands() {
  const code = fsSync.readFileSync(fileURLToPath(import.meta.url), "utf8");
  const commands = [];
  const regex = /^\s*case\s+['"`]([^'"`]+)['"`]\s*:/gm;
  let match;
  while ((match = regex.exec(code)) !== null) commands.push(match[1]);
  return commands;
}

// ─── CASE HANDLER ─────────────────────────────────────────────────────────
export async function runCase(command, m, sock, handleData) {
  const {
    text, args, reply, example,
    isOwner, isAdmin, isBotAdmin,
    prefix, mime, qmsg,
    getUser, getGroup, updateData, getSettings,
  } = handleData;

  switch (command) {

    // ─────────────────────────────────────────────────────────────
    // CONTOH: Command sapaan sederhana
    // ─────────────────────────────────────────────────────────────
    case "hai":
    case "halo":
    case "hello": {
      await reply(`Halo juga, ${m.pushName || "kak"}! 👋`);
      break;
    }

    // ─────────────────────────────────────────────────────────────
    // CONTOH: Command owner-only
    // ─────────────────────────────────────────────────────────────
    case "broadcast": {
      if (!isOwner) return reply(global.mess.owner);
      if (!text) return reply(example("<pesan yang ingin dikirim>"));
      // logic broadcast di sini
      await reply(`Broadcast dikirim:\n${text}`);
      break;
    }

    // ─────────────────────────────────────────────────────────────
    // CONTOH: Toggle mode bot (public/self)
    // ─────────────────────────────────────────────────────────────
    case "mode": {
      if (!isOwner) return reply(global.mess.owner);
      const val = args[0]?.toLowerCase();
      if (val === "public") {
        global.public = true;
        await updateData("settings", "bot", "public", 1);
        return reply("✅ Bot sekarang *PUBLIC* — siapa saja bisa pakai.");
      }
      if (val === "self") {
        global.public = false;
        await updateData("settings", "bot", "public", 0);
        return reply("✅ Bot sekarang *SELF* — hanya owner yang bisa pakai.");
      }
      return reply(
        `*Mode saat ini:* ${global.public ? "Public" : "Self"}\n\n` +
        `Gunakan:\n- *${prefix}mode public*\n- *${prefix}mode self*`
      );
    }

    // ─────────────────────────────────────────────────────────────
    // CONTOH: Set prefix baru
    // ─────────────────────────────────────────────────────────────
    case "setprefix": {
      if (!isOwner) return reply(global.mess.owner);
      if (!args[0]) return reply(example("<prefix baru>"));
      const old = global.prefix;
      global.prefix = args[0];
      await updateData("settings", "bot", "prefix", args[0]);
      return reply(`✅ Prefix berhasil diubah!\n- Lama: *${old}*\n- Baru: *${args[0]}*`);
    }

    // ─────────────────────────────────────────────────────────────
    // CONTOH: Command dengan args
    // ─────────────────────────────────────────────────────────────
    case "say": {
      if (!text) return reply(example("<teks yang ingin diucapkan>"));
      await reply(text);
      break;
    }

    // Tidak ada di case → kembalikan false agar lanjut ke plugin
    default:
      return false;
  }

  return true; // sudah dihandle
}

// ── HOT RELOAD ────────────────────────────────────────────────────────────
fsSync.watchFile(__filename, () => {
  fsSync.unwatchFile(__filename);
  import(`${pathToFileURL(__filename).href}?t=${Date.now()}`);
});
