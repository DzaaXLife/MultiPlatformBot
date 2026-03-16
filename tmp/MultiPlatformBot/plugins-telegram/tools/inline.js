/**
 * plugins-telegram/tools/inline.js
 * ─────────────────────────────────────────────────────────────────
 * Contoh plugin KHUSUS TELEGRAM (hanya ada di folder plugins-telegram/)
 * Menggunakan fitur inline keyboard yang tidak ada di WA/Discord.
 *
 * Folder plugins-{platform}/ diload SETELAH /plugins/ (shared).
 * Jika command ada di keduanya → plugins/ yang dijalankan (prioritas shared).
 */

const handler = async (m, { reply }) => {
  // Akses raw Telegram message object
  const rawMsg = m.raw;
  const chatId = m.chat;

  // Karena kita perlu kirim inline keyboard, kita pakai m.raw._bot
  // (bot instance Telegram yang disimpan ke raw._bot di telegram/bot.js)
  const bot = rawMsg?._bot;

  if (!bot) {
    return reply("*Fitur ini hanya tersedia di Telegram*");
  }

  await bot.sendMessage(chatId, "Pilih salah satu:", {
    reply_markup: {
      inline_keyboard: [
        [
          { text: "🔵 Opsi A", callback_data: "opsi_a" },
          { text: "🟢 Opsi B", callback_data: "opsi_b" },
        ],
        [{ text: "❌ Tutup", callback_data: "close" }],
      ],
    },
  });
};

handler.command = ["inline", "keyboard"];
export default handler;
