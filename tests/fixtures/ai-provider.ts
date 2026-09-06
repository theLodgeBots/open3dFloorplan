/** Local browser-test provider. Echoes the submitted camera PNG; never calls an AI service. */
import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';

export interface ProviderRequest { path: string; method: string; authorization?: string; body: Record<string, any> }
export function createTestAIProvider(onRequest: (request: ProviderRequest) => void = () => {}) {
  return createServer(async (request, response) => {
    const origin = request.headers.origin;
    if (origin && /^http:\/\/127\.0\.0\.1:\d+$/.test(origin)) response.setHeader('Access-Control-Allow-Origin', origin);
    response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    response.setHeader('Cache-Control', 'no-store');
    if (request.method === 'OPTIONS') { response.writeHead(204); response.end(); return; }
    const path = request.url || '';
    const chunks: Buffer[] = []; let bytes = 0;
    for await (const chunk of request) {
      bytes += chunk.length;
      if (bytes > 8 * 1024 * 1024) { response.writeHead(413); response.end(); return; }
      chunks.push(chunk);
    }
    let body: Record<string, any>;
    try { body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : {}; }
    catch { response.writeHead(400); response.end(); return; }
    onRequest({ path, method: request.method || '', authorization: request.headers.authorization, body });
    const send = (status: number, value: unknown) => { if (!response.destroyed) { response.writeHead(status, { 'Content-Type': 'application/json' }); response.end(JSON.stringify(value)); } };
    if (path.startsWith('/denied/')) { send(401, { error: { message: 'Echoed test credential must not appear in the UI' } }); return; }
    if (path.endsWith('/models')) {
      const result = { data: [{ id: 'echo-scene' }, { id: 'echo-scene' }, { id: 'manual-compatible' }] };
      if (path.startsWith('/slow/')) { const timer = setTimeout(() => send(200, result), 2000); response.on('close', () => clearTimeout(timer)); }
      else send(200, result);
      return;
    }
    if (path.endsWith('/responses') && request.method === 'POST') {
      const image = body.input?.[0]?.content?.find((item: any) => item.type === 'input_image')?.image_url;
      if (body.model === 'no-image') { send(200, { output: [{ type: 'message', content: [{ text: 'Images unsupported' }] }] }); return; }
      if (typeof image !== 'string' || !image.startsWith('data:image/png;base64,')) { send(400, { error: 'Expected a camera PNG' }); return; }
      const result = { output: [{ type: 'image_generation_call', result: image.split(',')[1] }] };
      if (body.model === 'slow-render') { const timer = setTimeout(() => send(200, result), 5000); response.on('close', () => clearTimeout(timer)); }
      else send(200, result);
      return;
    }
    send(404, { error: 'Unknown test endpoint' });
  });
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  createTestAIProvider().listen(4199, '127.0.0.1', () => { console.log('Local test provider listening on 127.0.0.1:4199'); });
}
