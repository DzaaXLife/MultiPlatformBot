/**
 * plugins-discord/tools/embed.js
 * ─────────────────────────────────────────────────────────────────
 * Contoh plugin KHUSUS DISCORD.
 * Menggunakan EmbedBuilder — fitur Discord yang tidak ada di WA/Telegram.
 */

const handler = async (m, { reply }) => {
  const msg = m.raw;

  // Coba kirim embed Discord
  try {
    const { EmbedBuilder } = await import("discord.js");

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle(`${global.namaBot}`)
      .setDescription("Bot multi-platform yang berjalan di WA, Telegram, dan Discord!")
      .addFields(
        { name: "🟢 WhatsApp",  value: "Baileys", inline: true },
        { name: "🔵 Telegram",  value: "node-telegram-bot-api", inline: true },
        { name: "🟣 Discord",   value: "discord.js v14", inline: true },
      )
      .addFields({ name: "⚙️ Mode", value: global.public ? "Public 🌍" : "Self 🔒" })
      .setFooter({ text: `by ${global.namaOwner} • v${global.versi}` })
      .setTimestamp();

    await msg.reply({ embeds: [embed] });
  } catch (err) {
    // Fallback ke text biasa jika tidak di Discord
    await reply(`*${global.namaBot}*\nBot multi-platform!\n- WA, Telegram, Discord`);
  }
};

handler.command = ["embed", "info"];
export default handler;
