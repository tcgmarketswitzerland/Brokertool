import type { Command } from '@/domain/advice/commands';

/**
 * Ausgangskorb der Beratungsbefehle (ADR-002).
 *
 * IndexedDB statt localStorage: der Inhalt ueberlebt einen Tab-Absturz und
 * einen Neustart des Geraets, und es gibt einen echten Index fuer die
 * Reihenfolge. Gespeichert wird ausschliesslich die laufende Beratung -
 * nie die Kundendatenbank -, und beim Abmelden wird alles geloescht.
 *
 * Das ist die bewusste Abweichung von Konzeptpunkt 22: ohne lokale
 * Sicherung verbrennt ein Netzabbruch mitten im Gespraech zwanzig Minuten
 * Arbeit vor dem Kunden, und dieser Vorfall passiert pro Konto genau
 * einmal.
 */

const DB_NAME = 'brokertool-outbox';
const DB_VERSION = 1;
const STORE = 'commands';

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' });
        store.createIndex('bySession', ['sessionId', 'clientSeq']);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB nicht verfügbar'));
  });
  return dbPromise;
}

function tx<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(STORE, mode);
        const request = fn(transaction.objectStore(STORE));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error('Speichern fehlgeschlagen'));
      }),
  );
}

export async function enqueue(command: Command): Promise<void> {
  await tx('readwrite', (store) => store.put(command));
}

export async function pending(sessionId: string): Promise<Command[]> {
  const all = await tx<Command[]>('readonly', (store) => store.getAll() as IDBRequest<Command[]>);
  return all
    .filter((c) => c.sessionId === sessionId)
    .sort((a, b) => a.clientSeq - b.clientSeq);
}

export async function acknowledge(ids: readonly string[]): Promise<void> {
  if (ids.length === 0) return;
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE, 'readwrite');
    const store = transaction.objectStore(STORE);
    for (const id of ids) store.delete(id);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('Bereinigen fehlgeschlagen'));
  });
}

/** Beim Abmelden und nach dem Abschluss einer Beratung. */
export async function clearSession(sessionId: string): Promise<void> {
  const commands = await pending(sessionId);
  await acknowledge(commands.map((c) => c.id));
}

export async function clearAll(): Promise<void> {
  await tx('readwrite', (store) => store.clear());
}

/** Eindeutige Kennung dieses Geraets, fuer die Konflikterkennung. */
const DEVICE_KEY = 'brokertool.device';

export function deviceId(): string {
  try {
    const existing = localStorage.getItem(DEVICE_KEY);
    if (existing && existing.length >= 8) return existing;
    const fresh = crypto.randomUUID();
    localStorage.setItem(DEVICE_KEY, fresh);
    return fresh;
  } catch {
    // Ohne Speicher gilt das Geraet als neu. Die Konflikterkennung wird
    // dadurch strenger, nie laxer.
    return crypto.randomUUID();
  }
}
