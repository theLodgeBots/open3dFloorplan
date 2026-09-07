/** Lazy GLB furniture with an immediate procedural fallback. */
import * as THREE from 'three';
import { createFurnitureModel } from './furnitureModels3d';
import type { FurnitureDef } from './furnitureCatalog';
import { getModelFile } from './furnitureModelFiles';
import { furnitureFinishes } from './furnitureFinishes';
import { disposeModel, isModelDisposed, loadCatalogModel } from './furnitureModelResources';

export interface FurnitureAppearance { color?: string; material?: string; ghost?: boolean }

function applyAppearance(model: THREE.Group, appearance: FurnitureAppearance, tint: boolean) {
  const seen = new Set<THREE.Material>();
  model.traverse(child => {
    if (!(child instanceof THREE.Mesh)) return;
    for (const material of Array.isArray(child.material) ? child.material : [child.material]) {
      if (seen.has(material)) continue;
      seen.add(material);
      if (!(material instanceof THREE.MeshStandardMaterial)) continue;
      // A tint keeps the source model's texture and contrasting material detail.
      if (tint && appearance.color) material.color.multiply(new THREE.Color(appearance.color));
      const finish = appearance.material && Object.hasOwn(furnitureFinishes, appearance.material) ? furnitureFinishes[appearance.material] : undefined;
      if (finish) {
        material.roughness = finish.roughness; material.metalness = finish.metalness;
        if (finish.opacity !== undefined) {
          material.opacity *= finish.opacity; material.transparent = true; material.depthWrite = false;
        }
      }
      if (appearance.ghost) {
        material.transparent = true; material.opacity *= 0.5; material.depthWrite = false;
        material.emissive.set(0x4488ff); material.emissiveIntensity = 0.3;
      }
    }
  });
}

/** Match the complete model's footprint, center it, and place its bottom at zero. */
export function fitFurnitureModel(model: THREE.Group, def: FurnitureDef) {
  const bounds = new THREE.Box3().setFromObject(model), size = bounds.getSize(new THREE.Vector3());
  if ([size.x, size.y, size.z, def.width, def.height, def.depth].some(value => !Number.isFinite(value) || value <= 0)) {
    throw new Error('Furniture model has invalid dimensions.');
  }
  model.scale.multiply(new THREE.Vector3(def.width / size.x, def.height / size.y, def.depth / size.z));
  model.updateMatrixWorld(true);
  bounds.setFromObject(model);
  const center = bounds.getCenter(new THREE.Vector3());
  model.position.sub(new THREE.Vector3(center.x, bounds.min.y, center.z));
  model.updateMatrixWorld(true);
}

export function createFurnitureModelWithGLB(
  catalogId: string, def: FurnitureDef, onLoaded?: (model: THREE.Group) => void,
  appearance: FurnitureAppearance = {},
): THREE.Group {
  const container = new THREE.Group();
  container.name = `furniture_${catalogId}`;
  const procedural = createFurnitureModel(catalogId, def);
  applyAppearance(procedural, appearance, false);
  container.add(procedural);
  const file = getModelFile(catalogId);
  if (file) void loadCatalogModel(file).then(model => {
    if (!model) return;
    if (isModelDisposed(container)) { disposeModel(model); return; }
    try {
      fitFurnitureModel(model, def);
      applyAppearance(model, appearance, true);
    } catch {
      disposeModel(model);
      return; // The original fallback remains intact and usable.
    }
    container.remove(procedural); disposeModel(procedural);
    container.add(model);
    onLoaded?.(container);
  }).catch(error => { console.warn(`[FurnitureLoader] Model unavailable for ${catalogId}:`, error); });
  return container;
}
