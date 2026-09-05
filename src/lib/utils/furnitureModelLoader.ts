import { catalogAssetUrl } from '$lib/utils/catalogAssetUrl';
/**
 * Furniture Model Loader
 * Loads GLB models from /models/ for furniture items, with procedural fallback.
 * Models sourced from Kenney Furniture Kit (CC0).
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { createFurnitureModel } from './furnitureModels3d';
import type { FurnitureDef } from './furnitureCatalog';

const loader = new GLTFLoader();
const modelCache = new Map<string, THREE.Group>();
const loadingPromises = new Map<string, Promise<THREE.Group | null>>();

/**
 * Map our catalog IDs to Kenney GLB filenames (without extension).
 * Each entry can also specify scale/rotation adjustments.
 */
interface ModelMapping {
  file: string;
  scale?: number;       // uniform scale multiplier
  rotateY?: number;     // additional Y rotation in radians
  offsetY?: number;     // vertical offset
}

const MODEL_MAP: Record<string, ModelMapping> = {
  // Living Room
  sofa:           { file: 'loungeDesignSofa', scale: 110 },
  loveseat:       { file: 'loungeDesignSofa', scale: 100 },
  chair:          { file: 'loungeChair', scale: 95 },
  coffee_table:   { file: 'tableCoffee', scale: 100 },
  tv_stand:       { file: 'cabinetTelevision', scale: 100 },
  bookshelf:      { file: 'bookcaseOpen', scale: 100 },
  side_table:     { file: 'sideTable', scale: 80 },
  fireplace:      { file: 'toaster', scale: 100 }, // placeholder
  television:     { file: 'televisionModern', scale: 100 },
  storage:        { file: 'bookcaseClosed', scale: 100 },
  table:          { file: 'tableCross', scale: 100 },

  // Bedroom
  bed_queen:      { file: 'bedDouble', scale: 110 },
  bed_twin:       { file: 'bedSingle', scale: 100 },
  nightstand:     { file: 'cabinetBedDrawerTable', scale: 80 },
  dresser:        { file: 'cabinetBedDrawer', scale: 100 },
  wardrobe:       { file: 'bookcaseClosedDoors', scale: 110 },

  // Kitchen
  stove:          { file: 'kitchenStove', scale: 100 },
  fridge:         { file: 'kitchenFridgeLarge', scale: 100 },
  sink_k:         { file: 'kitchenSink', scale: 100 },
  counter:        { file: 'kitchenCabinet', scale: 100 },
  dishwasher:     { file: 'kitchenCabinetDrawer', scale: 100 },
  oven:           { file: 'kitchenStoveElectric', scale: 100 },

  // Bathroom
  toilet:         { file: 'toilet', scale: 100 },
  bathtub:        { file: 'bathtub', scale: 100 },
  shower:         { file: 'shower', scale: 100 },
  sink_b:         { file: 'bathroomSink', scale: 100 },
  washer_dryer:   { file: 'washerDryerStacked', scale: 100 },

  // Office
  desk:           { file: 'tableCross', scale: 110 },
  office_chair:   { file: 'chairDesk', scale: 90 },

  // Dining
  dining_table:   { file: 'tableCross', scale: 100 },
  dining_chair:   { file: 'chair', scale: 90 },

  // Decor
  potted_plant:   { file: 'pottedPlant', scale: 80 },
  floor_plant:    { file: 'plantSmall1', scale: 100 },

  // Outdoor Furniture
  fire_pit:       { file: 'outdoor_campfire_stones', scale: 100 },
  campfire:       { file: 'outdoor_campfire_logs', scale: 100 },
  tent:           { file: 'outdoor_tent_detailedOpen', scale: 100 },
  outdoor_sign:   { file: 'outdoor_sign', scale: 100 },
  outdoor_pot_large: { file: 'outdoor_pot_large', scale: 100 },
  outdoor_pot_small: { file: 'outdoor_pot_small', scale: 100 },

  // Landscaping — Trees
  tree_oak:       { file: 'outdoor_tree_oak', scale: 100 },
  tree_default:   { file: 'outdoor_tree_default', scale: 100 },
  tree_detailed:  { file: 'outdoor_tree_detailed', scale: 100 },
  tree_pine:      { file: 'outdoor_tree_pineRoundA', scale: 100 },
  tree_pine_tall: { file: 'outdoor_tree_pineTallA_detailed', scale: 100 },
  tree_palm:      { file: 'outdoor_tree_palm', scale: 100 },
  tree_palm_bend: { file: 'outdoor_tree_palmBend', scale: 100 },
  tree_palm_tall: { file: 'outdoor_tree_palmTall', scale: 100 },
  tree_fat:       { file: 'outdoor_tree_fat', scale: 100 },
  tree_simple:    { file: 'outdoor_tree_simple', scale: 100 },
  tree_thin:      { file: 'outdoor_tree_thin', scale: 100 },
  tree_tall:      { file: 'outdoor_tree_tall', scale: 100 },
  tree_cone:      { file: 'outdoor_tree_cone', scale: 100 },
  tree_blocky:    { file: 'outdoor_tree_blocks', scale: 100 },
  tree_small:     { file: 'outdoor_tree_small', scale: 100 },

  // Landscaping — Bushes & Plants
  bush:           { file: 'outdoor_plant_bush', scale: 100 },
  bush_detailed:  { file: 'outdoor_plant_bushDetailed', scale: 100 },
  bush_large:     { file: 'outdoor_plant_bushLarge', scale: 100 },
  bush_large_triangle: { file: 'outdoor_plant_bushLargeTriangle', scale: 100 },
  bush_small:     { file: 'outdoor_plant_bushSmall', scale: 100 },
  bush_triangle:  { file: 'outdoor_plant_bushTriangle', scale: 100 },
  cactus_short:   { file: 'outdoor_cactus_short', scale: 100 },
  cactus_tall:    { file: 'outdoor_cactus_tall', scale: 100 },
  hanging_moss:   { file: 'outdoor_hanging_moss', scale: 100 },

  // Landscaping — Flowers
  flower_purple:  { file: 'outdoor_flower_purpleA', scale: 100 },
  flower_red:     { file: 'outdoor_flower_redA', scale: 100 },
  flower_yellow:  { file: 'outdoor_flower_yellowA', scale: 100 },
  flower_purple_b: { file: 'outdoor_flower_purpleB', scale: 100 },
  flower_red_b:   { file: 'outdoor_flower_redB', scale: 100 },
  flower_yellow_b: { file: 'outdoor_flower_yellowB', scale: 100 },
  lily:           { file: 'outdoor_lily_large', scale: 100 },

  // Landscaping — Grass
  grass_tuft:     { file: 'outdoor_grass', scale: 100 },
  grass_large:    { file: 'outdoor_grass_large', scale: 100 },
  grass_leafs:    { file: 'outdoor_grass_leafs', scale: 100 },
  grass_leafs_large: { file: 'outdoor_grass_leafsLarge', scale: 100 },

  // Landscaping — Rocks & Stones
  rock_large:     { file: 'outdoor_rock_largeA', scale: 100 },
  rock_large_b:   { file: 'outdoor_rock_largeB', scale: 100 },
  rock_tall:      { file: 'outdoor_rock_tallA', scale: 100 },
  rock_small:     { file: 'outdoor_rock_smallA', scale: 100 },
  rock_small_b:   { file: 'outdoor_rock_smallB', scale: 100 },
  stone_large:    { file: 'outdoor_stone_largeA', scale: 100 },
  stone_tall:     { file: 'outdoor_stone_tallA', scale: 100 },

  // Landscaping — Misc
  mushroom_red:   { file: 'outdoor_mushroom_red', scale: 100 },
  mushroom_group: { file: 'outdoor_mushroom_redGroup', scale: 100 },
  mushroom_tan:   { file: 'outdoor_mushroom_tan', scale: 100 },
  log_single:     { file: 'outdoor_log', scale: 100 },
  log_large:      { file: 'outdoor_log_large', scale: 100 },
  log_stack:      { file: 'outdoor_log_stack', scale: 100 },
  stump_old:      { file: 'outdoor_stump_old', scale: 100 },
  stump_round:    { file: 'outdoor_stump_round', scale: 100 },
  corn:           { file: 'outdoor_crops_cornStageD', scale: 100 },
  pumpkin:        { file: 'outdoor_crop_pumpkin', scale: 100 },
  statue_column:  { file: 'outdoor_statue_column', scale: 100 },
  obelisk:        { file: 'outdoor_statue_obelisk', scale: 100 },

  // Fencing
  fence_simple:   { file: 'outdoor_fence_simple', scale: 100 },
  fence_planks:   { file: 'outdoor_fence_planks', scale: 100 },
  fence_gate:     { file: 'outdoor_fence_gate', scale: 100 },
  fence_corner:   { file: 'outdoor_fence_corner', scale: 100 },
};

/**
 * Load a GLB model for the given catalog ID.
 * Returns a clone from cache if available, or loads async.
 * Returns null if no GLB mapping exists.
 */
function loadGLBModel(catalogId: string): Promise<THREE.Group | null> {
  const mapping = MODEL_MAP[catalogId];
  if (!mapping) return Promise.resolve(null);

  const cacheKey = mapping.file;

  // Return cached clone
  if (modelCache.has(cacheKey)) {
    return Promise.resolve(modelCache.get(cacheKey)!.clone());
  }

  // Return existing loading promise — clone from cache (not from resolved value, which may be mutated)
  if (loadingPromises.has(cacheKey)) {
    return loadingPromises.get(cacheKey)!.then(() => modelCache.has(cacheKey) ? modelCache.get(cacheKey)!.clone() : null);
  }

  const promise = new Promise<THREE.Group | null>((resolve) => {
    loader.load(
      catalogAssetUrl(`/models/${mapping.file}.glb`),
      (gltf) => {
        const group = new THREE.Group();
        // Clone the scene into our group
        gltf.scene.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });
        group.add(gltf.scene);
        modelCache.set(cacheKey, group);
        loadingPromises.delete(cacheKey);
        resolve(group.clone());
      },
      undefined,
      () => {
        // Load failed — fall back
        loadingPromises.delete(cacheKey);
        resolve(null);
      }
    );
  });

  loadingPromises.set(cacheKey, promise);
  return promise;
}

/**
 * Scale a GLB model to match our catalog dimensions.
 * Kenney models are unit-scale (~1m tall). We need to match our cm dimensions.
 */
function scaleToFit(model: THREE.Group, def: FurnitureDef, mapping: ModelMapping): void {
  // Compute the model's bounding box
  const box = new THREE.Box3().setFromObject(model);
  const size = new THREE.Vector3();
  box.getSize(size);

  const EPSILON = 0.001;
  if (size.x < EPSILON || size.y < EPSILON || size.z < EPSILON) return;

  // Detect Z-up orientation: only rotate if Y is near-zero (truly flat/degenerate)
  // Don't rotate models that are just naturally short (like beds, tables)
  if (size.y < 0.01 && size.z > size.y * 10) {
    model.rotation.x = -Math.PI / 2;
    model.updateMatrixWorld(true);
    // Recompute bounding box after rotation
    box.setFromObject(model);
    box.getSize(size);
  }

  // Scale to match our catalog dimensions (in cm) — non-uniform to fill exact footprint
  // Our convention: width=X, height=Y, depth=Z
  const scaleX = def.width / size.x;
  const scaleY = def.height / size.y;
  const scaleZ = def.depth / size.z;

  model.scale.set(scaleX, scaleY, scaleZ);

  // Re-center at origin after scaling
  const scaledBox = new THREE.Box3().setFromObject(model);
  const center = new THREE.Vector3();
  scaledBox.getCenter(center);
  model.position.sub(center);
  // Put bottom on ground plane
  model.position.y -= scaledBox.min.y;

  // Recompute after repositioning
  const finalBox = new THREE.Box3().setFromObject(model);
  model.position.y -= finalBox.min.y;
}

/**
 * Create a furniture model — tries GLB first, falls back to procedural.
 * Returns immediately with procedural model, then replaces with GLB when loaded.
 */
export function createFurnitureModelWithGLB(
  catalogId: string,
  def: FurnitureDef,
  onLoaded?: (model: THREE.Group) => void
): THREE.Group {
  const container = new THREE.Group();
  container.name = `furniture_${catalogId}`;

  // Start with procedural model immediately
  const procedural = createFurnitureModel(catalogId, def);
  container.add(procedural);

  // Try to load GLB async
  const mapping = MODEL_MAP[catalogId];
  if (mapping) {
    loadGLBModel(catalogId).then((glbModel) => {
      if (glbModel) {
        try {
          // Remove procedural and dispose its resources, then add GLB
          container.remove(procedural);
          procedural.traverse((obj: any) => {
            if (obj.geometry) obj.geometry.dispose();
            if (obj.material) {
              if (Array.isArray(obj.material)) obj.material.forEach((m: any) => m.dispose());
              else obj.material.dispose();
            }
          });
          scaleToFit(glbModel, def, mapping);
          container.add(glbModel);
          onLoaded?.(container);
        } catch (err) {
          // scaleToFit or GLB add failed — fall back to procedural
          console.warn(`[FurnitureLoader] GLB error for ${catalogId}:`, err);
          container.add(procedural);
        }
      }
    });
  }

  return container;
}

/** Check if a catalog item has a GLB model available */
export function hasGLBModel(catalogId: string): boolean {
  return catalogId in MODEL_MAP;
}

/** Preload all mapped models */
export function preloadModels(): void {
  for (const catalogId of Object.keys(MODEL_MAP)) {
    loadGLBModel(catalogId);
  }
}
