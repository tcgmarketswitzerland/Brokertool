import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logger, safeId } from '@/lib/logger';
import { batchSchema, type Command } from '@/domain/advice/commands';

/**
 * Endpunkt der Command-Pipeline (ADR-002, Architektur 5).
 *
 * Route Handler und nicht Server Action: hier braucht es echtes HTTP -
 * Wiederholung nach Netzabbruch, Buendelung mehrerer Befehle, klare
 * Statuscodes. Eine Server Action gibt davon nichts her.
 *
 * Node-Runtime, nicht Edge: der Zugriff laeuft ueber die Datenbank mit
 * Personendaten, und die Verarbeitung soll in Frankfurt bleiben (ADR-005).
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Applied = { applied: string[]; rejected: { id: string; reason: string }[] };

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Ungültige Anfrage' }, { status: 400 });
  }

  const parsed = batchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Ungültige Befehle' }, { status: 422 });
  }
  const { sessionId, deviceId, commands } = parsed.data;

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 });
  }

  // RLS entscheidet, ob die Beratung sichtbar ist. Ein zusaetzlicher Filter
  // auf die Organisation waere Sicherheitstheater.
  const { data: session } = await supabase
    .from('advice_sessions')
    .select('id, status, active_device_id, last_client_seq')
    .eq('id', sessionId)
    .maybeSingle();

  if (!session) {
    return NextResponse.json({ error: 'Beratung nicht gefunden' }, { status: 404 });
  }

  if (session.status === 'COMPLETED' || session.status === 'CANCELLED') {
    // Eine abgeschlossene Beratung ist unveraenderlich. Der Client soll das
    // erfahren und seine Outbox leeren, statt endlos zu wiederholen.
    return NextResponse.json(
      { error: 'Beratung ist abgeschlossen', code: 'SESSION_CLOSED' },
      { status: 409 },
    );
  }

  const activeDevice = session.active_device_id as string | null;
  if (activeDevice && activeDevice !== deviceId) {
    // Zweites Geraet an derselben Beratung. Eine echte Konfliktaufloesung
    // waere hier ueberdimensioniert; der Nutzer entscheidet ausdruecklich,
    // wer weiterschreibt (ADR-002).
    return NextResponse.json(
      { error: 'Diese Beratung ist auf einem anderen Gerät geöffnet', code: 'DEVICE_CONFLICT' },
      { status: 409 },
    );
  }

  const result = await applyCommands(supabase, sessionId, commands, auth.user.id);

  await supabase
    .from('advice_sessions')
    .update({
      active_device_id: deviceId,
      active_device_seen_at: new Date().toISOString(),
      last_client_seq: Math.max(
        Number(session.last_client_seq ?? 0),
        ...commands.map((c) => c.clientSeq),
      ),
    })
    .eq('id', sessionId);

  logger.info('advice_sync', {
    session: safeId(sessionId),
    applied: result.applied.length,
    rejected: result.rejected.length,
  });

  return NextResponse.json(result satisfies Applied);
}

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

async function applyCommands(
  supabase: SupabaseClient,
  sessionId: string,
  commands: readonly Command[],
  userId: string,
): Promise<Applied> {
  const applied: string[] = [];
  const rejected: { id: string; reason: string }[] = [];

  // Reihenfolge je Beratung: aeltere Befehle zuerst, sonst gewinnt ein
  // verspaetet eingetroffener alter Befehl ueber einen neueren.
  const ordered = [...commands].sort((a, b) => a.clientSeq - b.clientSeq);

  for (const command of ordered) {
    // Idempotenz: gelingt der Eintrag nicht, wurde der Befehl schon
    // angewendet. Kein Fehler, sondern der Normalfall nach einer
    // Wiederholung.
    const { data: logged, error: logError } = await supabase
      .from('advice_command_log')
      .insert({
        id: command.id,
        session_id: sessionId,
        command_type: command.payload.type,
        client_seq: command.clientSeq,
        applied_by: userId,
      })
      .select('id')
      .maybeSingle();

    if (logError) {
      if (logError.code === '23505') { applied.push(command.id); continue; }
      rejected.push({ id: command.id, reason: 'Konnte nicht protokolliert werden' });
      continue;
    }
    if (!logged) { applied.push(command.id); continue; }

    const error = await persist(supabase, sessionId, command, userId);
    if (error) rejected.push({ id: command.id, reason: error });
    else applied.push(command.id);
  }

  return { applied, rejected };
}

async function persist(
  supabase: SupabaseClient,
  sessionId: string,
  command: Command,
  userId: string,
): Promise<string | null> {
  const p = command.payload;

  switch (p.type) {
    case 'TOPIC_SET_PROGRESS': {
      const { error } = await supabase
        .from('advice_session_topics')
        .update({
          progress_status: p.progressStatus,
          discussed_at: p.progressStatus === 'DISCUSSED' ? new Date().toISOString() : null,
          // Wer zurueckstuft, verliert das Ergebnis - dieselbe Regel wie in
          // der Domaene.
          ...(p.progressStatus === 'DISCUSSED' ? {} : { outcome: null }),
        })
        .eq('session_id', sessionId)
        .eq('topic_id', p.topicId);
      return error ? error.message : null;
    }

    case 'TOPIC_SET_OUTCOME': {
      const { error } = await supabase
        .from('advice_session_topics')
        .update(
          p.outcome === null
            ? { outcome: null }
            : {
                outcome: p.outcome,
                progress_status: 'DISCUSSED',
                discussed_at: new Date().toISOString(),
              },
        )
        .eq('session_id', sessionId)
        .eq('topic_id', p.topicId);
      return error ? error.message : null;
    }

    case 'TOPIC_SET_COVERAGE': {
      const { error } = await supabase
        .from('advice_session_topics')
        .update({ coverage_state: p.coverageState })
        .eq('session_id', sessionId).eq('topic_id', p.topicId);
      return error ? error.message : null;
    }

    case 'TOPIC_SET_PRIORITY': {
      const { error } = await supabase
        .from('advice_session_topics')
        .update({ priority: p.priority })
        .eq('session_id', sessionId).eq('topic_id', p.topicId);
      return error ? error.message : null;
    }

    case 'NOTE_UPSERT': {
      let sessionTopicId: string | null = null;
      if (p.topicId) {
        const { data } = await supabase
          .from('advice_session_topics')
          .select('id')
          .eq('session_id', sessionId).eq('topic_id', p.topicId)
          .maybeSingle();
        sessionTopicId = data ? String(data.id) : null;
      }

      const { error } = await supabase.from('notes').upsert({
        id: p.noteId,
        // Genau ein Bezug je Notiz: haengt sie an einer Sparte, dann nicht
        // zusaetzlich an der Beratung.
        session_id: sessionTopicId ? null : sessionId,
        session_topic_id: sessionTopicId,
        visibility: p.visibility,
        body: p.body,
        created_by: userId,
        updated_by: userId,
      });
      return error ? error.message : null;
    }

    case 'NOTE_DELETE': {
      const { error } = await supabase.from('notes').delete().eq('id', p.noteId);
      return error ? error.message : null;
    }
  }
}
