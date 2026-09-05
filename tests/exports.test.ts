import { beforeEach, expect, it, vi } from 'vitest';
import { exportAsSVG, exportAsPNG, exportPDF } from '$lib/utils/export';
import { exportDXF } from '$lib/utils/cadExport';
import { resolveRooms } from '$lib/utils/roomDetection';
import { rectangleWalls, roomProject } from './fixtures/project';

const { pdfText, pdfSave } = vi.hoisted(() => ({ pdfText: vi.fn(), pdfSave: vi.fn() }));
vi.mock('jspdf', () => ({ default: class {
  constructor() {
    return new Proxy({
      text: pdfText, save: pdfSave,
      internal: { pageSize: { getWidth: () => 297, getHeight: () => 210 } },
    }, { get: (target, key) => target[key as keyof typeof target] ?? (() => {}) });
  }
} }));

let downloaded: Blob[];
const canvasText = vi.fn();
let canvas: HTMLCanvasElement;

beforeEach(() => {
  downloaded = [];
  canvasText.mockClear(); pdfText.mockClear(); pdfSave.mockClear();
  const ctx = new Proxy({ fillText: canvasText, measureText: () => ({ width: 30 }) }, {
    get: (target, key) => target[key as keyof typeof target] ?? (() => {}),
  });
  canvas = { width: 400, height: 300, getContext: () => ctx, toDataURL: () => 'data:image/png;base64,test',
    toBlob: (callback: BlobCallback) => callback(new Blob(['png'])) } as unknown as HTMLCanvasElement;
  vi.stubGlobal('document', {
    createElement: (tag: string) => tag === 'canvas' ? canvas : { click: vi.fn() },
    querySelectorAll: () => [],
  });
  vi.spyOn(URL, 'createObjectURL').mockImplementation(blob => { downloaded.push(blob as Blob); return 'blob:test'; });
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
});

function namedProject() {
  const project = roomProject();
  const floor = project.floors[0];
  floor.rooms = resolveRooms(floor).map(room => ({ ...room, name: 'Kitchen & Dining <East>' }));
  return project;
}

it('writes the saved room name into a real SVG download with XML escaping', async () => {
  exportAsSVG(namedProject());
  expect(downloaded).toHaveLength(1);
  const svg = await downloaded[0].text();
  expect(svg).toContain('Kitchen &amp; Dining &lt;East&gt;');
  expect(svg).not.toContain('Room 1');
});

it('writes the saved room name into a real DXF download', async () => {
  exportDXF(namedProject());
  expect(downloaded).toHaveLength(1);
  const dxf = await downloaded[0].text();
  expect(dxf).toContain('Kitchen & Dining <East>');
  expect(dxf).not.toContain('Room 1');
});

it('uses the saved name when drawing the PNG export', () => {
  exportAsPNG(canvas, namedProject());
  expect(canvasText.mock.calls.map(call => call[0])).toContain('Kitchen & Dining <East>');
});

it('uses saved names and distinct textures for same-name rooms in the PDF schedule', () => {
  const project = roomProject();
  const floor = project.floors[0];
  floor.walls.push(...rectangleWalls('b', 600));
  floor.rooms = resolveRooms(floor).map((room, i) => ({ ...room, name: 'Bedroom', floorTexture: i ? 'tile' : 'carpet' }));
  exportPDF(project);
  const text = pdfText.mock.calls.map(call => call[0]);
  expect(text.filter(value => value === 'Bedroom')).toHaveLength(2);
  expect(text).toContain('carpet');
  expect(text).toContain('tile');
  expect(text).not.toContain('Room 1');
  expect(pdfSave).toHaveBeenCalledOnce();
});
