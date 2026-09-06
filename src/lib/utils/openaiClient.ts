/** Browser-to-provider transport. Never retry paid requests or route through our hosting. */
export interface OpenAIConfig {
  apiKey?: string | null;
  baseUrl?: string;
  model?: string;
}

export const DEFAULT_OPENAI_BASE_URL = 'https://api.openai.com/v1';
// Responses needs a text model to call image_generation, not a GPT Image model.
export const DEFAULT_OPENAI_MODEL = 'gpt-4.1';
export const OPENAI_MODEL_SUGGESTIONS = ['gpt-4.1', 'gpt-4.1-mini', 'gpt-5.2'];

export function normalizeBaseUrl(value?: string): string {
  const input = value?.trim() || DEFAULT_OPENAI_BASE_URL;
  let url: URL;
  try { url = new URL(input); } catch { throw new Error('Enter an absolute provider URL, such as https://api.openai.com/v1.'); }
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback)) {
    throw new Error('Use HTTPS for remote providers. HTTP is allowed only for localhost, 127.0.0.1, or [::1].');
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error('The provider URL must not contain credentials, a query, or a fragment. Enter the key separately.');
  }
  return url.href.replace(/\/+$/, '');
}

export function getEffectiveModel(config: OpenAIConfig): string {
  return config.model?.trim() || DEFAULT_OPENAI_MODEL;
}

export function validateOpenAIConfig(config: OpenAIConfig): string {
  const baseUrl = normalizeBaseUrl(config.baseUrl);
  if (typeof window !== 'undefined' && new URL(baseUrl).origin === window.location.origin) {
    throw new Error('Choose your AI provider URL. This app does not host an AI proxy.');
  }
  if (new URL(baseUrl).hostname === 'api.openai.com' && !config.apiKey?.trim()) {
    throw new Error('Add your OpenAI API key in Settings → AI first. Custom providers can be used without a key.');
  }
  if (new URL(baseUrl).hostname === 'api.openai.com' && /^(gpt-image-|chatgpt-image-|dall-e-)/.test(getEffectiveModel(config))) {
    throw new Error('Choose a Responses model such as gpt-4.1. GPT Image and DALL·E models cannot be used as the Responses model.');
  }
  return baseUrl;
}

export function parseModelsResponse(json: unknown): string[] {
  const list = Array.isArray(json) ? json : isRecord(json) && Array.isArray(json.data) ? json.data : null;
  if (!list) throw new Error('The provider returned an unsupported model list. Enter a model ID manually.');
  const ids = list.map(item => typeof item === 'string' ? item : isRecord(item) ? item.id : null)
    .filter((id): id is string => typeof id === 'string' && !!id.trim() && id.length <= 256)
    .map(id => id.trim());
  return [...new Set(ids)].sort((a, b) => a.localeCompare(b));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

async function readJSON(response: Response, maxBytes: number): Promise<unknown> {
  if (Number(response.headers.get('content-length')) > maxBytes) {
    await response.body?.cancel();
    throw new Error('The provider response is too large. Try a smaller output.');
  }
  const reader = response.body?.getReader();
  if (!reader) throw new Error('The provider returned an empty response.');
  const decoder = new TextDecoder();
  let text = '', bytes = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBytes) {
        await reader.cancel();
        throw new Error('The provider response is too large. Try a smaller output.');
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
  } finally { reader.releaseLock(); }
  try { return JSON.parse(text); } catch { throw new Error('The provider returned malformed JSON. Check its API compatibility.'); }
}

async function request(
  config: OpenAIConfig, path: 'models' | 'responses', body: unknown,
  customFetch: typeof fetch, signal?: AbortSignal
): Promise<unknown> {
  const baseUrl = validateOpenAIConfig(config);
  const controller = new AbortController();
  const abort = () => controller.abort();
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, path === 'models' ? 30_000 : 180_000);
  signal?.addEventListener('abort', abort, { once: true });
  if (signal?.aborted) abort();
  try {
    controller.signal.throwIfAborted();
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (body) headers['Content-Type'] = 'application/json';
    if (config.apiKey?.trim()) headers.Authorization = `Bearer ${config.apiKey.trim()}`;
    const response = await customFetch(`${baseUrl}/${path}`, {
      method: body ? 'POST' : 'GET', headers, body: body ? JSON.stringify(body) : undefined,
      credentials: 'omit', referrerPolicy: 'no-referrer', redirect: 'error', cache: 'no-store',
      signal: controller.signal,
    });
    if (!response.ok) {
      // Do not echo arbitrary provider bodies: they can include keys or the submitted image.
      await response.body?.cancel();
      const hint = response.status === 401 || response.status === 403 ? 'Check the provider key and account access.'
        : response.status === 429 ? 'The provider rate or spending limit was reached. Try again later.'
        : response.status === 400 || response.status === 404 || response.status === 422
          ? 'Check the base URL and model. Rendering requires POST /responses with the image_generation tool.'
          : 'Check the provider status and try again.';
      throw new Error(`Provider request failed (HTTP ${response.status}). ${hint}`);
    }
    return await readJSON(response, path === 'models' ? 1024 * 1024 : 24 * 1024 * 1024);
  } catch (error) {
    if (timedOut) throw new Error('The provider request timed out. It was not retried; check the provider before generating again.');
    if (signal?.aborted) throw new Error('Request cancelled. The provider may still finish and charge for work already started.');
    if (error instanceof TypeError) {
      throw new Error('Cannot connect directly to the provider. Check its URL, HTTPS and browser CORS/local-network permissions. No proxy or automatic retry was used.');
    }
    throw error;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
  }
}

export async function fetchOpenAIModels(config: OpenAIConfig, customFetch: typeof fetch = fetch, signal?: AbortSignal): Promise<string[]> {
  // Model discovery must remain available even when the currently typed model is incompatible.
  return parseModelsResponse(await request({ ...config, model: DEFAULT_OPENAI_MODEL }, 'models', undefined, customFetch, signal));
}

export async function generateOpenAIRenderImage(
  config: OpenAIConfig, base64Image: string, prompt: string,
  customFetch: typeof fetch = fetch, signal?: AbortSignal
): Promise<string> {
  const data = await request(config, 'responses', {
    model: getEffectiveModel(config), store: false,
    input: [{ role: 'user', content: [
      { type: 'input_image', image_url: `data:image/png;base64,${base64Image}` },
      { type: 'input_text', text: prompt },
    ] }],
    tools: [{ type: 'image_generation', quality: 'high', size: '1536x1024', output_format: 'png' }],
    tool_choice: { type: 'image_generation' },
  }, customFetch, signal);
  const output = isRecord(data) && Array.isArray(data.output) ? data.output : [];
  const image = output.find(item => isRecord(item) && item.type === 'image_generation_call' && typeof item.result === 'string' && item.result);
  if (image && typeof image.result === 'string' && /^[A-Za-z0-9+/]+={0,2}$/.test(image.result)) {
    return `data:image/png;base64,${image.result}`;
  }
  throw new Error('No image returned. This provider and model must support POST /responses with the image_generation tool. Try another model.');
}
