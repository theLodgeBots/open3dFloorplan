import type { Project } from '$lib/models/types';

/** Keep recovery available without loading export/rendering chunks after an update. */
export function downloadProjectJSON(project: Project) {
  const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${project.name || 'project'}.json`;
  link.click();
  URL.revokeObjectURL(url);
}
