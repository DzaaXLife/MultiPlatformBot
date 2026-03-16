/**
 * plugins/other/menu.js — Command Menu / Help
 * ─────────────────────────────────────────────────────────────────
 * Menampilkan daftar fitur bot beserta statistik plugin.
 * Menggunakan getPluginStats() untuk menghitung total plugin.
 */

import os from "os";

const handler = async (m, { sock, usedPrefix, isOwner, reply, getPluginStats }) => {
  const stats     = getPluginStats();
  const botNumber = sock?.user?.id?.split(":")[0] || "???";
  const date      = new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" });

  const categoryList = stats.data
    .map((d) => `  • ${d.category} (${d.count} plugin)`)
    .join("\n");

  await reply(
    `╭──「 *${global.namaBot}* 」\n` +
    `│ Halo, *${m.pushName || "kak"}*! 👋\n` +
    `│\n` +
    `│ 📦 *Statistik Plugin*\n` +
    `│  - Kategori : ${stats.totalCategory}\n` +
    `│  - Total    : ${stats.totalFiles} plugin\n` +
    `│\n` +
    `│ 📂 *Kategori:*\n` +
    (categoryList ? `${categoryList}\n` : `  • (kosong)\n`) +
    `│\n` +
    `│ ⚙️ *Info Bot*\n` +
    `│  - Mode   : ${global.public ? "Public 🌍" : "Self 🔒"}\n` +
    `│  - Prefix : ${global.multiprefix ? `*${global.prefix}*` : "Tanpa prefix"}\n` +
    `│  - Uptime : ${runtime(process.uptime())}\n` +
    `│  - RAM    : ${formatBytes(os.totalmem() - os.freemem())}\n` +
    `│\n` +
    `│ 🕐 ${date}\n` +
    `╰──── by *${global.namaOwner}*`
  );
};

handler.command = ["menu", "help", "start"];
export default handler;
