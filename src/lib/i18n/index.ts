import { writable, get } from 'svelte/store';
import { en } from './locales/en';
import { pt } from './locales/pt';

export type Locale = 'en' | 'pt';

const dictionaries: Record<Locale, Record<string, string>> = { en, pt };

function detectLocale(): Locale {
  if (typeof navigator === 'undefined') return 'en';
  return navigator.language.toLowerCase().startsWith('pt') ? 'pt' : 'en';
}

function getStoredLocale(): Locale {
  if (typeof window === 'undefined') return 'en';
  const stored = localStorage.getItem('o3d_locale') as Locale | null;
  return stored === 'en' || stored === 'pt' ? stored : detectLocale();
}

function createLocaleStore() {
  const { subscribe, set } = writable<Locale>(getStoredLocale());

  return {
    subscribe,
    set(value: Locale) {
      set(value);
      if (typeof window !== 'undefined') {
        localStorage.setItem('o3d_locale', value);
      }
    },
  };
}

export const locale = createLocaleStore();

export function t(key: string, vars?: Record<string, string | number>): string {
  const current = get(locale);
  let value = dictionaries[current][key] ?? dictionaries.en[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      value = value.replaceAll(`{${k}}`, String(v));
    }
  }
  return value;
}
