export interface FurnitureDef {
  id: string;
  name: string;
  category: string;
  icon: string;
  color: string;
  /** width x depth x height in cm */
  width: number;
  depth: number;
  height: number;
}

export const furnitureCatalog: FurnitureDef[] = [
  // Living Room
  { id: 'sofa', name: 'Sofa', category: 'Living Room', icon: '🛋️', color: '#a78bfa', width: 200, depth: 90, height: 80 },
  { id: 'loveseat', name: 'Loveseat', category: 'Living Room', icon: '🛋️', color: '#8b5cf6', width: 140, depth: 85, height: 80 },
  { id: 'chair', name: 'Armchair', category: 'Living Room', icon: '💺', color: '#c084fc', width: 80, depth: 80, height: 90 },
  { id: 'coffee_table', name: 'Coffee Table', category: 'Living Room', icon: '☕', color: '#92400e', width: 120, depth: 60, height: 45 },
  { id: 'tv_stand', name: 'TV Stand', category: 'Living Room', icon: '📺', color: '#475569', width: 150, depth: 45, height: 50 },
  { id: 'bookshelf', name: 'Bookshelf', category: 'Living Room', icon: '📚', color: '#92400e', width: 80, depth: 30, height: 180 },
  { id: 'side_table', name: 'Side Table', category: 'Living Room', icon: '🪑', color: '#a16207', width: 50, depth: 50, height: 55 },
  // Bedroom
  { id: 'bed_queen', name: 'Queen Bed', category: 'Bedroom', icon: '🛏️', color: '#60a5fa', width: 200, depth: 150, height: 50 },
  { id: 'bed_twin', name: 'Twin Bed', category: 'Bedroom', icon: '🛏️', color: '#93c5fd', width: 190, depth: 100, height: 50 },
  { id: 'nightstand', name: 'Nightstand', category: 'Bedroom', icon: '🛏️', color: '#a16207', width: 50, depth: 40, height: 55 },
  { id: 'dresser', name: 'Dresser', category: 'Bedroom', icon: '🗄️', color: '#92400e', width: 120, depth: 50, height: 80 },
  { id: 'wardrobe', name: 'Wardrobe', category: 'Bedroom', icon: '🗄️', color: '#a16207', width: 120, depth: 60, height: 200 },
  // Kitchen
  { id: 'stove', name: 'Stove', category: 'Kitchen', icon: '🍳', color: '#f87171', width: 60, depth: 60, height: 85 },
  { id: 'fridge', name: 'Fridge', category: 'Kitchen', icon: '🧊', color: '#d1d5db', width: 70, depth: 70, height: 180 },
  { id: 'sink_k', name: 'Sink', category: 'Kitchen', icon: '🚰', color: '#94a3b8', width: 60, depth: 45, height: 85 },
  { id: 'counter', name: 'Counter', category: 'Kitchen', icon: '🔲', color: '#78716c', width: 120, depth: 60, height: 85 },
  { id: 'dishwasher', name: 'Dishwasher', category: 'Kitchen', icon: '🫧', color: '#cbd5e1', width: 60, depth: 60, height: 85 },
  // Bathroom
  { id: 'toilet', name: 'Toilet', category: 'Bathroom', icon: '🚽', color: '#e5e7eb', width: 40, depth: 65, height: 40 },
  { id: 'bathtub', name: 'Bathtub', category: 'Bathroom', icon: '🛁', color: '#93c5fd', width: 170, depth: 75, height: 60 },
  { id: 'shower', name: 'Shower', category: 'Bathroom', icon: '🚿', color: '#bae6fd', width: 90, depth: 90, height: 210 },
  { id: 'sink_b', name: 'Sink', category: 'Bathroom', icon: '🪥', color: '#cbd5e1', width: 60, depth: 45, height: 85 },
  // Office
  { id: 'desk', name: 'Desk', category: 'Office', icon: '🖥️', color: '#34d399', width: 140, depth: 70, height: 75 },
  { id: 'office_chair', name: 'Office Chair', category: 'Office', icon: '🪑', color: '#6b7280', width: 45, depth: 45, height: 90 },
  // Dining
  { id: 'dining_table', name: 'Dining Table', category: 'Dining', icon: '🍽️', color: '#f59e0b', width: 120, depth: 80, height: 75 },
  { id: 'dining_chair', name: 'Dining Chair', category: 'Dining', icon: '🪑', color: '#d97706', width: 45, depth: 45, height: 90 },
];

export function getCatalogItem(id: string): FurnitureDef | undefined {
  return furnitureCatalog.find(f => f.id === id);
}

export const furnitureCategories = [...new Set(furnitureCatalog.map(f => f.category))];
