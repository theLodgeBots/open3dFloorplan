import type { FurnitureItem } from '$lib/models/types';
import { getCatalogItem } from './furnitureCatalog';

/** Display aliases only. Package export keeps the retained native category. */
export function importedFurnitureCategory(category: string, widthCm: number): Pick<FurnitureItem, 'catalogId' | 'sourceCategory'> {
  // Exact web IDs win: resizing a sofa or queen bed must not change its identity.
  if (getCatalogItem(category)) return { catalogId: category };
  if (category === 'bed') return { catalogId: widthCm > 140 ? 'bed_queen' : 'bed_twin' };
  const aliases: Record<string, string> = {
    refrigerator: 'fridge', sink: 'sink_b', washerDryer: 'washer_dryer', washerdryer: 'washer_dryer',
  };
  if (Object.hasOwn(aliases, category)) return { catalogId: aliases[category] };
  return { catalogId: 'imported_object', sourceCategory: category };
}

export function exportedFurnitureCategory(item: FurnitureItem): string {
  return item.catalogId === 'imported_object' ? item.sourceCategory ?? item.catalogId : item.catalogId;
}
