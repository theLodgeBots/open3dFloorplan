import type { Project } from '$lib/models/types';
import { getCatalogItem } from '$lib/utils/furnitureCatalog';
import { detectRooms, getRoomPolygon, roomCentroid } from '$lib/utils/roomDetection';
import { projectSettings, formatArea } from '$lib/stores/settings';
import { get } from 'svelte/store';
import jsPDF from 'jspdf';

/** Escape text for safe SVG embedding */
function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Export the full floor plan as a high-resolution PNG.
 * Renders all walls/rooms/doors/furniture onto an offscreen canvas
 * so the export isn't limited to the current viewport.
 */
export function exportAsPNG(canvas: HTMLCanvasElement, project?: Project) {
  const name = project?.name || 'floorplan';

  if (project) {
    const floor = project.floors.find(f => f.id === project.activeFloorId) ?? project.floors[0];
    if (floor && floor.walls.length > 0) {
      // Compute bounds of all geometry
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const w of floor.walls) {
        for (const p of [w.start, w.end]) {
          minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
          maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
        }
      }
      for (const fi of floor.furniture) {
        minX = Math.min(minX, fi.position.x - 50);
        minY = Math.min(minY, fi.position.y - 50);
        maxX = Math.max(maxX, fi.position.x + 50);
        maxY = Math.max(maxY, fi.position.y + 50);
      }
      const pad = 80;
      const w = maxX - minX + pad * 2;
      const h = maxY - minY + pad * 2;
      // Scale up for high-res (2x)
      const scale = 2;
      const offscreen = document.createElement('canvas');
      offscreen.width = w * scale;
      offscreen.height = h * scale;
      const ctx = offscreen.getContext('2d')!;
      ctx.scale(scale, scale);
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, w, h);

      // Draw room fills
      const ROOM_COLORS = ['#bfdbfe', '#fde68a', '#bbf7d0', '#fecaca', '#ddd6fe', '#a5f3fc', '#fed7aa'];
      const rooms = detectRooms(floor.walls);
      for (let ri = 0; ri < rooms.length; ri++) {
        const room = rooms[ri];
        const poly = getRoomPolygon(room, floor.walls);
        if (poly.length < 3) continue;
        ctx.fillStyle = ROOM_COLORS[ri % ROOM_COLORS.length];
        ctx.globalAlpha = 0.4;
        ctx.beginPath();
        ctx.moveTo(poly[0].x - minX + pad, poly[0].y - minY + pad);
        for (let i = 1; i < poly.length; i++) {
          ctx.lineTo(poly[i].x - minX + pad, poly[i].y - minY + pad);
        }
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 1;
        // Room label
        const c = roomCentroid(poly);
        ctx.fillStyle = '#444';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(room.name, c.x - minX + pad, c.y - minY + pad);
        ctx.fillStyle = '#888';
        ctx.font = '10px sans-serif';
        ctx.fillText(formatArea(room.area, get(projectSettings).units), c.x - minX + pad, c.y - minY + pad + 14);
      }

      // Draw walls
      ctx.strokeStyle = '#333';
      ctx.lineCap = 'round';
      for (const wall of floor.walls) {
        ctx.lineWidth = wall.thickness;
        ctx.beginPath();
        ctx.moveTo(wall.start.x - minX + pad, wall.start.y - minY + pad);
        ctx.lineTo(wall.end.x - minX + pad, wall.end.y - minY + pad);
        ctx.stroke();
        // Dimension label
        const len = Math.round(Math.hypot(wall.end.x - wall.start.x, wall.end.y - wall.start.y));
        const mx = (wall.start.x + wall.end.x) / 2 - minX + pad;
        const my = (wall.start.y + wall.end.y) / 2 - minY + pad;
        ctx.fillStyle = '#666';
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`${len} cm`, mx, my - 8);
      }

      // Draw doors
      for (const d of floor.doors) {
        const wall = floor.walls.find(wl => wl.id === d.wallId);
        if (!wall) continue;
        const dx = wall.end.x - wall.start.x;
        const dy = wall.end.y - wall.start.y;
        const px = wall.start.x + dx * d.position - minX + pad;
        const py = wall.start.y + dy * d.position - minY + pad;
        ctx.fillStyle = '#8B4513';
        ctx.beginPath();
        ctx.arc(px, py, 4, 0, Math.PI * 2);
        ctx.fill();
      }

      // Draw furniture
      for (const fi of floor.furniture) {
        const fx = fi.position.x - minX + pad;
        const fy = fi.position.y - minY + pad;
        const cat = getCatalogItem(fi.catalogId);
        const fw = fi.width ?? (cat ? cat.width : 30);
        const fd = fi.depth ?? (cat ? cat.depth : 30);
        const color = fi.color ?? (cat ? cat.color : '#a0c4e8');
        const rot = (fi.rotation || 0) * Math.PI / 180;
        ctx.save();
        ctx.translate(fx, fy);
        ctx.rotate(rot);
        ctx.globalAlpha = 0.7;
        ctx.fillStyle = color;
        ctx.fillRect(-fw / 2, -fd / 2, fw, fd);
        ctx.strokeStyle = '#555';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(-fw / 2, -fd / 2, fw, fd);
        ctx.globalAlpha = 1;
        if (cat) {
          ctx.fillStyle = '#333';
          ctx.font = '9px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(cat.name, 0, 4);
        }
        ctx.restore();
      }

      // Title
      ctx.fillStyle = '#222';
      ctx.font = 'bold 16px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`${name} — ${floor.name}`, 20, 24);

      offscreen.toBlob((blob) => {
        if (blob) download(blob, `${name}.png`);
      });
      return;
    }
  }

  // Fallback: just capture the viewport canvas
  canvas.toBlob((blob) => {
    if (blob) download(blob, `${name}-2d.png`);
  });
}

export function exportAsJSON(project: Project) {
  const json = JSON.stringify(project, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  download(blob, `${project.name || 'project'}.json`);
}

export function exportAsSVG(project: Project) {
  const floor = project.floors.find(f => f.id === project.activeFloorId) ?? project.floors[0];
  if (!floor || floor.walls.length === 0) return;

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const w of floor.walls) {
    for (const p of [w.start, w.end]) {
      minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
    }
  }
  const pad = 50;
  const vw = maxX - minX + pad * 2;
  const vh = maxY - minY + pad * 2;

  let paths = '';

  // Room fills
  const ROOM_COLORS_SVG = ['#bfdbfe', '#fde68a', '#bbf7d0', '#fecaca', '#ddd6fe', '#a5f3fc', '#fed7aa'];
  const rooms = detectRooms(floor.walls);
  for (let ri = 0; ri < rooms.length; ri++) {
    const room = rooms[ri];
    const poly = getRoomPolygon(room, floor.walls);
    if (poly.length < 3) continue;
    const pts = poly.map(p => `${p.x - minX + pad},${p.y - minY + pad}`).join(' ');
    const color = ROOM_COLORS_SVG[ri % ROOM_COLORS_SVG.length];
    paths += `  <polygon points="${pts}" fill="${color}" fill-opacity="0.4" stroke="none"/>\n`;
    const c = roomCentroid(poly);
    const cx = c.x - minX + pad;
    const cy = c.y - minY + pad;
    paths += `  <text x="${cx}" y="${cy}" text-anchor="middle" font-size="12" fill="#444" font-family="sans-serif" font-weight="bold">${escapeXml(room.name)}</text>\n`;
    paths += `  <text x="${cx}" y="${cy + 14}" text-anchor="middle" font-size="10" fill="#888" font-family="sans-serif">${formatArea(room.area, get(projectSettings).units)}</text>\n`;
  }

  for (const w of floor.walls) {
    const x1 = w.start.x - minX + pad;
    const y1 = w.start.y - minY + pad;
    const x2 = w.end.x - minX + pad;
    const y2 = w.end.y - minY + pad;
    paths += `  <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#333" stroke-width="${w.thickness}" stroke-linecap="round"/>\n`;
    // dimension label
    const len = Math.round(Math.hypot(x2 - x1, y2 - y1));
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2;
    paths += `  <text x="${mx}" y="${my - 8}" text-anchor="middle" font-size="11" fill="#666" font-family="sans-serif">${len} cm</text>\n`;
  }

  // Draw doors as arcs
  for (const d of floor.doors) {
    const wall = floor.walls.find(w => w.id === d.wallId);
    if (!wall) continue;
    const dx = wall.end.x - wall.start.x;
    const dy = wall.end.y - wall.start.y;
    const len = Math.hypot(dx, dy);
    const t = d.position;
    const px = wall.start.x + dx * t - minX + pad;
    const py = wall.start.y + dy * t - minY + pad;
    paths += `  <circle cx="${px}" cy="${py}" r="4" fill="#8B4513"/>\n`;
  }

  // Furniture rectangles (actual dimensions from catalog)
  for (const fi of floor.furniture) {
    const fx = fi.position.x - minX + pad;
    const fy = fi.position.y - minY + pad;
    const cat = getCatalogItem(fi.catalogId);
    const fw = fi.width ?? (cat ? cat.width : 30);
    const fd = fi.depth ?? (cat ? cat.depth : 30);
    const color = fi.color ?? (cat ? cat.color : '#a0c4e8');
    const rot = fi.rotation || 0;
    paths += `  <g transform="translate(${fx},${fy}) rotate(${rot})">\n`;
    paths += `    <rect x="${-fw / 2}" y="${-fd / 2}" width="${fw}" height="${fd}" fill="${color}" stroke="#555" stroke-width="0.5" rx="2" opacity="0.7"/>\n`;
    if (cat) {
      paths += `    <text x="0" y="4" text-anchor="middle" font-size="9" fill="#333" font-family="sans-serif">${escapeXml(cat.name)}</text>\n`;
    }
    paths += `  </g>\n`;
  }

  // Measurements
  if (floor.measurements) {
    for (const m of floor.measurements) {
      const x1 = m.x1 - minX + pad, y1 = m.y1 - minY + pad;
      const x2 = m.x2 - minX + pad, y2 = m.y2 - minY + pad;
      paths += `  <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#ef4444" stroke-width="1" stroke-dasharray="6,3" stroke-linecap="round"/>\n`;
      const dist = Math.round(Math.hypot(m.x2 - m.x1, m.y2 - m.y1));
      const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
      paths += `  <text x="${mx}" y="${my - 6}" text-anchor="middle" font-size="10" fill="#ef4444" font-family="sans-serif" font-weight="bold">${dist} cm</text>\n`;
    }
  }

  // Annotations (dimension callouts)
  if (floor.annotations) {
    for (const a of floor.annotations) {
      const ax1 = a.x1 - minX + pad, ay1 = a.y1 - minY + pad;
      const ax2 = a.x2 - minX + pad, ay2 = a.y2 - minY + pad;
      const dx = ax2 - ax1, dy = ay2 - ay1;
      const len = Math.hypot(dx, dy);
      if (len < 1) continue;
      const ux = dx / len, uy = dy / len;
      const nx = -uy, ny = ux;
      const offset = a.offset || 40;
      const d1x = ax1 + nx * offset, d1y = ay1 + ny * offset;
      const d2x = ax2 + nx * offset, d2y = ay2 + ny * offset;
      // Leader lines
      paths += `  <line x1="${ax1}" y1="${ay1}" x2="${d1x}" y2="${d1y}" stroke="#6366f1" stroke-width="0.75"/>\n`;
      paths += `  <line x1="${ax2}" y1="${ay2}" x2="${d2x}" y2="${d2y}" stroke="#6366f1" stroke-width="0.75"/>\n`;
      // Dimension line
      paths += `  <line x1="${d1x}" y1="${d1y}" x2="${d2x}" y2="${d2y}" stroke="#6366f1" stroke-width="1"/>\n`;
      // Arrowheads
      const arrowLen = 7, arrowW = 3;
      for (const [px, py, dir] of [[d1x, d1y, 1], [d2x, d2y, -1]] as [number, number, number][]) {
        const adx = ux * arrowLen * dir, ady = uy * arrowLen * dir;
        const apx = -uy * arrowW, apy = ux * arrowW;
        paths += `  <polygon points="${px},${py} ${px + adx + apx},${py + ady + apy} ${px + adx - apx},${py + ady - apy}" fill="#6366f1"/>\n`;
      }
      // Label
      const dist = Math.round(Math.hypot(a.x2 - a.x1, a.y2 - a.y1));
      const label = a.label || `${dist} cm`;
      const mx = (d1x + d2x) / 2, my = (d1y + d2y) / 2;
      paths += `  <text x="${mx}" y="${my - 4}" text-anchor="middle" font-size="10" fill="#6366f1" font-family="sans-serif">${escapeXml(label)}</text>\n`;
    }
  }

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${vw} ${vh}" width="${vw}" height="${vh}">
  <rect width="100%" height="100%" fill="white"/>
${paths}</svg>`;

  const blob = new Blob([svg], { type: 'image/svg+xml' });
  download(blob, `${project.name || 'floorplan'}.svg`);
}

export function exportAs3DPNG(renderer: THREE.WebGLRenderer) {
  renderer.domElement.toBlob((blob) => {
    if (blob) download(blob, 'floorplan-3d.png');
  });
}

export function exportPDF(project: Project) {
  const floor = project.floors.find(f => f.id === project.activeFloorId) ?? project.floors[0];
  if (!floor || floor.walls.length === 0) return;

  // Create PDF in A4 landscape orientation
  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  
  // Get the 2D canvas (floor plan canvas)
  const canvas = document.querySelector('canvas') as HTMLCanvasElement;
  if (!canvas) {
    alert('Canvas not found. Please make sure the 2D view is visible.');
    return;
  }

  // Convert canvas to image data
  const imgData = canvas.toDataURL('image/png');
  
  // Calculate dimensions to fit the image on the page with margins
  const margin = 20;
  const maxWidth = pageWidth - (margin * 2);
  const maxHeight = pageHeight - (margin * 3) - 30; // Extra space for title and footer
  
  // Calculate aspect ratio and fitting dimensions
  const aspectRatio = canvas.width / canvas.height;
  let imgWidth = maxWidth;
  let imgHeight = maxWidth / aspectRatio;
  
  if (imgHeight > maxHeight) {
    imgHeight = maxHeight;
    imgWidth = maxHeight * aspectRatio;
  }
  
  // Center the image
  const imgX = (pageWidth - imgWidth) / 2;
  const imgY = margin + 20; // Space for title
  
  // Add title
  pdf.setFontSize(18);
  pdf.setFont(undefined, 'bold');
  const title = `Floor Plan — ${floor.name}`;
  const titleWidth = pdf.getTextWidth(title);
  pdf.text(title, (pageWidth - titleWidth) / 2, margin + 10);
  
  // Add the floor plan image
  pdf.addImage(imgData, 'PNG', imgX, imgY, imgWidth, imgHeight);
  
  // Add scale indicator (approximate)
  pdf.setFontSize(10);
  pdf.setFont(undefined, 'normal');
  const scaleText = 'Scale: 1:1 (approximate)';
  pdf.text(scaleText, margin, imgY + imgHeight + 10);
  
  // Add date in footer
  const today = new Date().toLocaleDateString();
  const footerText = `Generated on ${today}`;
  const footerWidth = pdf.getTextWidth(footerText);
  pdf.text(footerText, pageWidth - margin - footerWidth, pageHeight - 10);
  
  // Save the PDF
  const filename = `${project.name || 'floorplan'}.pdf`;
  pdf.save(filename);
}
