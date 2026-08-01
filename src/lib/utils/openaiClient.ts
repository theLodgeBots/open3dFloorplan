/**
 * OpenAI API Client module (Network layer)
 * Decoupled from localStorage and DOM.
 * Uses server-side proxy when running in browser to completely prevent CORS errors in DevTools.
 */

export interface OpenAIConfig {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
}

/**
 * Normalizes the Base URL:
 * - Trims whitespace
 * - Strips trailing slashes
 * - Returns default https://api.openai.com/v1 only if empty/blank
 * - Does not append /v1 to custom URLs
 */
export function normalizeBaseUrl(url?: string): string {
  if (!url) return 'https://api.openai.com/v1';
  const trimmed = url.trim().replace(/\/+$/, '');
  return trimmed || 'https://api.openai.com/v1';
}

/**
 * Returns the configured model or defaults to 'gpt-image-1'
 */
export function getEffectiveModel(config: OpenAIConfig): string {
  const m = config.model?.trim();
  return m || 'gpt-image-1';
}

/**
 * Parses response from GET /models:
 * Supports { data: [{ id: string }] }, [{ id: string }], or string[]
 * Filters invalid entries, removes duplicates, and sorts alphabetically.
 */
export function parseModelsResponse(json: unknown): string[] {
  let list: unknown[] = [];
  if (Array.isArray(json)) {
    list = json;
  } else if (json && typeof json === 'object' && json !== null && 'data' in json && Array.isArray((json as any).data)) {
    list = (json as any).data;
  }

  const modelIds = new Set<string>();
  for (const item of list) {
    if (typeof item === 'string' && item.trim()) {
      modelIds.add(item.trim());
    } else if (item && typeof item === 'object' && item !== null && 'id' in item && typeof (item as any).id === 'string') {
      const id = (item as any).id.trim();
      if (id) modelIds.add(id);
    }
  }

  return Array.from(modelIds).sort((a, b) => a.localeCompare(b));
}

/**
 * Universal fetcher that routes browser requests through SvelteKit server proxy (/api/openai-proxy).
 * Server-to-server requests bypass browser CORS completely, preventing red ERR_FAILED console logs.
 */
async function fetchWithProxy(
  endpoint: string,
  init: { method: string; headers: Record<string, string>; body?: any },
  customFetch: typeof fetch = fetch
): Promise<{ ok: boolean; status: number; text: string; json: any }> {
  // If running in browser environment, route through SvelteKit server proxy to guarantee zero CORS console errors
  if (typeof window !== 'undefined') {
    try {
      const proxyRes = await customFetch('/api/openai-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint,
          method: init.method,
          headers: init.headers,
          body: init.body
        })
      });
      const text = await proxyRes.text().catch(() => '');
      let parsedJson = null;
      try { parsedJson = text ? JSON.parse(text) : null; } catch {}
      return { ok: proxyRes.ok, status: proxyRes.status, text, json: parsedJson };
    } catch (proxyErr: any) {
      throw new Error(
        `Failed to connect to endpoint (${endpoint}). Ensure server is running and reachable. ${proxyErr.message || ''}`
      );
    }
  }

  // Direct fetch for node/bun test environment
  const res = await customFetch(endpoint, {
    method: init.method,
    headers: init.headers,
    body: init.body ? JSON.stringify(init.body) : undefined
  });
  const text = await res.text().catch(() => '');
  let parsedJson = null;
  try { parsedJson = text ? JSON.parse(text) : null; } catch {}
  return { ok: res.ok, status: res.status, text, json: parsedJson };
}

/**
 * Fetches available models from GET /models
 */
export async function fetchOpenAIModels(
  config: OpenAIConfig,
  customFetch: typeof fetch = fetch
): Promise<string[]> {
  const baseUrl = normalizeBaseUrl(config.baseUrl);
  const endpoint = `${baseUrl}/models`;

  const headers: Record<string, string> = {};
  if (config.apiKey && config.apiKey.trim()) {
    headers['Authorization'] = `Bearer ${config.apiKey.trim()}`;
  }

  const res = await fetchWithProxy(endpoint, { method: 'GET', headers }, customFetch);

  if (!res.ok) {
    const msg = res.text ? ` — ${res.text}` : '';
    throw new Error(`Failed to fetch models (${res.status}${msg})`);
  }

  if (!res.json) {
    throw new Error('Malformed JSON response from /models endpoint');
  }

  return parseModelsResponse(res.json);
}

/**
 * Executes 3D AI render request using OpenAI /responses API
 */
export async function generateOpenAIRenderImage(
  config: OpenAIConfig,
  base64Image: string,
  prompt: string,
  customFetch: typeof fetch = fetch
): Promise<string> {
  const baseUrl = normalizeBaseUrl(config.baseUrl);
  const model = getEffectiveModel(config);
  const endpoint = `${baseUrl}/responses`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };
  if (config.apiKey && config.apiKey.trim()) {
    headers['Authorization'] = `Bearer ${config.apiKey.trim()}`;
  }

  const requestBody = {
    model,
    input: [
      {
        role: 'user',
        content: [
          { type: 'input_image', image_url: `data:image/png;base64,${base64Image}` },
          { type: 'input_text', text: prompt }
        ]
      }
    ],
    tools: [{ type: 'image_generation', quality: 'high', size: '1536x1024' }]
  };

  const res = await fetchWithProxy(endpoint, { method: 'POST', headers, body: requestBody }, customFetch);

  if (!res.ok) {
    const msg = res.text ? ` — ${res.text}` : '';
    throw new Error(`OpenAI API error: ${res.status}${msg}`);
  }

  const data = res.json;
  if (!data) {
    throw new Error('Malformed JSON response from render endpoint');
  }

  const imageOutput = data.output?.find((o: any) => o.type === 'image_generation_call');
  if (imageOutput?.result) {
    return `data:image/png;base64,${imageOutput.result}`;
  }

  const textOutput = data.output?.find((o: any) => o.type === 'message');
  const msg = textOutput?.content?.[0]?.text || (data.output ? JSON.stringify(data.output) : 'No output');
  throw new Error(`No image returned. Response: ${msg}`);
}
