/**
 * plugins/other/ping.js — Ping (Multi-platform)
 * Plugin ini jalan di WA, Telegram, DAN Discord.
 * m.platform → "whatsapp" | "telegram" | "discord"
 */
import { performance } from "perf_hooks";
import os from "os";

const handler = async (m, { reply }) => {
  const start = performance.now();
  await new Promise((r) => setTimeout(r, 5));
  const latency = (performance.now() - start).toFixed(1);
  const ram     = os.totalmem() - os.freemem();
  const ramPct  = ((ram / os.totalmem()) * 100).toFixed(1);
  const icon    =
    m.platform === "telegram" ? "🔵 Telegram" :
    m.platform === "discord"  ? "🟣 Discord"  : "🟢 WhatsApp";

  await reply(
    `*🏓 PONG!*\n\n` +
    `- Platform : *${icon}*\n` +
    `- Latensi  : *${latency} ms*\n` +
    `- Uptime   : *${runtime(process.uptime())}*\n` +
    `- RAM      : *${formatBytes(ram)} (${ramPct}%)*\n` +
    `- Node.js  : *${process.version}*`
  );
};

handler.command = ["ping", "speed", "p"];
export default handler;
