/**
 * AI Settings Storage Management — stored in localStorage (browser-only, never sent to server).
 */

const GEMINI_KEY = 'o3d_gemini_key';
const OPENAI_KEY = 'o3d_openai_key';
const OPENAI_BASE_URL = 'o3d_openai_base_url';
const OPENAI_MODEL = 'o3d_openai_model';

export function getGeminiKey(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(GEMINI_KEY);
}

export function hasGeminiKey(): boolean {
  return !!getGeminiKey();
}

export function getOpenAIKey(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(OPENAI_KEY);
}

export function hasOpenAIKey(): boolean {
  return !!getOpenAIKey();
}

export function setOpenAIKey(key: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(OPENAI_KEY, key);
}

export function removeOpenAIKey(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(OPENAI_KEY);
}

export function getOpenAIBaseUrl(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(OPENAI_BASE_URL) || '';
}

export function setOpenAIBaseUrl(url: string): void {
  if (typeof window === 'undefined') return;
  if (url.trim()) {
    localStorage.setItem(OPENAI_BASE_URL, url.trim());
  } else {
    localStorage.removeItem(OPENAI_BASE_URL);
  }
}

export function removeOpenAIBaseUrl(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(OPENAI_BASE_URL);
}

export function getOpenAIModel(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(OPENAI_MODEL) || '';
}

export function setOpenAIModel(model: string): void {
  if (typeof window === 'undefined') return;
  if (model.trim()) {
    localStorage.setItem(OPENAI_MODEL, model.trim());
  } else {
    localStorage.removeItem(OPENAI_MODEL);
  }
}

export function removeOpenAIModel(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(OPENAI_MODEL);
}
