/**
 * settings.js — Global Config (WA + Telegram + Discord)
 * ─────────────────────────────────────────────────────────────────
 */

import fs from "fs";
import chalk from "chalk";
import { fileURLToPath, pathToFileURL } from "url";
const __filename = fileURLToPath(import.meta.url);

// ════════════════════════════════════════════════════════════
//  WHATSAPP
// ════════════════════════════════════════════════════════════
global.owner     = ["628xxxxxxxxxx"];  // Nomor WA owner (tanpa + dan @s.whatsapp.net)
global.developer = "628xxxxxxxxxx";

// ════════════════════════════════════════════════════════════
//  TELEGRAM
// ════════════════════════════════════════════════════════════
/**
 * Cara dapat token:
 *   Chat @BotFather → /newbot → copy token
 * Cara dapat teleOwner (user ID):
 *   Chat @userinfobot → lihat ID yang muncul
 */
global.teleToken  = "";               // Token dari @BotFather
global.teleChatId = "";               // Chat ID untuk error log
global.teleOwner  = [""];             // User ID owner Telegram (array string)

// ════════════════════════════════════════════════════════════
//  DISCORD
// ════════════════════════════════════════════════════════════
/**
 * Cara dapat token:
 *   discord.com/developers → New App → Bot → Reset Token → copy
 *   Aktifkan MESSAGE CONTENT INTENT di tab Bot!
 * Cara dapat discordOwner (user ID):
 *   Discord Settings → Advanced → Developer Mode ON
 *   Klik kanan nama kamu → Copy User ID
 */
global.discordToken = "";             // Bot token Discord
global.discordOwner = [""];           // User ID owner Discord (array string)

// ════════════════════════════════════════════════════════════
//  IDENTITAS BOT
// ════════════════════════════════════════════════════════════
global.namaBot    = "MyBot";
global.namaOwner  = "Owner";
global.versi      = "1.0.0";
global.foto       = "./image.jpg";
global.idCh       = "";              // Newsletter JID WA jika ada

// ════════════════════════════════════════════════════════════
//  API KEYS
// ════════════════════════════════════════════════════════════
global.apiKey     = "";

// ════════════════════════════════════════════════════════════
//  PESAN ERROR STANDAR
// ════════════════════════════════════════════════════════════
global.mess = {
  owner:    "*[REJECT]* - Hanya untuk *OWNER*",
  admin:    "*[REJECT]* - Hanya untuk *ADMIN GRUP*",
  botAdmin: "*[REJECT]* - *Bot harus menjadi Admin*",
  group:    "*[REJECT]* - Hanya bisa digunakan di *GRUP*",
  private:  "*[REJECT]* - Hanya bisa digunakan di *CHAT PRIBADI*",
  premium:  "*[REJECT]* - Hanya untuk *USER PREMIUM*",
};

// ─── HOT RELOAD ───────────────────────────────────────────────────────────
fs.watchFile(__filename, () => {
  fs.unwatchFile(__filename);
  console.log(chalk.yellow("[HOT] settings.js berubah, reload..."));
  import(`${pathToFileURL(__filename).href}?t=${Date.now()}`);
});
