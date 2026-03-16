# Multi-Platform Bot — WA + Telegram + Discord

Bot yang berjalan di **3 platform sekaligus** dalam satu proses Node.js, dengan **shared plugin system**.

---

## 📁 Struktur Folder

```
wabot/
├── index.js                 ← Entry point (jalankan semua bot paralel)
├── settings.js              ← Config global (owner, token WA/TG/DC, dll)
├── case.js                  ← Switch-case command (WA only)
├── package.json
│
├── telegram/
│   └── bot.js               ← Inisialisasi & normalizer Telegram
│
├── discord/
│   └── bot.js               ← Inisialisasi & normalizer Discord
│
├── shared/
│   └── router.js            ← Router bersama (Telegram + Discord pakai ini)
│
├── handler/
│   ├── handle.js            ← Router WA
│   └── plugins.js           ← Plugin loader WA
│
├── lib/
│   ├── config.js            ← Message normalizer WA
│   ├── database.js          ← SQLite
│   └── function.js          ← Global helpers
│
├── plugins/                 ← SHARED PLUGINS (jalan di semua platform)
│   ├── other/ping.js
│   ├── other/menu.js
│   └── owner/prefix.js
│
├── plugins-telegram/        ← Plugin KHUSUS Telegram
│   └── tools/inline.js
│
└── plugins-discord/         ← Plugin KHUSUS Discord
    └── tools/embed.js
```

---

## 🚀 Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Isi `settings.js`

**WhatsApp** — tidak butuh token, pakai pairing code:
```js
global.owner = ["628xxx"]   // nomor HP kamu
```

**Telegram:**
```js
global.teleToken  = "123456:ABC..."    // dari @BotFather
global.teleOwner  = ["12345678"]       // user ID kamu (dari @userinfobot)
```

**Discord:**
```js
global.discordToken = "MTA..."         // dari discord.com/developers
global.discordOwner = ["123456789"]    // user ID kamu (Developer Mode → Copy ID)
```

> Bot yang tokennya kosong akan **dilewati otomatis** — tidak error.

### 3. Jalankan
```bash
npm start
```

---

## ✍️ Membuat Plugin

### Shared Plugin (jalan di WA + Telegram + Discord)
Simpan di `plugins/kategori/namafile.js`

```js
const handler = async (m, { reply, usedPrefix, isOwner, text, args }) => {
  // m.platform → "whatsapp" | "telegram" | "discord"
  await reply(`Halo dari ${m.platform}!`)
}

handler.command = ['test']
export default handler
```

### Plugin khusus Telegram
Simpan di `plugins-telegram/namafile.js`

### Plugin khusus Discord
Simpan di `plugins-discord/namafile.js`

---

## 🔑 Konsep Penting

### Normalisasi Pesan
Setiap platform menghasilkan format pesan yang berbeda.
Bot ini meng-normalize semua pesan ke objek `m` yang seragam:

| Property | Keterangan |
|---|---|
| `m.platform` | `"whatsapp"` / `"telegram"` / `"discord"` |
| `m.sender`   | ID pengirim |
| `m.chat`     | ID chat/channel |
| `m.body`     | Isi teks pesan |
| `m.pushName` | Nama pengirim |
| `m.isGroup`  | Boolean grup atau bukan |
| `m.reply(txt)` | Kirim balasan (otomatis format per platform) |
| `m.replyImage(buf, caption)` | Kirim gambar |
| `m.react(emoji)` | React pesan (Discord/WA) |

### Format Teks Otomatis
Plugin cukup tulis format WA (`*bold*`, `_italic_`) — bot otomatis mengkonversi:
- WA: `*bold*` → dibiarkan
- Telegram: `*bold*` → `<b>bold</b>` (HTML)
- Discord: `*bold*` → `**bold**` (Markdown)

### isOwner per Platform
```js
// WA    → global.owner        = ["628xxx"]
// TG    → global.teleOwner    = ["user_id"]
// DC    → global.discordOwner = ["user_id"]
```

### shared/router.js vs handler/handle.js
- `handler/handle.js` → hanya untuk WA (langsung dari index.js)
- `shared/router.js` → untuk Telegram & Discord (dipanggil dari telegram/bot.js dan discord/bot.js)
- Keduanya load plugin dari `/plugins/` yang sama
