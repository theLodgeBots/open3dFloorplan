import { createDefaultProject } from '$lib/stores/project';
import type { Wall } from '$lib/models/types';

export function rectangleWalls(prefix = 'a', x = 0): Wall[] {
  const points = [{ x, y: 0 }, { x: x + 400, y: 0 }, { x: x + 400, y: 300 }, { x, y: 300 }];
  return points.map((start, i) => ({
    id: `${prefix}-${i}`, start, end: points[(i + 1) % 4], thickness: 15, height: 250,
    color: '#eeeeee',
  }));
}

export function roomProject() {
  const project = createDefaultProject('Regression plan');
  project.floors[0].walls = rectangleWalls();
  return project;
}
