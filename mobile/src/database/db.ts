import * as SQLite from 'expo-sqlite';
import { EmergencyContact, AlertHistoryItem } from '../types';

let dbInstance: SQLite.SQLiteDatabase | null = null;

export function getDatabase(): SQLite.SQLiteDatabase {
  if (!dbInstance) {
    dbInstance = SQLite.openDatabaseSync('resqhub.db');
    initDatabase(dbInstance);
  }
  return dbInstance;
}

export function initDatabase(db: SQLite.SQLiteDatabase) {
  // WAL mode for improved performance & durability
  db.execSync('PRAGMA journal_mode = WAL;');

  // Table 1: Emergency Contacts
  db.execSync(`
    CREATE TABLE IF NOT EXISTS contacts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      number TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now', 'utc'))
    );
  `);

  // Table 2: Alert History (local ledger)
  db.execSync(`
    CREATE TABLE IF NOT EXISTS alert_history (
      id TEXT PRIMARY KEY,
      idempotency_key TEXT,
      status TEXT NOT NULL,
      message TEXT NOT NULL,
      latitude REAL,
      longitude REAL,
      map_url TEXT,
      recipients_count INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now', 'utc')),
      resolved_at TEXT,
      synced INTEGER DEFAULT 0
    );
  `);

  // Migrate existing table if synced column is missing
  try {
    db.execSync('ALTER TABLE alert_history ADD COLUMN synced INTEGER DEFAULT 0;');
  } catch {
    // Column already exists
  }

  // Table 3: Local Settings & Key-Value storage
  db.execSync(`
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
}

// ==========================================
// Contacts CRUD
// ==========================================

export const MAX_CONTACTS = 5;

export function getContactsCount(): number {
  const db = getDatabase();
  const row = db.getFirstSync<{ count: number }>('SELECT COUNT(*) as count FROM contacts;');
  return row ? row.count : 0;
}

export function getAllContacts(): EmergencyContact[] {
  const db = getDatabase();
  return db.getAllSync<EmergencyContact>(
    'SELECT id, name, number, created_at FROM contacts ORDER BY created_at ASC;'
  );
}

export function insertContact(name: string, number: string): { success: boolean; error?: string; contact?: EmergencyContact } {
  const db = getDatabase();
  const count = getContactsCount();

  if (count >= MAX_CONTACTS) {
    return { success: false, error: `Maximum of ${MAX_CONTACTS} emergency contacts allowed.` };
  }

  // Check duplicate phone number
  const cleanNumber = number.replace(/[\s\-\(\)]/g, '');
  const existing = db.getFirstSync<{ id: string }>(
    'SELECT id FROM contacts WHERE REPLACE(REPLACE(REPLACE(number, " ", ""), "-", ""), "(", "") = ?;',
    [cleanNumber]
  );
  if (existing) {
    return { success: false, error: 'A contact with this phone number already exists.' };
  }

  const id = 'contact_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
  db.runSync(
    'INSERT INTO contacts (id, name, number) VALUES (?, ?, ?);',
    [id, name.trim(), cleanNumber]
  );

  return {
    success: true,
    contact: { id, name: name.trim(), number: cleanNumber },
  };
}

export function updateContact(id: string, name: string, number: string): boolean {
  const db = getDatabase();
  const cleanNumber = number.replace(/[\s\-\(\)]/g, '');
  const result = db.runSync(
    'UPDATE contacts SET name = ?, number = ? WHERE id = ?;',
    [name.trim(), cleanNumber, id]
  );
  return result.changes > 0;
}

export function deleteContact(id: string): boolean {
  const db = getDatabase();
  const result = db.runSync('DELETE FROM contacts WHERE id = ?;', [id]);
  return result.changes > 0;
}

// ==========================================
// Alert History CRUD
// ==========================================

export function saveAlertHistory(item: {
  id: string;
  idempotencyKey?: string;
  status: string;
  message: string;
  latitude?: number;
  longitude?: number;
  mapUrl?: string;
  recipientsCount: number;
  synced?: number | boolean;
}): void {
  const db = getDatabase();
  const isSynced = item.synced ? 1 : 0;
  db.runSync(
    `INSERT OR REPLACE INTO alert_history 
     (id, idempotency_key, status, message, latitude, longitude, map_url, recipients_count, created_at, synced)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now', 'utc'), ?);`,
    [
      item.id,
      item.idempotencyKey || null,
      item.status,
      item.message,
      item.latitude ?? null,
      item.longitude ?? null,
      item.mapUrl ?? null,
      item.recipientsCount,
      isSynced,
    ]
  );
}

export function updateAlertStatus(id: string, status: string, resolvedAt?: string): void {
  const db = getDatabase();
  if (resolvedAt) {
    db.runSync('UPDATE alert_history SET status = ?, resolved_at = ? WHERE id = ?;', [status, resolvedAt, id]);
  } else {
    db.runSync('UPDATE alert_history SET status = ? WHERE id = ?;', [status, id]);
  }
}

export function markAlertSynced(localId: string, backendAlertId: string): void {
  const db = getDatabase();
  db.runSync(
    'UPDATE alert_history SET id = ?, synced = 1 WHERE id = ?;',
    [backendAlertId, localId]
  );
}

export function getAlertHistory(): AlertHistoryItem[] {
  const db = getDatabase();
  return db.getAllSync<AlertHistoryItem>(
    `SELECT id, idempotency_key as idempotencyKey, status, message, latitude, longitude, 
            map_url as mapUrl, recipients_count as recipientsCount, created_at as createdAt, 
            resolved_at as resolvedAt, synced
     FROM alert_history ORDER BY created_at DESC LIMIT 50;`
  );
}

// ==========================================
// Settings Storage
// ==========================================

export function getDbSetting(key: string, defaultValue: string = ''): string {
  const db = getDatabase();
  const row = db.getFirstSync<{ value: string }>('SELECT value FROM app_settings WHERE key = ?;', [key]);
  return row ? row.value : defaultValue;
}

export function setDbSetting(key: string, value: string): void {
  const db = getDatabase();
  db.runSync(
    'INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?);',
    [key, value]
  );
}
