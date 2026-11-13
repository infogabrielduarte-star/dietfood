// Persistência local em SQLite (arquivo dietfood.db dentro do app no celular).
// Cada documento é guardado como JSON: 'core' (alimentos, refeições, metas)
// e 'day:AAAA-MM-DD' (registros de consumo de cada dia).

import * as SQLite from 'expo-sqlite';

let dbPromise = null;

function getDb() {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync('dietfood.db');
      await db.execAsync(
        'PRAGMA journal_mode = WAL; CREATE TABLE IF NOT EXISTS docs (id TEXT PRIMARY KEY NOT NULL, body TEXT NOT NULL, updated_at INTEGER NOT NULL);',
      );
      return db;
    })();
    dbPromise.catch(() => { dbPromise = null; });
  }
  return dbPromise;
}

/** Lê tudo do banco: { core | null, days: { data: dia } }. */
export async function loadAll() {
  const db = await getDb();
  const rows = await db.getAllAsync('SELECT id, body FROM docs');
  let core = null;
  const days = {};
  for (const row of rows) {
    const body = JSON.parse(row.body);
    if (row.id === 'core') core = body;
    else if (row.id.startsWith('day:')) days[row.id.slice(4)] = body;
  }
  return { core, days };
}

// Gravações em fila, uma de cada vez e na ordem em que aconteceram.
let chain = Promise.resolve();

/** docs: [{ id, body }] — body null apaga o documento. */
export function writeDocs(docs) {
  const run = async () => {
    const db = await getDb();
    const now = Date.now();
    await db.withTransactionAsync(async () => {
      for (const d of docs) {
        if (d.body == null) {
          await db.runAsync('DELETE FROM docs WHERE id = ?', [d.id]);
        } else {
          await db.runAsync(
            'INSERT OR REPLACE INTO docs (id, body, updated_at) VALUES (?, ?, ?)',
            [d.id, JSON.stringify(d.body), now],
          );
        }
      }
    });
  };
  const p = chain.then(run);
  chain = p.catch(() => {});
  return p;
}

/** Substitui todo o conteúdo do banco (importação ou "apagar tudo"). */
export function replaceAll(docs) {
  const run = async () => {
    const db = await getDb();
    const now = Date.now();
    await db.withTransactionAsync(async () => {
      await db.runAsync('DELETE FROM docs', []);
      for (const d of docs) {
        await db.runAsync(
          'INSERT OR REPLACE INTO docs (id, body, updated_at) VALUES (?, ?, ?)',
          [d.id, JSON.stringify(d.body), now],
        );
      }
    });
  };
  const p = chain.then(run);
  chain = p.catch(() => {});
  return p;
}
