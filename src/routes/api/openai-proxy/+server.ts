import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/**
 * Server-side proxy for OpenAI-compatible endpoints.
 * Prevents browser CORS blocks when fetching local AI endpoints (e.g. LM Studio, Ollama, LocalAI).
 */
export const POST: RequestHandler = async ({ request }) => {
  try {
    const payload = await request.json().catch(() => null);
    if (!payload || typeof payload !== 'object') {
      return json({ error: 'Invalid proxy request payload' }, { status: 400 });
    }

    const { endpoint, method = 'GET', headers = {}, body } = payload;

    if (!endpoint || typeof endpoint !== 'string' || !/^https?:\/\//i.test(endpoint)) {
      return json({ error: 'Invalid or unsupported target endpoint URL' }, { status: 400 });
    }

    const fetchHeaders: Record<string, string> = {};
    if (headers && typeof headers === 'object') {
      for (const [k, v] of Object.entries(headers)) {
        if (typeof v === 'string') {
          fetchHeaders[k] = v;
        }
      }
    }

    const response = await fetch(endpoint, {
      method: typeof method === 'string' ? method.toUpperCase() : 'GET',
      headers: fetchHeaders,
      body: body ? JSON.stringify(body) : undefined
    });

    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const data = await response.json().catch(() => ({}));
      return json(data, { status: response.status });
    } else {
      const text = await response.text().catch(() => '');
      return new Response(text, {
        status: response.status,
        headers: { 'content-type': contentType || 'text/plain' }
      });
    }
  } catch (err: any) {
    return json(
      { error: `Proxy connection error: ${err.message || 'Server unreachable'}` },
      { status: 502 }
    );
  }
};
