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
  sofa:           { file: 'loungeSofaLong', scale: 110 },
  loveseat:       { file: 'loungeSofa', scale: 100 },
  chair:          { file: 'loungeChair', scale: 95 },
  coffee_table:   { file: 'tableCoffee', scale: 100 },
  tv_stand:       { file: 'cabinetTelevision', scale: 100 },
  bookshelf:      { file: 'bookcaseOpen', scale: 100 },
  side_table:     { file: 'sideTable', scale: 80 },
  fireplace:      { file: 'toaster', scale: 100 }, // placeholder
  television:     { file: 'televisionModern', scale: 100 },
  storage:        { file: 'bookcaseClosed', scale: 100 },
  table:          { file: 'table', scale: 100 },

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
  desk:           { file: 'desk', scale: 110 },
  office_chair:   { file: 'chairDesk', scale: 90 },

  // Dining
  dining_table:   { file: 'tableRound', scale: 100 },
  dining_chair:   { file: 'chair', scale: 90 },

  // Decor
  potted_plant:   { file: 'pottedPlant', scale: 80 },
  floor_plant:    { file: 'plantSmall1', scale: 100 },
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
      `/models/${mapping.file}.glb`,
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

  if (size.x === 0 || size.y === 0 || size.z === 0) return;

  // Scale to match our catalog dimensions (in cm)
  // Our convention: width=X, height=Y, depth=Z
  const scaleX = def.width / size.x;
  const scaleY = def.height / size.y;
  const scaleZ = def.depth / size.z;
  const uniformScale = Math.min(scaleX, scaleY, scaleZ);

  model.scale.setScalar(uniformScale);

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
          // Remove procedural, add GLB
          container.remove(procedural);
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
