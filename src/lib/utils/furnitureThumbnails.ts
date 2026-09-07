/**
 * Furniture Thumbnail Generator
 * Renders GLB models to small preview images using an offscreen Three.js renderer.
 * Cached as data URLs after first render.
 */
import * as THREE from 'three';
import { disposeModel, loadCatalogModel } from './furnitureModelResources';

const SIZE = 128;
const cache = new Map<string, string>();
const pending = new Map<string, Promise<string | null>>();

let renderer: THREE.WebGLRenderer | null = null;
let scene: THREE.Scene | null = null;
let camera: THREE.OrthographicCamera | null = null;

function ensureRenderer() {
  if (renderer) return;
  renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
  renderer.setSize(SIZE, SIZE);
  renderer.setPixelRatio(1);
  renderer.setClearColor(0x000000, 0);

  scene = new THREE.Scene();

  // Lighting
  const ambient = new THREE.AmbientLight(0xffffff, 0.8);
  scene.add(ambient);
  const dir = new THREE.DirectionalLight(0xffffff, 1.2);
  dir.position.set(2, 4, 3);
  scene.add(dir);
  const fill = new THREE.DirectionalLight(0xffffff, 0.4);
  fill.position.set(-2, 1, -1);
  scene.add(fill);

  camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 100);
}

export function getThumbnail(file: string): string | null {
  return cache.get(file) ?? null;
}

export async function generateThumbnail(file: string): Promise<string | null> {
  if (cache.has(file)) return cache.get(file)!;
  if (pending.has(file)) return pending.get(file)!;

  const promise = (async () => {
    let model: THREE.Group | null = null;
    try {
      ensureRenderer();
      model = await loadCatalogModel(file);
      if (!model) return null;

      // Clear scene of previous models (keep lights)
      const toRemove: THREE.Object3D[] = [];
      scene!.children.forEach(c => { if (!(c instanceof THREE.Light)) toRemove.push(c); });
      toRemove.forEach(c => scene!.remove(c));

      scene!.add(model);

      // Fit camera to model
      const box = new THREE.Box3().setFromObject(model);
      const size = new THREE.Vector3();
      const center = new THREE.Vector3();
      box.getSize(size);
      box.getCenter(center);

      const maxDim = Math.max(size.x, size.y, size.z);
      if (maxDim === 0) return null;

      const pad = 1.3;
      const half = (maxDim * pad) / 2;
      camera!.left = -half;
      camera!.right = half;
      camera!.top = half;
      camera!.bottom = -half;
      camera!.near = 0.01;
      camera!.far = maxDim * 10;

      // Isometric-ish angle
      const dist = maxDim * 2;
      camera!.position.set(
        center.x + dist * 0.7,
        center.y + dist * 0.8,
        center.z + dist * 0.7
      );
      camera!.lookAt(center);
      camera!.updateProjectionMatrix();

      renderer!.render(scene!, camera!);
      const dataUrl = renderer!.domElement.toDataURL('image/png');

      scene!.remove(model);
      cache.set(file, dataUrl);
      return dataUrl;
    } catch {
      return null;
    } finally {
      if (model) { scene?.remove(model); disposeModel(model); }
      pending.delete(file);
    }
  })();

  pending.set(file, promise);
  return promise;
}
