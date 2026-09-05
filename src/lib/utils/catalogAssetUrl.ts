import urls from 'virtual:catalog-assets';
import { base } from '$app/paths';

/** Production URLs contain a content hash; unchanged assets survive app releases in cache. */
export function catalogAssetUrl(path: string): string {
  return `${base}${urls[path] ?? path}`;
}
