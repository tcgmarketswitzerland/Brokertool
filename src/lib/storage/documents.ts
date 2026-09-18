import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { logger, safeId } from '@/lib/logger';
import { EXTENSION } from '@/domain/document/sniff';

/**
 * Ablage der Kundendokumente.
 *
 * Der Bucket ist privat; Dateien werden nie direkt ausgeliefert, sondern
 * nur ueber eine kurzlebige signierte URL. Die Zugriffspruefung findet
 * vorher statt - in der Route, ueber RLS auf der Tabelle `documents`.
 * Erst wenn die Datenbank das Dokument herausgibt, wird die Datei geholt.
 *
 * Warum nicht mit Storage-Richtlinien? Die setzen Eigentum an
 * storage.objects voraus. In einem Supabase-Projekt gehoert diese Tabelle
 * supabase_storage_admin, und `create policy` scheitert mit
 * "must be owner of table objects".
 */

export const DOCUMENT_BUCKET = 'kundendokumente';

/** Deckungsgleich mit der Pruefung auf documents.size_bytes. */
export const MAX_BYTES = 20 * 1024 * 1024;

let bucketReady = false;

async function ensureBucket(userId: string): Promise<void> {
  if (bucketReady) return;
  const admin = createAdminClient('document:storage', userId);
  const { error } = await admin.storage.createBucket(DOCUMENT_BUCKET, {
    public: false,
    fileSizeLimit: MAX_BYTES,
    allowedMimeTypes: Object.keys(EXTENSION),
  });
  // "existiert bereits" ist der Normalfall ab dem zweiten Upload.
  if (error && !/exist/i.test(error.message)) {
    logger.warn('document_bucket_failed', { reason: safeId(error.message.slice(0, 40)) });
    throw new Error('Ablage nicht verfügbar');
  }
  bucketReady = true;
}

/**
 * Pfad innerhalb des Buckets.
 *
 * Die Organisation steht vorne, damit eine falsch gesetzte Richtlinie
 * spaeter nicht versehentlich ueber Mandanten hinweg greift, und der
 * Dateiname ist eine UUID: der Originalname steht in der Datenbank und
 * koennte sonst Pfadangaben enthalten.
 */
export function documentPath(
  organizationId: string, customerId: string, id: string, extension: string,
): string {
  return `${organizationId}/${customerId}/${id}.${extension}`;
}

export async function putDocument(
  path: string, body: ArrayBuffer, contentType: string, userId: string,
): Promise<boolean> {
  await ensureBucket(userId);
  const admin = createAdminClient('document:storage', userId);
  const { error } = await admin.storage
    .from(DOCUMENT_BUCKET)
    .upload(path, body, { contentType, upsert: false });

  if (error) {
    logger.warn('document_upload_failed', { reason: safeId(error.message.slice(0, 40)) });
    return false;
  }
  return true;
}

/** Kurzlebig: die URL wird sofort weitergereicht, nicht gespeichert. */
export async function signedDocumentUrl(path: string, userId: string): Promise<string | null> {
  const admin = createAdminClient('document:storage', userId);
  const { data, error } = await admin.storage
    .from(DOCUMENT_BUCKET)
    .createSignedUrl(path, 60);
  if (error || !data) return null;
  return data.signedUrl;
}

export async function removeDocument(path: string, userId: string): Promise<void> {
  const admin = createAdminClient('document:storage', userId);
  await admin.storage.from(DOCUMENT_BUCKET).remove([path]);
}
