import { expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { createWallHighlight } from '$lib/utils/wallHighlight';
import { disposeModel, ownTexture } from '$lib/utils/furnitureModelResources';

it('repeated wall selections dispose every clone without changing shared originals or textures', () => {
  const texture = ownTexture(new THREE.Texture());
  const original = new THREE.MeshStandardMaterial({ map: texture });
  const materialDisposed = vi.spyOn(original, 'dispose'), textureDisposed = vi.spyOn(texture, 'dispose');
  const selected = new THREE.Mesh(new THREE.BoxGeometry(), [original, original]);
  const shared = new THREE.Mesh(selected.geometry, original);
  const meshes = new Map<THREE.Object3D, string>([[selected, 'a'], [shared, 'b']]);
  const highlight = createWallHighlight();
  const disposals: ReturnType<typeof vi.fn>[] = [];
  for (let i = 0; i < 100; i++) {
    highlight.apply(meshes, 'a');
    const materials = selected.material as THREE.MeshStandardMaterial[];
    expect(materials[0]).toBe(materials[1]);
    expect(materials[0].emissive.getHexString()).toBe('3388ff');
    expect(materials[0].map).toBe(texture);
    expect(shared.material).toBe(original);
    expect(original.emissive.getHexString()).toBe('000000');
    const disposed = vi.fn(); materials[0].addEventListener('dispose', disposed); disposals.push(disposed);
    highlight.apply(meshes, null);
    expect(selected.material).toEqual([original, original]);
  }
  highlight.clear();
  expect(disposals).toHaveLength(100);
  for (const disposed of disposals) expect(disposed).toHaveBeenCalledTimes(1);
  expect(materialDisposed).not.toHaveBeenCalled(); expect(textureDisposed).not.toHaveBeenCalled();
  const scene = new THREE.Group(); scene.add(selected, shared); disposeModel(scene);
  expect(materialDisposed).toHaveBeenCalledTimes(1); expect(textureDisposed).toHaveBeenCalledTimes(1);
});

it('restores originals before scene disposal and highlights replacements after a rebuild', () => {
  const highlight = createWallHighlight();
  for (let rebuild = 0; rebuild < 10; rebuild++) {
    const original = new THREE.MeshStandardMaterial();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(), original);
    const scene = new THREE.Group(); scene.add(mesh);
    const disposed = vi.spyOn(original, 'dispose');
    highlight.apply(new Map([[mesh, 'a']]), 'a');
    const cloneDisposed = vi.spyOn(mesh.material, 'dispose');
    highlight.clear(); disposeModel(scene);
    expect(cloneDisposed).toHaveBeenCalledTimes(1);
    expect(disposed).toHaveBeenCalledTimes(1);
  }
});

it('owns scene texture wrappers while retaining borrowed texture images and templates', () => {
  const canvas = { width: 256, height: 64 }; // shared decoded/cached image source
  const owned = ownTexture(new THREE.Texture(canvas)), borrowed = new THREE.Texture(canvas);
  const ownedDisposed = vi.spyOn(owned, 'dispose'), borrowedDisposed = vi.spyOn(borrowed, 'dispose');
  const scene = new THREE.Group();
  scene.add(new THREE.Sprite(new THREE.SpriteMaterial({ map: owned })));
  scene.add(new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial({ map: borrowed })));
  disposeModel(scene); disposeModel(scene);
  expect(ownedDisposed).toHaveBeenCalledTimes(1); expect(borrowedDisposed).not.toHaveBeenCalled();
  expect(owned.image).toBe(canvas); expect(borrowed.image).toBe(canvas);
});
