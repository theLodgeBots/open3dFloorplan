import { GoogleAuth } from 'google-auth-library';
import { parseQuotaState, type QuotaSnapshot, type QuotaState, type QuotaStore } from './handoffQuota';

const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/devstorage.read_write'] });
const ledgerName = '_system/handoff-admission-v1';

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
    const token = await this.accessToken();
    if (!token) throw new Error('Handoff service credentials unavailable');
    const headers = new Headers(init.headers);
    headers.set('Authorization', `Bearer ${token}`);
    return this.request(url, { ...init, headers, signal: AbortSignal.timeout(5000) });
  }

  async read(): Promise<QuotaSnapshot | null> {
    const response = await this.send(`${this.bucketUrl}/${encodeURIComponent(ledgerName)}?fields=generation,metageneration,metadata`);
    if (response.status === 404) { await response.body?.cancel(); return null; }
    if (!response.ok) { await response.body?.cancel(); throw new Error('Could not read handoff quota'); }
    const data = await response.json();
    if (!/^\d+$/.test(data.generation) || !/^\d+$/.test(data.metageneration)) throw new Error('Invalid quota preconditions');
    return { state: parseQuotaState(JSON.parse(data.metadata?.quota)), generation: data.generation, metageneration: data.metageneration };
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
    if (!response.ok) throw new Error('Could not reserve handoff quota');
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
    if (!response.ok) throw new Error('Could not store handoff');
    return true;
  }
}
