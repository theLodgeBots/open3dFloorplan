import { describe, it, expect } from 'bun:test';
import {
  normalizeBaseUrl,
  getEffectiveModel,
  parseModelsResponse,
  fetchOpenAIModels,
  generateOpenAIRenderImage
} from './openaiClient';

describe('OpenAI Client Unit Tests', () => {

  describe('1. Base URL Normalization', () => {
    it('returns default https://api.openai.com/v1 when empty or undefined', () => {
      expect(normalizeBaseUrl('')).toBe('https://api.openai.com/v1');
      expect(normalizeBaseUrl(undefined)).toBe('https://api.openai.com/v1');
      expect(normalizeBaseUrl('   ')).toBe('https://api.openai.com/v1');
    });

    it('strips spaces and multiple trailing slashes without adding /v1 to custom URLs', () => {
      expect(normalizeBaseUrl('  https://my-custom-llm.com/v1///  ')).toBe('https://my-custom-llm.com/v1');
      expect(normalizeBaseUrl('http://localhost:11434/v1/')).toBe('http://localhost:11434/v1');
      expect(normalizeBaseUrl('https://openrouter.ai/api/v1//')).toBe('https://openrouter.ai/api/v1');
      expect(normalizeBaseUrl('https://my-local-server:8080')).toBe('https://my-local-server:8080');
    });
  });

  describe('2. Effective Model Resolution', () => {
    it('defaults to gpt-image-1 when model is empty or undefined', () => {
      expect(getEffectiveModel({})).toBe('gpt-image-1');
      expect(getEffectiveModel({ model: '   ' })).toBe('gpt-image-1');
    });

    it('returns trimmed model string when specified', () => {
      expect(getEffectiveModel({ model: '  dall-e-3  ' })).toBe('dall-e-3');
    });
  });

  describe('3. Models Response Parsing', () => {
    it('parses standard OpenAI { data: [{ id: string }] } format', () => {
      const json = {
        data: [{ id: 'gpt-4o' }, { id: 'dall-e-3' }, { id: 'gpt-image-1' }]
      };
      expect(parseModelsResponse(json)).toEqual(['dall-e-3', 'gpt-4o', 'gpt-image-1']);
    });

    it('parses direct JSON array format [{ id: string }] or string[]', () => {
      const jsonArray = [{ id: 'model-b' }, { id: 'model-a' }];
      expect(parseModelsResponse(jsonArray)).toEqual(['model-a', 'model-b']);

      const stringArray = ['llama3', 'mistral'];
      expect(parseModelsResponse(stringArray)).toEqual(['llama3', 'mistral']);
    });

    it('handles duplicates, invalid entries, and sorts alphabetically', () => {
      const json = {
        data: [
          { id: 'gpt-4' },
          { id: 'gpt-4' },
          { id: '  ' },
          null,
          123,
          { id: 'alpha-model' }
        ]
      };
      expect(parseModelsResponse(json)).toEqual(['alpha-model', 'gpt-4']);
    });
  });

  describe('4. fetchOpenAIModels API Calls', () => {
    it('does not send Authorization header when apiKey is empty', async () => {
      let capturedHeaders: Record<string, string> = {};

      const mockFetch: typeof fetch = async (url, init) => {
        capturedHeaders = (init?.headers as Record<string, string>) || {};
        return new Response(JSON.stringify({ data: [{ id: 'local-model' }] }), { status: 200 });
      };

      const models = await fetchOpenAIModels({ apiKey: '', baseUrl: 'http://localhost:11434/v1' }, mockFetch);
      expect(models).toEqual(['local-model']);
      expect(capturedHeaders['Authorization']).toBeUndefined();
    });

    it('sends Authorization header when apiKey is present', async () => {
      let capturedHeaders: Record<string, string> = {};

      const mockFetch: typeof fetch = async (url, init) => {
        capturedHeaders = (init?.headers as Record<string, string>) || {};
        return new Response(JSON.stringify({ data: [{ id: 'gpt-4' }] }), { status: 200 });
      };

      await fetchOpenAIModels({ apiKey: 'sk-test123' }, mockFetch);
      expect(capturedHeaders['Authorization']).toBe('Bearer sk-test123');
    });

    it('handles malformed /models JSON response', async () => {
      const mockFetch: typeof fetch = async () => {
        return new Response('Not JSON', { status: 200 });
      };

      expect(fetchOpenAIModels({ apiKey: 'key' }, mockFetch)).rejects.toThrow(
        'Malformed JSON response from /models endpoint'
      );
    });

    it('formats error message with HTTP status code and body message on HTTP error', async () => {
      const mockFetch: typeof fetch = async () => {
        return new Response('Unauthorized key', { status: 401 });
      };

      expect(fetchOpenAIModels({ apiKey: 'invalid' }, mockFetch)).rejects.toThrow(
        'Failed to fetch models (401 — Unauthorized key)'
      );
    });
  });

  describe('5. generateOpenAIRenderImage API Calls', () => {
    it('succeeds when response contains image_generation_call output', async () => {
      const mockFetch: typeof fetch = async () => {
        return new Response(
          JSON.stringify({
            output: [{ type: 'image_generation_call', result: 'fake_base64_data' }]
          }),
          { status: 200 }
        );
      };

      const result = await generateOpenAIRenderImage({ apiKey: 'sk-key' }, 'img_data', 'prompt', mockFetch);
      expect(result).toBe('data:image/png;base64,fake_base64_data');
    });

    it('throws explicit error when /responses returns valid JSON but no image output', async () => {
      const mockFetch: typeof fetch = async () => {
        return new Response(
          JSON.stringify({
            output: [{ type: 'message', content: [{ text: 'Tool call unsupported' }] }]
          }),
          { status: 200 }
        );
      };

      expect(generateOpenAIRenderImage({ apiKey: 'sk-key' }, 'img_data', 'prompt', mockFetch)).rejects.toThrow(
        'No image returned. Response: Tool call unsupported'
      );
    });

    it('formats error message containing HTTP status and API response on HTTP error (e.g. 404)', async () => {
      const mockFetch: typeof fetch = async () => {
        return new Response('Route /responses not found', { status: 404 });
      };

      expect(generateOpenAIRenderImage({ baseUrl: 'http://localhost:8000' }, 'img_data', 'prompt', mockFetch)).rejects.toThrow(
        'OpenAI API error: 404 — Route /responses not found'
      );
    });
  });

});
