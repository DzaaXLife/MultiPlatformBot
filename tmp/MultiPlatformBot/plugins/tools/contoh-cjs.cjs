/**
 * plugins/tools/contoh-cjs.cjs — Contoh Plugin CJS
 * ─────────────────────────────────────────────────────────────────
 *
 * KAPAN PAKAI .cjs?
 * Ketika plugin menggunakan library yang HANYA tersedia sebagai CJS
 * (tidak support ESM) → masukkan sebagai .cjs agar di-require()
 *
 * Perbedaan utama vs .js (ESM):
 *   ESM: export default handler
 *   CJS: module.exports = handler
 *
 * Semua variabel pluginData sama persis — tidak ada perbedaan
 * dari sisi penggunaan.
 */

const handler = async (m, { usedPrefix, reply, isOwner }) => {
  // Contoh: pakai library yang hanya CJS
  // const someLib = require('some-cjs-only-lib')

  await reply(
    `*🧩 Plugin CJS*\n\n` +
    `Ini contoh plugin dengan format CommonJS (.cjs)\n\n` +
    `Prefix yang dipakai: *${usedPrefix}*\n` +
    `Is Owner: *${isOwner ? "Ya" : "Tidak"}*`
  );
};

handler.command = ["cjs", "testcjs"];
module.exports = handler;
