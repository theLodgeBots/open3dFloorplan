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
  /** If set, this is a 2D-only architectural symbol (not rendered in 3D) */
  symbol?: boolean;
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
  { id: 'oven', name: 'Oven', category: 'Kitchen', icon: '🔥', color: '#78716c', width: 60, depth: 60, height: 85 },
  // Bathroom
  { id: 'toilet', name: 'Toilet', category: 'Bathroom', icon: '🚽', color: '#e5e7eb', width: 40, depth: 65, height: 40 },
  { id: 'bathtub', name: 'Bathtub', category: 'Bathroom', icon: '🛁', color: '#93c5fd', width: 170, depth: 75, height: 60 },
  { id: 'shower', name: 'Shower', category: 'Bathroom', icon: '🚿', color: '#bae6fd', width: 90, depth: 90, height: 210 },
  { id: 'sink_b', name: 'Sink', category: 'Bathroom', icon: '🪥', color: '#cbd5e1', width: 60, depth: 45, height: 85 },
  { id: 'washer_dryer', name: 'Washer/Dryer', category: 'Bathroom', icon: '👕', color: '#e2e8f0', width: 60, depth: 65, height: 85 },
  // Office
  { id: 'desk', name: 'Desk', category: 'Office', icon: '🖥️', color: '#34d399', width: 140, depth: 70, height: 75 },
  { id: 'office_chair', name: 'Office Chair', category: 'Office', icon: '🪑', color: '#6b7280', width: 45, depth: 45, height: 90 },
  // Dining
  { id: 'dining_table', name: 'Dining Table', category: 'Dining', icon: '🍽️', color: '#f59e0b', width: 120, depth: 80, height: 75 },
  { id: 'dining_chair', name: 'Dining Chair', category: 'Dining', icon: '🪑', color: '#d97706', width: 45, depth: 45, height: 90 },
  // Living Room extras
  { id: 'fireplace', name: 'Fireplace', category: 'Living Room', icon: '🔥', color: '#92400e', width: 120, depth: 40, height: 120 },
  { id: 'television', name: 'Television', category: 'Living Room', icon: '📺', color: '#1e293b', width: 120, depth: 8, height: 70 },
  { id: 'storage', name: 'Storage Cabinet', category: 'Living Room', icon: '🗄️', color: '#78716c', width: 100, depth: 50, height: 120 },
  { id: 'table', name: 'Table', category: 'Living Room', icon: '🪑', color: '#a16207', width: 100, depth: 60, height: 75 },
  // Decor
  { id: 'rug', name: 'Rug', category: 'Decor', icon: '🟫', color: '#c2956b', width: 200, depth: 300, height: 1 },
  { id: 'round_rug', name: 'Round Rug', category: 'Decor', icon: '⭕', color: '#b87d5e', width: 200, depth: 200, height: 1 },
  { id: 'runner_rug', name: 'Runner Rug', category: 'Decor', icon: '🟫', color: '#a0694e', width: 80, depth: 250, height: 1 },
  { id: 'potted_plant', name: 'Potted Plant', category: 'Decor', icon: '🪴', color: '#4ade80', width: 40, depth: 40, height: 60 },
  { id: 'floor_plant', name: 'Floor Plant', category: 'Decor', icon: '🌿', color: '#22c55e', width: 50, depth: 50, height: 120 },
  { id: 'hanging_plant', name: 'Hanging Plant', category: 'Decor', icon: '🌱', color: '#86efac', width: 30, depth: 30, height: 40 },
  { id: 'curtain', name: 'Curtain', category: 'Decor', icon: '🪟', color: '#e2c9a6', width: 120, depth: 10, height: 260 },
  { id: 'sheer_curtain', name: 'Sheer Curtain', category: 'Decor', icon: '🪟', color: '#f5f0e8', width: 120, depth: 10, height: 260 },
  { id: 'wall_art', name: 'Wall Art', category: 'Decor', icon: '🖼️', color: '#f59e0b', width: 80, depth: 5, height: 60 },
  { id: 'mirror', name: 'Mirror', category: 'Decor', icon: '🪞', color: '#94a3b8', width: 60, depth: 5, height: 90 },
  { id: 'clock', name: 'Clock', category: 'Decor', icon: '🕐', color: '#1e293b', width: 30, depth: 5, height: 30 },
  // Lighting
  { id: 'ceiling_light', name: 'Ceiling Light', category: 'Lighting', icon: '💡', color: '#fef08a', width: 40, depth: 40, height: 15 },
  { id: 'chandelier', name: 'Chandelier', category: 'Lighting', icon: '✨', color: '#fcd34d', width: 60, depth: 60, height: 50 },
  { id: 'recessed_light', name: 'Recessed Light', category: 'Lighting', icon: '🔆', color: '#fef9c3', width: 15, depth: 15, height: 5 },
  { id: 'floor_lamp', name: 'Floor Lamp', category: 'Lighting', icon: '🪔', color: '#e5e7eb', width: 40, depth: 40, height: 160 },
  { id: 'table_lamp', name: 'Table Lamp', category: 'Lighting', icon: '💡', color: '#fde68a', width: 25, depth: 25, height: 45 },
  { id: 'wall_sconce', name: 'Wall Sconce', category: 'Lighting', icon: '🔅', color: '#fef3c7', width: 15, depth: 10, height: 20 },
  { id: 'pendant_light', name: 'Pendant Light', category: 'Lighting', icon: '💡', color: '#fbbf24', width: 30, depth: 30, height: 30 },

  // Outdoor Furniture
  { id: 'patio_table', name: 'Patio Table', category: 'Outdoor Furniture', icon: '🪑', color: '#92400e', width: 120, depth: 120, height: 75 },
  { id: 'patio_chair', name: 'Patio Chair', category: 'Outdoor Furniture', icon: '🪑', color: '#a16207', width: 55, depth: 55, height: 85 },
  { id: 'bench_outdoor', name: 'Park Bench', category: 'Outdoor Furniture', icon: '🪑', color: '#78716c', width: 150, depth: 50, height: 80 },
  { id: 'lounger', name: 'Sun Lounger', category: 'Outdoor Furniture', icon: '🛏️', color: '#d97706', width: 70, depth: 190, height: 35 },
  { id: 'umbrella', name: 'Patio Umbrella', category: 'Outdoor Furniture', icon: '☂️', color: '#ef4444', width: 200, depth: 200, height: 230 },
  { id: 'bbq_grill', name: 'BBQ Grill', category: 'Outdoor Furniture', icon: '🔥', color: '#374151', width: 80, depth: 50, height: 100 },
  { id: 'fire_pit', name: 'Fire Pit', category: 'Outdoor Furniture', icon: '🔥', color: '#78716c', width: 90, depth: 90, height: 40 },
  { id: 'campfire', name: 'Campfire', category: 'Outdoor Furniture', icon: '🏕️', color: '#b45309', width: 60, depth: 60, height: 30 },
  { id: 'picnic_table', name: 'Picnic Table', category: 'Outdoor Furniture', icon: '🍽️', color: '#92400e', width: 180, depth: 140, height: 75 },
  { id: 'tent', name: 'Tent', category: 'Outdoor Furniture', icon: '⛺', color: '#d4a373', width: 200, depth: 200, height: 140 },
  { id: 'outdoor_sign', name: 'Sign', category: 'Outdoor Furniture', icon: '🪧', color: '#92400e', width: 40, depth: 10, height: 120 },
  { id: 'outdoor_pot_large', name: 'Large Pot', category: 'Outdoor Furniture', icon: '🏺', color: '#b45309', width: 40, depth: 40, height: 35 },
  { id: 'outdoor_pot_small', name: 'Small Pot', category: 'Outdoor Furniture', icon: '🏺', color: '#b45309', width: 25, depth: 25, height: 25 },

  // Landscaping — Trees
  { id: 'tree_oak', name: 'Oak Tree', category: 'Landscaping', icon: '🌳', color: '#166534', width: 300, depth: 300, height: 500 },
  { id: 'tree_default', name: 'Deciduous Tree', category: 'Landscaping', icon: '🌳', color: '#15803d', width: 250, depth: 250, height: 450 },
  { id: 'tree_detailed', name: 'Detailed Tree', category: 'Landscaping', icon: '🌳', color: '#14532d', width: 280, depth: 280, height: 480 },
  { id: 'tree_pine', name: 'Pine Tree', category: 'Landscaping', icon: '🌲', color: '#065f46', width: 150, depth: 150, height: 500 },
  { id: 'tree_pine_tall', name: 'Tall Pine', category: 'Landscaping', icon: '🌲', color: '#064e3b', width: 120, depth: 120, height: 600 },
  { id: 'tree_palm', name: 'Palm Tree', category: 'Landscaping', icon: '🌴', color: '#16a34a', width: 200, depth: 200, height: 500 },
  { id: 'tree_palm_bend', name: 'Bent Palm', category: 'Landscaping', icon: '🌴', color: '#22c55e', width: 200, depth: 200, height: 450 },
  { id: 'tree_palm_tall', name: 'Tall Palm', category: 'Landscaping', icon: '🌴', color: '#4ade80', width: 150, depth: 150, height: 600 },
  { id: 'tree_fat', name: 'Fat Tree', category: 'Landscaping', icon: '🌳', color: '#15803d', width: 350, depth: 350, height: 400 },
  { id: 'tree_simple', name: 'Simple Tree', category: 'Landscaping', icon: '🌳', color: '#22c55e', width: 200, depth: 200, height: 350 },
  { id: 'tree_thin', name: 'Thin Tree', category: 'Landscaping', icon: '🌳', color: '#166534', width: 100, depth: 100, height: 450 },
  { id: 'tree_tall', name: 'Tall Tree', category: 'Landscaping', icon: '🌳', color: '#14532d', width: 200, depth: 200, height: 550 },
  { id: 'tree_cone', name: 'Cone Tree', category: 'Landscaping', icon: '🌲', color: '#065f46', width: 150, depth: 150, height: 400 },
  { id: 'tree_blocky', name: 'Blocky Tree', category: 'Landscaping', icon: '🌳', color: '#15803d', width: 200, depth: 200, height: 400 },
  { id: 'tree_small', name: 'Small Tree', category: 'Landscaping', icon: '🌳', color: '#4ade80', width: 120, depth: 120, height: 250 },

  // Landscaping — Bushes & Plants
  { id: 'bush', name: 'Bush', category: 'Landscaping', icon: '🌿', color: '#22c55e', width: 80, depth: 80, height: 60 },
  { id: 'bush_detailed', name: 'Detailed Bush', category: 'Landscaping', icon: '🌿', color: '#16a34a', width: 90, depth: 90, height: 70 },
  { id: 'bush_large', name: 'Large Bush', category: 'Landscaping', icon: '🌿', color: '#15803d', width: 120, depth: 120, height: 90 },
  { id: 'bush_large_triangle', name: 'Large Triangle Bush', category: 'Landscaping', icon: '🌿', color: '#166534', width: 120, depth: 120, height: 100 },
  { id: 'bush_small', name: 'Small Bush', category: 'Landscaping', icon: '🌿', color: '#4ade80', width: 50, depth: 50, height: 40 },
  { id: 'bush_triangle', name: 'Triangle Bush', category: 'Landscaping', icon: '🌿', color: '#22c55e', width: 80, depth: 80, height: 80 },
  { id: 'hedge_row', name: 'Hedge Row', category: 'Landscaping', icon: '🌿', color: '#166534', width: 200, depth: 60, height: 120 },
  { id: 'cactus_short', name: 'Short Cactus', category: 'Landscaping', icon: '🌵', color: '#4d7c0f', width: 30, depth: 30, height: 60 },
  { id: 'cactus_tall', name: 'Tall Cactus', category: 'Landscaping', icon: '🌵', color: '#365314', width: 30, depth: 30, height: 120 },
  { id: 'hanging_moss', name: 'Hanging Moss', category: 'Landscaping', icon: '🌿', color: '#86efac', width: 40, depth: 40, height: 80 },

  // Landscaping — Flowers
  { id: 'flower_purple', name: 'Purple Flower', category: 'Landscaping', icon: '🌸', color: '#a855f7', width: 20, depth: 20, height: 30 },
  { id: 'flower_red', name: 'Red Flower', category: 'Landscaping', icon: '🌹', color: '#ef4444', width: 20, depth: 20, height: 30 },
  { id: 'flower_yellow', name: 'Yellow Flower', category: 'Landscaping', icon: '🌻', color: '#eab308', width: 20, depth: 20, height: 30 },
  { id: 'flower_purple_b', name: 'Purple Flower B', category: 'Landscaping', icon: '🌸', color: '#c084fc', width: 25, depth: 25, height: 35 },
  { id: 'flower_red_b', name: 'Red Flower B', category: 'Landscaping', icon: '🌹', color: '#f87171', width: 25, depth: 25, height: 35 },
  { id: 'flower_yellow_b', name: 'Yellow Flower B', category: 'Landscaping', icon: '🌻', color: '#facc15', width: 25, depth: 25, height: 35 },
  { id: 'flower_bed', name: 'Flower Bed', category: 'Landscaping', icon: '🌺', color: '#f472b6', width: 100, depth: 40, height: 20 },
  { id: 'lily', name: 'Water Lily', category: 'Landscaping', icon: '🪷', color: '#86efac', width: 30, depth: 30, height: 5 },

  // Landscaping — Grass
  { id: 'grass_tuft', name: 'Grass Tuft', category: 'Landscaping', icon: '🌾', color: '#84cc16', width: 30, depth: 30, height: 15 },
  { id: 'grass_large', name: 'Large Grass', category: 'Landscaping', icon: '🌾', color: '#65a30d', width: 40, depth: 40, height: 25 },
  { id: 'grass_leafs', name: 'Grass Leaves', category: 'Landscaping', icon: '🌾', color: '#4d7c0f', width: 30, depth: 30, height: 20 },
  { id: 'grass_leafs_large', name: 'Large Grass Leaves', category: 'Landscaping', icon: '🌾', color: '#365314', width: 40, depth: 40, height: 30 },

  // Landscaping — Rocks & Stones
  { id: 'rock_large', name: 'Large Rock', category: 'Landscaping', icon: '🪨', color: '#78716c', width: 100, depth: 80, height: 60 },
  { id: 'rock_large_b', name: 'Large Rock B', category: 'Landscaping', icon: '🪨', color: '#6b7280', width: 90, depth: 70, height: 55 },
  { id: 'rock_tall', name: 'Tall Rock', category: 'Landscaping', icon: '🪨', color: '#57534e', width: 60, depth: 50, height: 100 },
  { id: 'rock_small', name: 'Small Rock', category: 'Landscaping', icon: '🪨', color: '#a8a29e', width: 30, depth: 25, height: 20 },
  { id: 'rock_small_b', name: 'Small Rock B', category: 'Landscaping', icon: '🪨', color: '#d6d3d1', width: 25, depth: 20, height: 18 },
  { id: 'stone_large', name: 'Large Stone', category: 'Landscaping', icon: '🪨', color: '#9ca3af', width: 80, depth: 60, height: 50 },
  { id: 'stone_tall', name: 'Tall Stone', category: 'Landscaping', icon: '🪨', color: '#6b7280', width: 50, depth: 40, height: 90 },
  { id: 'boulder', name: 'Boulder', category: 'Landscaping', icon: '🪨', color: '#57534e', width: 150, depth: 120, height: 100 },

  // Landscaping — Misc
  { id: 'mushroom_red', name: 'Red Mushroom', category: 'Landscaping', icon: '🍄', color: '#dc2626', width: 20, depth: 20, height: 25 },
  { id: 'mushroom_group', name: 'Mushroom Group', category: 'Landscaping', icon: '🍄', color: '#ef4444', width: 30, depth: 30, height: 20 },
  { id: 'mushroom_tan', name: 'Tan Mushroom', category: 'Landscaping', icon: '🍄', color: '#d4a373', width: 20, depth: 20, height: 25 },
  { id: 'log_single', name: 'Log', category: 'Landscaping', icon: '🪵', color: '#92400e', width: 30, depth: 100, height: 30 },
  { id: 'log_large', name: 'Large Log', category: 'Landscaping', icon: '🪵', color: '#78350f', width: 40, depth: 120, height: 40 },
  { id: 'log_stack', name: 'Log Stack', category: 'Landscaping', icon: '🪵', color: '#92400e', width: 80, depth: 60, height: 50 },
  { id: 'stump_old', name: 'Old Stump', category: 'Landscaping', icon: '🪵', color: '#78350f', width: 40, depth: 40, height: 30 },
  { id: 'stump_round', name: 'Round Stump', category: 'Landscaping', icon: '🪵', color: '#92400e', width: 35, depth: 35, height: 25 },
  { id: 'corn', name: 'Corn Stalks', category: 'Landscaping', icon: '🌽', color: '#84cc16', width: 30, depth: 30, height: 120 },
  { id: 'pumpkin', name: 'Pumpkin', category: 'Landscaping', icon: '🎃', color: '#ea580c', width: 30, depth: 30, height: 25 },
  { id: 'statue_column', name: 'Column Statue', category: 'Landscaping', icon: '🏛️', color: '#d1d5db', width: 30, depth: 30, height: 200 },
  { id: 'obelisk', name: 'Obelisk', category: 'Landscaping', icon: '🏛️', color: '#9ca3af', width: 40, depth: 40, height: 250 },

  // Fencing
  { id: 'fence_simple', name: 'Simple Fence', category: 'Fencing', icon: '🏗️', color: '#92400e', width: 200, depth: 10, height: 100 },
  { id: 'fence_planks', name: 'Plank Fence', category: 'Fencing', icon: '🏗️', color: '#a16207', width: 200, depth: 10, height: 120 },
  { id: 'fence_gate', name: 'Fence Gate', category: 'Fencing', icon: '🚪', color: '#78350f', width: 100, depth: 10, height: 100 },
  { id: 'fence_corner', name: 'Fence Corner', category: 'Fencing', icon: '🏗️', color: '#92400e', width: 100, depth: 100, height: 100 },
  { id: 'picket_fence', name: 'Picket Fence', category: 'Fencing', icon: '🏗️', color: '#fef3c7', width: 200, depth: 10, height: 90 },
  { id: 'metal_fence', name: 'Metal Fence', category: 'Fencing', icon: '🏗️', color: '#374151', width: 200, depth: 10, height: 120 },

  // Structures
  { id: 'pergola', name: 'Pergola', category: 'Structures', icon: '🏗️', color: '#92400e', width: 300, depth: 300, height: 250 },
  { id: 'deck_patio', name: 'Deck/Patio', category: 'Structures', icon: '🏗️', color: '#a16207', width: 400, depth: 300, height: 15 },
  { id: 'raised_garden_bed', name: 'Raised Garden Bed', category: 'Structures', icon: '🌱', color: '#78350f', width: 120, depth: 60, height: 40 },
  { id: 'shed', name: 'Garden Shed', category: 'Structures', icon: '🏠', color: '#78716c', width: 200, depth: 250, height: 230 },
  { id: 'gazebo', name: 'Gazebo', category: 'Structures', icon: '🏗️', color: '#e5e7eb', width: 300, depth: 300, height: 280 },
  { id: 'planter_box', name: 'Planter Box', category: 'Structures', icon: '🌱', color: '#92400e', width: 80, depth: 30, height: 30 },
  { id: 'raised_bed', name: 'Raised Bed', category: 'Structures', icon: '🌱', color: '#7B5B3A', width: 180, depth: 90, height: 40 },

  // Pool & Spa
  { id: 'pool_rectangular', name: 'Rectangular Pool', category: 'Pool & Spa', icon: '🏊', color: '#0ea5e9', width: 500, depth: 300, height: 15 },
  { id: 'pool_round', name: 'Round Pool', category: 'Pool & Spa', icon: '🏊', color: '#0ea5e9', width: 300, depth: 300, height: 15 },
  { id: 'pool_lshaped', name: 'L-Shaped Pool', category: 'Pool & Spa', icon: '🏊', color: '#0891b2', width: 600, depth: 400, height: 15 },
  { id: 'pool_kidney', name: 'Kidney Pool', category: 'Pool & Spa', icon: '🏊', color: '#06b6d4', width: 500, depth: 280, height: 15 },
  { id: 'hot_tub', name: 'Hot Tub', category: 'Pool & Spa', icon: '♨️', color: '#0284c7', width: 200, depth: 200, height: 80 },
  { id: 'pool_ladder', name: 'Pool Ladder', category: 'Pool & Spa', icon: '🪜', color: '#94a3b8', width: 50, depth: 30, height: 100 },
  { id: 'diving_board', name: 'Diving Board', category: 'Pool & Spa', icon: '🏊', color: '#e2e8f0', width: 50, depth: 200, height: 80 },
  { id: 'pool_lounge', name: 'Pool Lounger', category: 'Pool & Spa', icon: '🛏️', color: '#f8fafc', width: 70, depth: 190, height: 35 },

  // Garage
  { id: 'car_sedan', name: 'Car (Sedan)', category: 'Garage', icon: '🚗', color: '#475569', width: 180, depth: 450, height: 150 },
  { id: 'car_suv', name: 'Car (SUV)', category: 'Garage', icon: '🚙', color: '#334155', width: 190, depth: 480, height: 170 },
  { id: 'garage_door_single', name: 'Garage Door (Single)', category: 'Garage', icon: '🚪', color: '#9ca3af', width: 280, depth: 10, height: 220 },
  { id: 'garage_door_double', name: 'Garage Door (Double)', category: 'Garage', icon: '🚪', color: '#9ca3af', width: 500, depth: 10, height: 220 },
  { id: 'workbench', name: 'Workbench', category: 'Garage', icon: '🔧', color: '#78716c', width: 180, depth: 60, height: 90 },
  { id: 'tool_cabinet', name: 'Tool Cabinet', category: 'Garage', icon: '🧰', color: '#dc2626', width: 70, depth: 45, height: 140 },
  { id: 'bike', name: 'Bicycle', category: 'Garage', icon: '🚲', color: '#374151', width: 60, depth: 170, height: 110 },
  { id: 'motorcycle', name: 'Motorcycle', category: 'Garage', icon: '🏍️', color: '#1e293b', width: 80, depth: 210, height: 110 },

  // Paths & Lawns
  { id: 'lawn_rect', name: 'Lawn (Rectangle)', category: 'Paths & Lawns', icon: '🟩', color: '#22c55e', width: 400, depth: 300, height: 3 },
  { id: 'lawn_square', name: 'Lawn (Square)', category: 'Paths & Lawns', icon: '🟩', color: '#22c55e', width: 300, depth: 300, height: 3 },
  { id: 'lawn_large', name: 'Lawn (Large)', category: 'Paths & Lawns', icon: '🟩', color: '#16a34a', width: 600, depth: 400, height: 3 },
  { id: 'path_straight', name: 'Path (Straight)', category: 'Paths & Lawns', icon: '🟫', color: '#a8a29e', width: 100, depth: 300, height: 3 },
  { id: 'path_wide', name: 'Path (Wide)', category: 'Paths & Lawns', icon: '🟫', color: '#a8a29e', width: 150, depth: 300, height: 3 },
  { id: 'patio_stone', name: 'Stone Patio', category: 'Paths & Lawns', icon: '🪨', color: '#d6d3d1', width: 300, depth: 300, height: 5 },
  { id: 'gravel_area', name: 'Gravel Area', category: 'Paths & Lawns', icon: '⬜', color: '#e7e5e4', width: 200, depth: 200, height: 3 },
  { id: 'stepping_stones', name: 'Stepping Stones', category: 'Paths & Lawns', icon: '🪨', color: '#a8a29e', width: 60, depth: 300, height: 3 },
  { id: 'driveway', name: 'Driveway', category: 'Paths & Lawns', icon: '🟫', color: '#78716c', width: 300, depth: 600, height: 3 },
  { id: 'sandbox', name: 'Sandbox', category: 'Paths & Lawns', icon: '🏖️', color: '#fbbf24', width: 200, depth: 200, height: 20 },

  // Outdoor Lighting
  { id: 'lamp_post', name: 'Lamp Post', category: 'Outdoor Lighting', icon: '🔦', color: '#1e293b', width: 30, depth: 30, height: 300 },
  { id: 'lamp_post_double', name: 'Double Lamp Post', category: 'Outdoor Lighting', icon: '🔦', color: '#1e293b', width: 60, depth: 30, height: 300 },
  { id: 'bollard_light', name: 'Bollard Light', category: 'Outdoor Lighting', icon: '💡', color: '#374151', width: 15, depth: 15, height: 80 },
  { id: 'wall_sconce_outdoor', name: 'Wall Sconce', category: 'Outdoor Lighting', icon: '💡', color: '#374151', width: 20, depth: 15, height: 30 },
  { id: 'spot_light_outdoor', name: 'Spot Light', category: 'Outdoor Lighting', icon: '🔆', color: '#1e293b', width: 15, depth: 15, height: 25 },
  { id: 'string_lights', name: 'String Lights', category: 'Outdoor Lighting', icon: '✨', color: '#fbbf24', width: 300, depth: 10, height: 250 },
  { id: 'solar_path_light', name: 'Solar Path Light', category: 'Outdoor Lighting', icon: '☀️', color: '#374151', width: 12, depth: 12, height: 40 },
  { id: 'flood_light', name: 'Flood Light', category: 'Outdoor Lighting', icon: '🔦', color: '#1e293b', width: 25, depth: 20, height: 30 },

  // Garden Structures
  { id: 'greenhouse', name: 'Greenhouse', category: 'Garden Structures', icon: '🏡', color: '#86efac', width: 300, depth: 400, height: 250 },
  { id: 'greenhouse_small', name: 'Small Greenhouse', category: 'Garden Structures', icon: '🏡', color: '#86efac', width: 200, depth: 250, height: 200 },
  { id: 'trellis', name: 'Trellis', category: 'Garden Structures', icon: '🌿', color: '#92400e', width: 150, depth: 10, height: 200 },
  { id: 'arbor', name: 'Garden Arbor', category: 'Garden Structures', icon: '🌿', color: '#92400e', width: 150, depth: 60, height: 230 },
  { id: 'compost_bin', name: 'Compost Bin', category: 'Garden Structures', icon: '🗑️', color: '#422006', width: 80, depth: 80, height: 90 },
  { id: 'rain_barrel', name: 'Rain Barrel', category: 'Garden Structures', icon: '🛢️', color: '#3b82f6', width: 60, depth: 60, height: 90 },
  { id: 'bird_bath', name: 'Bird Bath', category: 'Garden Structures', icon: '🐦', color: '#d6d3d1', width: 50, depth: 50, height: 80 },
  { id: 'fountain', name: 'Garden Fountain', category: 'Garden Structures', icon: '⛲', color: '#94a3b8', width: 120, depth: 120, height: 150 },
  { id: 'statue', name: 'Garden Statue', category: 'Garden Structures', icon: '🗿', color: '#d6d3d1', width: 40, depth: 40, height: 120 },
  { id: 'mailbox', name: 'Mailbox', category: 'Garden Structures', icon: '📫', color: '#1e293b', width: 30, depth: 20, height: 110 },

  // Electrical Symbols (2D only)
  { id: 'sym_outlet', name: 'Power Outlet', category: 'Electrical', icon: '🔌', color: '#2563eb', width: 15, depth: 15, height: 0, symbol: true },
  { id: 'sym_switch', name: 'Light Switch', category: 'Electrical', icon: '🔘', color: '#2563eb', width: 15, depth: 15, height: 0, symbol: true },
  { id: 'sym_ceiling_light', name: 'Ceiling Light', category: 'Electrical', icon: '💡', color: '#eab308', width: 20, depth: 20, height: 0, symbol: true },
  { id: 'sym_recessed_light', name: 'Recessed Light', category: 'Electrical', icon: '🔆', color: '#eab308', width: 15, depth: 15, height: 0, symbol: true },
  { id: 'sym_pendant', name: 'Pendant Light', category: 'Electrical', icon: '💡', color: '#eab308', width: 18, depth: 18, height: 0, symbol: true },
  { id: 'sym_ceiling_fan', name: 'Ceiling Fan', category: 'Electrical', icon: '🌀', color: '#2563eb', width: 25, depth: 25, height: 0, symbol: true },
  { id: 'sym_junction', name: 'Junction Box', category: 'Electrical', icon: '⬜', color: '#2563eb', width: 12, depth: 12, height: 0, symbol: true },
  { id: 'sym_smoke', name: 'Smoke Detector', category: 'Electrical', icon: '🔔', color: '#dc2626', width: 15, depth: 15, height: 0, symbol: true },

  // Plumbing Symbols (2D only)
  { id: 'sym_water_supply', name: 'Water Supply', category: 'Plumbing', icon: '💧', color: '#0ea5e9', width: 15, depth: 15, height: 0, symbol: true },
  { id: 'sym_drain', name: 'Drain Point', category: 'Plumbing', icon: '⬇️', color: '#0ea5e9', width: 15, depth: 15, height: 0, symbol: true },
  { id: 'sym_water_heater', name: 'Water Heater', category: 'Plumbing', icon: '🔥', color: '#ef4444', width: 20, depth: 20, height: 0, symbol: true },
  { id: 'sym_washer_hookup', name: 'Washer Hookup', category: 'Plumbing', icon: '🧺', color: '#0ea5e9', width: 15, depth: 15, height: 0, symbol: true },
  { id: 'sym_gas_line', name: 'Gas Line', category: 'Plumbing', icon: '⛽', color: '#f59e0b', width: 15, depth: 15, height: 0, symbol: true },
];

export function getCatalogItem(id: string): FurnitureDef | undefined {
  return furnitureCatalog.find(f => f.id === id);
}

export const furnitureCategories = [...new Set(furnitureCatalog.map(f => f.category))];
