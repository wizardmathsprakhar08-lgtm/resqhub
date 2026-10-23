// In-memory mock for expo-sqlite supporting synchronous operations used by ResQHub
const tables: {
  contacts: any[];
  alert_history: any[];
  app_settings: Record<string, string>;
} = {
  contacts: [],
  alert_history: [],
  app_settings: {},
};

class MockDatabase {
  execSync(sql: string) {
    // schema initializations are handled implicitly
  }

  getFirstSync<T = any>(sql: string, params: any[] = []): T | null {
    if (sql.includes('COUNT(*) as count FROM contacts')) {
      return { count: tables.contacts.length } as any;
    }
    if (sql.includes('FROM contacts WHERE')) {
      const cleanNum = params[0];
      const found = tables.contacts.find((c) => c.number.replace(/[\s\-\(\)]/g, '') === cleanNum);
      return (found || null) as any;
    }
    if (sql.includes('FROM app_settings WHERE key = ?')) {
      const key = params[0];
      const val = tables.app_settings[key];
      return (val !== undefined ? { value: val } : null) as any;
    }
    return null;
  }

  getAllSync<T = any>(sql: string, params: any[] = []): T[] {
    if (sql.includes('FROM contacts')) {
      return [...tables.contacts] as any;
    }
    if (sql.includes('FROM alert_history')) {
      return [...tables.alert_history] as any;
    }
    return [];
  }

  runSync(sql: string, params: any[] = []): { changes: number; lastInsertRowId: number } {
    if (sql.includes('INSERT INTO contacts')) {
      const [id, name, number] = params;
      tables.contacts.push({ id, name, number, created_at: new Date().toISOString() });
      return { changes: 1, lastInsertRowId: tables.contacts.length };
    }
    if (sql.includes('UPDATE contacts SET name = ?, number = ? WHERE id = ?')) {
      const [name, number, id] = params;
      const idx = tables.contacts.findIndex((c) => c.id === id);
      if (idx >= 0) {
        tables.contacts[idx].name = name;
        tables.contacts[idx].number = number;
        return { changes: 1, lastInsertRowId: idx + 1 };
      }
      return { changes: 0, lastInsertRowId: 0 };
    }
    if (sql.includes('DELETE FROM contacts WHERE id = ?')) {
      const [id] = params;
      const initial = tables.contacts.length;
      tables.contacts = tables.contacts.filter((c) => c.id !== id);
      return { changes: initial - tables.contacts.length, lastInsertRowId: 0 };
    }
    if (sql.includes('INSERT INTO alert_history') || sql.includes('INSERT OR REPLACE INTO alert_history')) {
      tables.alert_history.push({ id: params[0] });
      return { changes: 1, lastInsertRowId: tables.alert_history.length };
    }
    if (sql.includes('INSERT OR REPLACE INTO app_settings')) {
      const [key, value] = params;
      tables.app_settings[key] = value;
      return { changes: 1, lastInsertRowId: 1 };
    }
    return { changes: 1, lastInsertRowId: 1 };
  }
}

export function openDatabaseSync(dbName: string) {
  return new MockDatabase();
}
