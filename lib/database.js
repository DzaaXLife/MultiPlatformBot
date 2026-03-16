/**
 * lib/database.js — SQLite Database Layer
 * ─────────────────────────────────────────────────────────────────
 * Menggunakan sqlite3 (CJS module, tapi kita wrap dengan Promise)
 *
 * Tabel:
 *   settings  → konfigurasi bot (prefix, public mode, dll)
 *   users     → data user (limit, balance, premium, dll)
 *   groups    → konfigurasi per-grup
 */

import sqlite3 from "sqlite3";
import path from "path";

const dbPath = path.join(process.cwd(), "data", "database.db");

// Buka koneksi database (singleton)
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) console.error("[DB] Gagal membuka database:", err.message);
});

// ─── HELPERS ──────────────────────────────────────────────────────────────
const run = (sql, params = []) =>
  new Promise((res, rej) =>
    db.run(sql, params, (err) => (err ? rej(err) : res()))
  );

const get = (sql, params = []) =>
  new Promise((res, rej) =>
    db.get(sql, params, (err, row) => (err ? rej(err) : res(row)))
  );

const all = (sql, params = []) =>
  new Promise((res, rej) =>
    db.all(sql, params, (err, rows) => (err ? rej(err) : res(rows)))
  );

// ─── INISIALISASI TABEL ───────────────────────────────────────────────────
export async function initDb() {
  await run(`CREATE TABLE IF NOT EXISTS settings (
    id          TEXT PRIMARY KEY,
    prefix      TEXT    DEFAULT '.',
    multiprefix INTEGER DEFAULT 0,
    public      INTEGER DEFAULT 1
  )`);

  await run(`CREATE TABLE IF NOT EXISTS users (
    id       TEXT PRIMARY KEY,
    name     TEXT,
    limit_val INTEGER DEFAULT 20,
    balance  INTEGER DEFAULT 0,
    premium  INTEGER DEFAULT 0,
    banned   INTEGER DEFAULT 0,
    level    INTEGER DEFAULT 1,
    exp      INTEGER DEFAULT 0
  )`);

  await run(`CREATE TABLE IF NOT EXISTS groups (
    id        TEXT PRIMARY KEY,
    welcome   INTEGER DEFAULT 0,
    antilink  INTEGER DEFAULT 0,
    mute      INTEGER DEFAULT 0
  )`);

  // Seed settings jika belum ada
  const existing = await get("SELECT id FROM settings WHERE id = 'bot'");
  if (!existing) {
    await run(
      "INSERT INTO settings (id, prefix, multiprefix, public) VALUES ('bot', '.', 0, 1)"
    );
  }
}

// ─── SETTINGS ─────────────────────────────────────────────────────────────
export async function getSettings() {
  return get("SELECT * FROM settings WHERE id = 'bot'");
}

// ─── USER ─────────────────────────────────────────────────────────────────
export async function getUser(id) {
  let user = await get("SELECT * FROM users WHERE id = ?", [id]);
  if (!user) {
    await run(
      "INSERT OR IGNORE INTO users (id) VALUES (?)",
      [id]
    );
    user = await get("SELECT * FROM users WHERE id = ?", [id]);
  }
  return user;
}

// ─── GROUP ────────────────────────────────────────────────────────────────
export async function getGroup(id) {
  let group = await get("SELECT * FROM groups WHERE id = ?", [id]);
  if (!group) {
    await run("INSERT OR IGNORE INTO groups (id) VALUES (?)", [id]);
    group = await get("SELECT * FROM groups WHERE id = ?", [id]);
  }
  return group;
}

// ─── UPDATE DATA GENERIK ──────────────────────────────────────────────────
/**
 * updateData(table, id, column, value)
 * Contoh: await updateData('settings', 'bot', 'prefix', '!')
 */
export async function updateData(table, id, column, value) {
  await run(
    `UPDATE ${table} SET ${column} = ? WHERE id = ?`,
    [value, id]
  );
}
