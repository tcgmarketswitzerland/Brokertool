import type { Command } from '@/domain/advice/commands';
import { acknowledge, deviceId, enqueue, pending } from './outbox';

/**
 * Uebertraegt die Befehle aus dem Ausgangskorb an den Server.
 *
 * Ein Wiederholungsversuch ist der Normalfall, nicht der Ausnahmefall: der
 * Berater sitzt beim Kunden in fremden oder fehlenden Netzen. Deshalb
 * gestaffelte Wartezeiten statt engmaschiger Versuche, die den Akku leeren
 * und nichts verbessern.
 */

export type SyncStatus =
  | { kind: 'idle'; pending: number }
  | { kind: 'syncing'; pending: number }
  | { kind: 'offline'; pending: number }
  | { kind: 'conflict'; reason: 'DEVICE_CONFLICT' | 'SESSION_CLOSED' }
  | { kind: 'error'; pending: number; message: string };

type Listener = (status: SyncStatus) => void;

const BACKOFF_MS = [1_000, 3_000, 8_000, 20_000, 45_000] as const;

export class SyncEngine {
  readonly #sessionId: string;
  readonly #listeners = new Set<Listener>();
  #status: SyncStatus = { kind: 'idle', pending: 0 };
  #attempt = 0;
  #timer: ReturnType<typeof setTimeout> | null = null;
  #running = false;
  #stopped = false;

  constructor(sessionId: string) {
    this.#sessionId = sessionId;
  }

  get status(): SyncStatus {
    return this.#status;
  }

  subscribe(listener: Listener): () => void {
    this.#listeners.add(listener);
    listener(this.#status);
    return () => this.#listeners.delete(listener);
  }

  #emit(status: SyncStatus): void {
    this.#status = status;
    for (const listener of this.#listeners) listener(status);
  }

  start(): void {
    if (typeof window === 'undefined') return;
    window.addEventListener('online', this.#onOnline);
    void this.flush();
  }

  stop(): void {
    this.#stopped = true;
    if (typeof window !== 'undefined') window.removeEventListener('online', this.#onOnline);
    if (this.#timer) clearTimeout(this.#timer);
  }

  readonly #onOnline = (): void => {
    this.#attempt = 0;
    void this.flush();
  };

  /** Befehl erfassen und sofort zu uebertragen versuchen. */
  async submit(command: Command): Promise<void> {
    await enqueue(command);
    await this.flush();
  }

  async flush(): Promise<void> {
    if (this.#running || this.#stopped) return;
    if (this.#status.kind === 'conflict') return;

    this.#running = true;
    try {
      const commands = await pending(this.#sessionId);
      if (commands.length === 0) {
        this.#emit({ kind: 'idle', pending: 0 });
        return;
      }

      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        this.#emit({ kind: 'offline', pending: commands.length });
        return;
      }

      this.#emit({ kind: 'syncing', pending: commands.length });

      // In Haeppchen: eine Uebertragung mit 200 Befehlen scheitert sonst als
      // Ganzes, obwohl die ersten 150 in Ordnung waren.
      const batch = commands.slice(0, 100);
      const response = await fetch('/api/advice/sync', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          sessionId: this.#sessionId,
          deviceId: deviceId(),
          commands: batch,
        }),
      });

      if (response.status === 409) {
        const body = (await response.json().catch(() => ({}))) as { code?: string };
        const reason = body.code === 'SESSION_CLOSED' ? 'SESSION_CLOSED' : 'DEVICE_CONFLICT';
        this.#emit({ kind: 'conflict', reason });
        return;
      }

      if (!response.ok) {
        this.#scheduleRetry(commands.length, `Server antwortete mit ${response.status}`);
        return;
      }

      const result = (await response.json()) as {
        applied: string[];
        rejected: { id: string; reason: string }[];
      };

      // Abgewiesene Befehle ebenfalls entfernen: sie wuerden bei jedem
      // Versuch erneut scheitern und den Korb dauerhaft blockieren.
      await acknowledge([...result.applied, ...result.rejected.map((r) => r.id)]);

      this.#attempt = 0;
      const rest = await pending(this.#sessionId);
      if (rest.length > 0) {
        this.#running = false;
        await this.flush();
        return;
      }
      this.#emit({ kind: 'idle', pending: 0 });
    } catch {
      const rest = await pending(this.#sessionId).catch(() => []);
      this.#scheduleRetry(rest.length, 'Keine Verbindung');
    } finally {
      this.#running = false;
    }
  }

  #scheduleRetry(count: number, message: string): void {
    const delay = BACKOFF_MS[Math.min(this.#attempt, BACKOFF_MS.length - 1)]!;
    this.#attempt += 1;
    this.#emit(
      typeof navigator !== 'undefined' && navigator.onLine === false
        ? { kind: 'offline', pending: count }
        : { kind: 'error', pending: count, message },
    );

    if (this.#timer) clearTimeout(this.#timer);
    this.#timer = setTimeout(() => void this.flush(), delay);
  }
}
