import { GoogleAuth } from 'google-auth-library';
import { parseQuotaState, type QuotaSnapshot, type QuotaState, type QuotaStore } from './handoffQuota';

// objects.patch requires full_control even for custom metadata only. The
// read_write scope permits the first insert, but rejects subsequent ledger CAS.
// IAM still limits this token to the existing runtime identity's permissions.
const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/devstorage.full_control'] });
const ledgerName = '_system/handoff-admission-v1';

export class HandoffStorageFailure extends Error {
  constructor(public operation: 'credentials' | 'network' | 'ledger-read' | 'ledger-format' | 'ledger-write' | 'object-create', public status?: number) {
    super(`Handoff storage failure: ${operation}`);
  }
}

/** Existing bucket + a zero-byte metadata ledger; no database, function or keys.
 * Metadata updates advance metageneration, without creating new data generations.
 */
export class HandoffStorage implements QuotaStore {
  private bucketUrl: string;
  constructor(bucket: string, private accessToken = () => auth.getAccessToken(), private request = fetch) {
    if (!/^[a-z0-9][a-z0-9._-]{1,220}[a-z0-9]$/.test(bucket)) throw new Error('Invalid handoff bucket');
    this.bucketUrl = `https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(bucket)}/o`;
  }

  private async send(url: string, init: RequestInit = {}) {
    let token;
    try { token = await this.accessToken(); }
    catch { throw new HandoffStorageFailure('credentials'); }
    if (!token) throw new HandoffStorageFailure('credentials');
    const headers = new Headers(init.headers);
    headers.set('Authorization', `Bearer ${token}`);
    try { return await this.request(url, { ...init, headers, signal: AbortSignal.timeout(5000) }); }
    catch { throw new HandoffStorageFailure('network'); }
  }

  async read(): Promise<QuotaSnapshot | null> {
    const response = await this.send(`${this.bucketUrl}/${encodeURIComponent(ledgerName)}?fields=generation,metageneration,metadata`);
    if (response.status === 404) { await response.body?.cancel(); return null; }
    if (!response.ok) { await response.body?.cancel(); throw new HandoffStorageFailure('ledger-read', response.status); }
    try {
      const data = await response.json();
      if (!/^\d+$/.test(data.generation) || !/^\d+$/.test(data.metageneration)) throw new Error('Invalid quota preconditions');
      return { state: parseQuotaState(JSON.parse(data.metadata?.quota)), generation: data.generation, metageneration: data.metageneration };
    } catch { throw new HandoffStorageFailure('ledger-format'); }
  }

  async write(previous: QuotaSnapshot | null, state: QuotaState): Promise<boolean> {
    if (!previous) return this.create(ledgerName, new Uint8Array(), { quota: JSON.stringify(state) });
    const query = new URLSearchParams({ ifGenerationMatch: previous.generation, ifMetagenerationMatch: previous.metageneration });
    const response = await this.send(`${this.bucketUrl}/${encodeURIComponent(ledgerName)}?${query}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ metadata: { quota: JSON.stringify(state) } }),
    });
    await response.body?.cancel();
    if (response.status === 412) return false;
    if (!response.ok) throw new HandoffStorageFailure('ledger-write', response.status);
    return true;
  }

  async create(name: string, bytes: Uint8Array, metadata: Record<string, string> = {}): Promise<boolean> {
    const boundary = 'openplan-handoff-' + crypto.randomUUID();
    const info = { name, contentType: 'application/json', cacheControl: 'private, no-store', metadata };
    const body = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(info)}\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n`),
      Buffer.from(bytes), Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);
    const url = this.bucketUrl.replace('/storage/v1/', '/upload/storage/v1/') + '?uploadType=multipart&ifGenerationMatch=0';
    const response = await this.send(url, { method: 'POST', headers: { 'Content-Type': `multipart/related; boundary=${boundary}` }, body });
    await response.body?.cancel();
    if (response.status === 409 || response.status === 412) return false;
    if (!response.ok) throw new HandoffStorageFailure('object-create', response.status);
    return true;
  }
}
