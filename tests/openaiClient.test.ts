import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchOpenAIModels, generateOpenAIRenderImage, getEffectiveModel, normalizeBaseUrl, parseModelsResponse } from '../src/lib/utils/openaiClient';

const config = { baseUrl: 'https://provider.example/v1', apiKey: 'test-secret', model: 'custom-image-tool-model' };
const png = 'iVBORw0KGgo=';
const json = (value: unknown) => new Response(JSON.stringify(value), { headers: { 'content-type': 'application/json' } });
afterEach(() => vi.useRealTimers());

describe('direct AI providers', () => {
  it('normalizes absolute endpoints without inventing a v1 path', () => {
    expect(normalizeBaseUrl()).toBe('https://api.openai.com/v1');
    expect(normalizeBaseUrl('  https://provider.example/custom/// ')).toBe('https://provider.example/custom');
    expect(normalizeBaseUrl('http://localhost:8000/')).toBe('http://localhost:8000');
    expect(normalizeBaseUrl('http://127.0.0.1:8000/v1')).toBe('http://127.0.0.1:8000/v1');
    expect(normalizeBaseUrl('http://[::1]:8000/v1')).toBe('http://[::1]:8000/v1');
    expect(getEffectiveModel({})).toBe('gpt-4.1');
    expect(getEffectiveModel({ model: ' custom ' })).toBe('custom');
  });
  it.each(['/api', '//provider.example', 'javascript:alert(1)', 'http://provider.example/v1', 'http://localhost.example/v1', 'https://key@provider.example/v1', 'https://provider.example/v1?key=secret', 'https://provider.example/v1#secret'])('rejects unsafe or ambiguous URL %s', async baseUrl => {
    const fetcher = vi.fn<typeof fetch>();
    await expect(fetchOpenAIModels({ baseUrl }, fetcher)).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('requires the default provider key and rejects image-only Responses models before requesting', async () => {
    const fetcher = vi.fn<typeof fetch>();
    await expect(generateOpenAIRenderImage({}, png, 'prompt', fetcher)).rejects.toThrow('API key');
    await expect(generateOpenAIRenderImage({ apiKey: 'test', model: 'gpt-image-1' }, png, 'prompt', fetcher)).rejects.toThrow('Responses model');
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('sends the scene directly once, with explicit destination, no cookies, no redirects, and no retained response', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(json({ output: [{ type: 'image_generation_call', result: png }] }));
    expect(await generateOpenAIRenderImage(config, png, 'Keep geometry', fetcher)).toBe(`data:image/png;base64,${png}`);
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe('https://provider.example/v1/responses');
    expect(init).toMatchObject({ method: 'POST', credentials: 'omit', referrerPolicy: 'no-referrer', redirect: 'error', cache: 'no-store', headers: { Authorization: 'Bearer test-secret' } });
    expect(JSON.parse(init!.body as string)).toMatchObject({ model: config.model, store: false, input: [{ content: [{ type: 'input_image', image_url: `data:image/png;base64,${png}` }, { type: 'input_text', text: 'Keep geometry' }] }], tools: [{ type: 'image_generation', output_format: 'png' }], tool_choice: { type: 'image_generation' } });
  });
  it('supports keyless local providers without Authorization and lists models independently of the selected model', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(json({ data: [{ id: ' local ' }] }));
    expect(await fetchOpenAIModels({ baseUrl: 'http://localhost:8000/v1', model: 'anything' }, fetcher)).toEqual(['local']);
    expect(fetcher.mock.calls[0][1]!.headers).not.toHaveProperty('Authorization');
  });
  it('parses and deduplicates provider model shapes; rejects malformed lists', () => {
    expect(parseModelsResponse({ data: [{ id: ' b ' }, null, 5, { id: 'a' }, { id: 'a' }, { id: '' }] })).toEqual(['a', 'b']);
    expect(parseModelsResponse(['b', 'a', 'a'])).toEqual(['a', 'b']);
    expect(parseModelsResponse([{ id: 'b' }])).toEqual(['b']);
    expect(parseModelsResponse([])).toEqual([]);
    expect(() => parseModelsResponse({ data: 'wrong' })).toThrow('model list');
  });
  it.each([400, 401, 403, 404, 422, 429, 500])('reports HTTP %s without exposing echoed keys or retrying', async status => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response('test-secret echoed image', { status }));
    await expect(generateOpenAIRenderImage(config, png, 'prompt', fetcher)).rejects.toThrow(`HTTP ${status}`);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it.each([{}, { output: 'wrong' }, { output: [null] }, { output: [{ type: 'message', content: [{ text: 'test-secret' }] }] }, { output: [{ type: 'image_generation_call', result: 'https://provider.example/tracker' }] }])('reports unsupported image responses without trusting provider text: %j', async body => {
    await expect(generateOpenAIRenderImage(config, png, 'prompt', async () => json(body))).rejects.toThrow('No image returned');
  });
  it('reports malformed JSON', async () => {
    await expect(fetchOpenAIModels(config, async () => new Response('<html>bad</html>'))).rejects.toThrow('malformed JSON');
  });
  it('bounds streaming and declared response sizes', async () => {
    const cancel = vi.fn();
    const stream = new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(1024 * 1024 + 1)); }, cancel });
    await expect(fetchOpenAIModels(config, async () => new Response(stream))).rejects.toThrow('too large');
    expect(cancel).toHaveBeenCalledOnce();
    await expect(generateOpenAIRenderImage(config, png, '', async () => new Response('{}', { headers: { 'content-length': String(25 * 1024 * 1024) } }))).rejects.toThrow('too large');
  });
  it('does not fall back to a hosting proxy on CORS/network failure or include the failed URL/key in errors', async () => {
    const fetcher = vi.fn<typeof fetch>().mockRejectedValue(new TypeError('test-secret'));
    await expect(fetchOpenAIModels(config, fetcher)).rejects.toThrow('CORS/local-network permissions');
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0][0]).toBe('https://provider.example/v1/models');
  });
  it('aborts in-flight requests and never retries', async () => {
    const controller = new AbortController();
    const fetcher = vi.fn<typeof fetch>((_, init) => new Promise((_, reject) => init!.signal!.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))));
    const pending = fetchOpenAIModels(config, fetcher, controller.signal);
    const check = expect(pending).rejects.toThrow('cancelled');
    controller.abort(); await check;
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('does not dispatch an already-cancelled request', async () => {
    const controller = new AbortController(); controller.abort();
    const fetcher = vi.fn<typeof fetch>();
    await expect(fetchOpenAIModels(config, fetcher, controller.signal)).rejects.toThrow('cancelled');
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('times out stalled response bodies, not just the initial fetch', async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn<typeof fetch>(async (_, init) => new Response(new ReadableStream({ start(controller) { init!.signal!.addEventListener('abort', () => controller.error(new DOMException('Aborted', 'AbortError'))); } })));
    const check = expect(fetchOpenAIModels(config, fetcher)).rejects.toThrow('timed out');
    await vi.advanceTimersByTimeAsync(30_001); await check;
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
