/**
 * plugins/owner/prefix.js — Manajemen Prefix Bot
 * ─────────────────────────────────────────────────────────────────
 *
 * Demonstrasi penggunaan `usedPrefix` (bukan `prefix`!)
 * dan `updateData` untuk menyimpan ke database.
 *
 * PERHATIAN:
 * Di plugin, prefix masuk sebagai `usedPrefix` bukan `prefix`.
 * Ini karena di plugins.js ada:
 *   const { prefix: usedPrefix, ...rest } = Obj;
 *   const pluginData = { sock, usedPrefix, ...rest };
 */

const handler = async (m, { args, usedPrefix, command, isOwner, reply, updateData }) => {

  // ── SETPREFIX ─────────────────────────────────────────────────
  if (command === "prefix") {
    if (!isOwner) return reply(global.mess.owner);

    const mode = args[0]?.toLowerCase();

    if (mode === "on") {
      global.multiprefix = true;
      await updateData("settings", "bot", "multiprefix", 1);
      return reply(
        `✅ Mode prefix *ON*\n` +
        `Gunakan *${global.prefix}* untuk memulai command.\n\n` +
        `Contoh: *${global.prefix}menu*`
      );
    }

    if (mode === "off") {
      global.multiprefix = false;
      await updateData("settings", "bot", "multiprefix", 0);
      return reply(`✅ Mode prefix *OFF*\nBot merespon tanpa prefix.`);
    }

    return reply(
      `*ℹ️ Info Prefix*\n\n` +
      `- Mode    : *${global.multiprefix ? "ON" : "OFF"}*\n` +
      `- Prefix  : *${global.prefix || "."}*\n\n` +
      `*Command:*\n` +
      `- *${usedPrefix}prefix on*  → aktifkan prefix\n` +
      `- *${usedPrefix}prefix off* → nonaktifkan prefix\n` +
      `- *${usedPrefix}setprefix [baru]* → ganti prefix`
    );
  }

  // ── SETPREFIX (dari plugin ini juga) ─────────────────────────
  if (command === "setprefix") {
    if (!isOwner) return reply(global.mess.owner);
    if (!args[0]) return reply(`Cara: *${usedPrefix}setprefix [prefix baru]*\nContoh: *${usedPrefix}setprefix !*`);

    const oldPrefix = global.prefix;
    global.prefix   = args[0];
    await updateData("settings", "bot", "prefix", args[0]);

    return reply(
      `✅ *Prefix berhasil diubah!*\n\n` +
      `- Sebelum : *${oldPrefix}*\n` +
      `- Sesudah : *${args[0]}*`
    );
  }

  // ── DELPREFIX ─────────────────────────────────────────────────
  if (command === "delprefix") {
    if (!isOwner) return reply(global.mess.owner);
    global.prefix = ".";
    await updateData("settings", "bot", "prefix", ".");
    return reply(`✅ Prefix di-reset ke default: *.*`);
  }
};

handler.command = ["prefix", "setprefix", "delprefix"];
export default handler;
