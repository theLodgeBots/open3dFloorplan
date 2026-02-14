/**
 * AI API key management — stored in localStorage (browser-only, never sent to server).
 */

const GEMINI_KEY = 'o3d_gemini_key';

export function getGeminiKey(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(GEMINI_KEY);
}

export function hasGeminiKey(): boolean {
  return !!getGeminiKey();
}
