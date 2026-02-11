import type { Project } from '$lib/models/types';

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportAsPNG(canvas: HTMLCanvasElement) {
  canvas.toBlob((blob) => {
    if (blob) download(blob, 'floorplan-2d.png');
  });
}

export function exportAsJSON(project: Project) {
  const json = JSON.stringify(project, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  download(blob, `${project.name || 'project'}.json`);
}

export function exportAs3DPNG(renderer: THREE.WebGLRenderer) {
  renderer.domElement.toBlob((blob) => {
    if (blob) download(blob, 'floorplan-3d.png');
  });
}
