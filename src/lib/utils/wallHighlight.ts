import * as THREE from 'three';

/** Highlights borrow textures and own only their material clones. Restore the
 * originals before scene disposal so neither set of materials is orphaned. */
export function createWallHighlight() {
  const originals = new Map<THREE.Mesh, THREE.Material | THREE.Material[]>();
  const clones = new Map<THREE.Material, THREE.Material>();
  function clear() {
    for (const [mesh, material] of originals) mesh.material = material;
    originals.clear();
    for (const material of clones.values()) material.dispose();
    clones.clear();
  }
  function clone(material: THREE.Material) {
    if (!clones.has(material)) {
      const highlighted = material.clone();
      if (highlighted instanceof THREE.MeshStandardMaterial) {
        highlighted.emissive.set(0x3388ff);
        highlighted.emissiveIntensity = 0.3;
      }
      clones.set(material, highlighted);
    }
    return clones.get(material)!;
  }
  return {
    clear,
    apply(meshes: ReadonlyMap<THREE.Object3D, string>, id: string | null) {
      clear();
      if (!id) return;
      for (const [mesh, wallId] of meshes) if (wallId === id && mesh instanceof THREE.Mesh) {
        originals.set(mesh, mesh.material);
        mesh.material = Array.isArray(mesh.material) ? mesh.material.map(clone) : clone(mesh.material);
      }
    }
  };
}
