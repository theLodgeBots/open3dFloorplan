import { env } from '$env/dynamic/private';
import { json } from '@sveltejs/kit';
import { HandoffError } from '$lib/server/handoffQuota';
import { HandoffStorage } from '$lib/server/handoffStorage';
import { uploadHandoff } from '$lib/server/handoffUpload';

let storage: HandoffStorage | undefined;
let minute = -1, requests = 0;

export async function POST({ request }: { request: Request }) {
  const headers: Record<string, string> = { 'Cache-Control': 'no-store' };
  try {
    if (env.HANDOFF_UPLOADS_ENABLED !== 'true' || !env.HANDOFF_BUCKET) {
      throw new HandoffError(503, 'Link sharing is unavailable. Use Export Editable Plan (JSON) instead.');
    }
    // Cheap process-local guard protects parsing and quota-ledger requests.
    // Durable admission limits below remain authoritative across all instances.
    const currentMinute = Math.floor(Date.now() / 60_000);
    if (minute !== currentMinute) { minute = currentMinute; requests = 0; }
    if (++requests > 30) throw new HandoffError(429, 'Link sharing is busy. Use Export Editable Plan (JSON), or try again later.', 60);
    storage ??= new HandoffStorage(env.HANDOFF_BUCKET);
    return json(await uploadHandoff(request, storage), { status: 201, headers });
  } catch (error) {
    const known = error instanceof HandoffError;
    if (known && error.retryAfter) headers['Retry-After'] = String(error.retryAfter);
    // Never log capture bodies, tokens or sharing codes; storage failures fail closed.
    return json({ error: known ? error.message : 'Link sharing is temporarily unavailable. Use Export Editable Plan (JSON) instead.' }, { status: known ? error.status : 503, headers });
  }
}
