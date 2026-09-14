import { z } from 'zod';
import { COVERAGE_STATES, OUTCOMES, PROGRESS_STATUSES } from './status';

/**
 * Befehle des Beratungsmodus (ADR-002, Architektur 5).
 *
 * Derselbe Handler laeuft im Browser (optimistisch) und auf dem Server
 * (verbindlich). Das ist der eigentliche Gewinn der Trennung: die Logik
 * existiert genau einmal.
 *
 * Jeder Befehl traegt eine vom Client erzeugte Kennung. Der Server schreibt
 * sie in advice_command_log; ein wiederholt gesendeter Befehl wird dadurch
 * ignoriert statt doppelt angewendet - ohne verteilte Transaktionen.
 */

export const commandSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('TOPIC_SET_PROGRESS'),
    topicId: z.uuid(),
    progressStatus: z.enum(PROGRESS_STATUSES),
  }),
  z.object({
    type: z.literal('TOPIC_SET_OUTCOME'),
    topicId: z.uuid(),
    outcome: z.enum(OUTCOMES).nullable(),
  }),
  z.object({
    type: z.literal('TOPIC_SET_COVERAGE'),
    topicId: z.uuid(),
    coverageState: z.enum(COVERAGE_STATES),
  }),
  z.object({
    type: z.literal('TOPIC_SET_PRIORITY'),
    topicId: z.uuid(),
    priority: z.number().int().min(1).max(3).nullable(),
  }),
  z.object({
    type: z.literal('NOTE_UPSERT'),
    noteId: z.uuid(),
    topicId: z.uuid().nullable(),
    visibility: z.enum(['INTERNAL', 'SHARED']),
    body: z.string().max(10_000),
  }),
  z.object({
    type: z.literal('NOTE_DELETE'),
    noteId: z.uuid(),
  }),
]);

export type CommandPayload = z.infer<typeof commandSchema>;
export type CommandType = CommandPayload['type'];

export const envelopeSchema = z.object({
  /** Vom Client erzeugt. Traegt die Idempotenz - nie serverseitig vergeben. */
  id: z.uuid(),
  sessionId: z.uuid(),
  /** Reihenfolge je Beratung. Global waere unnoetig und stoeranfaellig. */
  clientSeq: z.number().int().nonnegative(),
  clientTs: z.number().int().nonnegative(),
  payload: commandSchema,
});

export type Command = z.infer<typeof envelopeSchema>;

export const batchSchema = z.object({
  sessionId: z.uuid(),
  deviceId: z.string().min(8).max(64),
  commands: z.array(envelopeSchema).min(1).max(200),
});

export type CommandBatch = z.infer<typeof batchSchema>;
