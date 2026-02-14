<script lang="ts">
  import { currentProject } from '$lib/stores/project';
  import { get } from 'svelte/store';
  import { getRoomPolygon, roomCentroid } from '$lib/utils/roomDetection';
  import { formatArea } from '$lib/stores/settings';
  import { onMount } from 'svelte';
  import type { Project, Floor, Wall, Room } from '$lib/models/types';

  let { open = $bindable(false) } = $props();

  let pageSize = $state<'a4' | 'letter'>('letter');
  let orientation = $state<'landscape' | 'portrait'>('landscape');
  let scale = $state('1:50');
  let printCanvas: HTMLCanvasElement;

  const scaleOptions = ['1:25', '1:50', '1:100', '1:200'];

  function getActiveFloor(project: Project): Floor | undefined {
    return project.floors.find(f => f.id === project.activeFloorId) ?? project.floors[0];
  }

  function computeBounds(walls: Wall[]): { minX: number; minY: number; maxX: number; maxY: number } {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const w of walls) {
      for (const p of [w.start, w.end]) {
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
      }
      if (w.curvePoint) {
        if (w.curvePoint.x < minX) minX = w.curvePoint.x;
        if (w.curvePoint.y < minY) minY = w.curvePoint.y;
        if (w.curvePoint.x > maxX) maxX = w.curvePoint.x;
        if (w.curvePoint.y > maxY) maxY = w.curvePoint.y;
      }
    }
    return { minX, minY, maxX, maxY };
  }

  function renderPrintCanvas() {
    if (!printCanvas) return;
    const project = get(currentProject);
    if (!project) return;
    const floor = getActiveFloor(project);
    if (!floor || floor.walls.length === 0) return;

    const ctx = printCanvas.getContext('2d')!;
    const dpr = window.devicePixelRatio || 1;
    const cw = printCanvas.clientWidth;
    const ch = printCanvas.clientHeight;
    printCanvas.width = cw * dpr;
    printCanvas.height = ch * dpr;
    ctx.scale(dpr, dpr);

    // Clear
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, cw, ch);

    const bounds = computeBounds(floor.walls);
    const planW = bounds.maxX - bounds.minX;
    const planH = bounds.maxY - bounds.minY;
    if (planW <= 0 || planH <= 0) return;

    const padding = 40;
    const availW = cw - padding * 2;
    const availH = ch - padding * 2;
    const fitScale = Math.min(availW / planW, availH / planH);
    const offsetX = padding + (availW - planW * fitScale) / 2 - bounds.minX * fitScale;
    const offsetY = padding + (availH - planH * fitScale) / 2 - bounds.minY * fitScale;

    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(fitScale, fitScale);

    // Draw room fills
    for (const room of floor.rooms) {
      const poly = getRoomPolygon(room, floor.walls);
      if (!poly || poly.length < 3) continue;
      ctx.beginPath();
      ctx.moveTo(poly[0].x, poly[0].y);
      for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i].x, poly[i].y);
      ctx.closePath();
      ctx.fillStyle = room.color ? room.color + '30' : '#e0e7ff40';
      ctx.fill();
    }

    // Draw walls
    ctx.strokeStyle = '#1e293b';
    ctx.lineCap = 'round';
    for (const w of floor.walls) {
      ctx.lineWidth = w.thickness || 12;
      ctx.beginPath();
      if (w.curvePoint) {
        ctx.moveTo(w.start.x, w.start.y);
        ctx.quadraticCurveTo(w.curvePoint.x, w.curvePoint.y, w.end.x, w.end.y);
      } else {
        ctx.moveTo(w.start.x, w.start.y);
        ctx.lineTo(w.end.x, w.end.y);
      }
      ctx.stroke();
    }

    // Draw doors
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 2;
    for (const door of floor.doors) {
      const wall = floor.walls.find(w => w.id === door.wallId);
      if (!wall) continue;
      const dx = wall.end.x - wall.start.x;
      const dy = wall.end.y - wall.start.y;
      const px = wall.start.x + dx * door.position;
      const py = wall.start.y + dy * door.position;
      const hw = door.width / 2;
      // Draw a gap in the wall and an arc
      ctx.beginPath();
      ctx.arc(px, py, hw, 0, Math.PI / 2);
      ctx.stroke();
    }

    // Draw windows
    ctx.strokeStyle = '#06b6d4';
    ctx.lineWidth = 4;
    for (const win of floor.windows) {
      const wall = floor.walls.find(w => w.id === win.wallId);
      if (!wall) continue;
      const dx = wall.end.x - wall.start.x;
      const dy = wall.end.y - wall.start.y;
      const len = Math.hypot(dx, dy);
      if (len === 0) continue;
      const nx = dx / len, ny = dy / len;
      const px = wall.start.x + dx * win.position;
      const py = wall.start.y + dy * win.position;
      const hw = win.width / 2;
      ctx.beginPath();
      ctx.moveTo(px - nx * hw, py - ny * hw);
      ctx.lineTo(px + nx * hw, py + ny * hw);
      ctx.stroke();
      // Double line for window
      const pnx = -ny, pny = nx;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(px - nx * hw + pnx * 4, py - ny * hw + pny * 4);
      ctx.lineTo(px + nx * hw + pnx * 4, py + ny * hw + pny * 4);
      ctx.stroke();
      ctx.lineWidth = 4;
    }

    // Room labels
    ctx.fillStyle = '#374151';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const room of floor.rooms) {
      const poly = getRoomPolygon(room, floor.walls);
      if (!poly || poly.length < 3) continue;
      const c = roomCentroid(poly);
      const ox = room.labelOffset?.x ?? 0;
      const oy = room.labelOffset?.y ?? 0;
      ctx.font = 'bold 14px system-ui';
      ctx.fillText(room.name, c.x + ox, c.y + oy - 8);
      ctx.font = '11px system-ui';
      ctx.fillStyle = '#6b7280';
      ctx.fillText(formatArea(room.area, 'metric'), c.x + ox, c.y + oy + 10);
      ctx.fillStyle = '#374151';
    }

    ctx.restore();
  }

  $effect(() => {
    if (open) {
      // Small delay to let DOM render
      setTimeout(renderPrintCanvas, 50);
    }
  });

  // Re-render when settings change
  $effect(() => {
    if (open) {
      // Track reactive deps
      void pageSize;
      void orientation;
      void scale;
      setTimeout(renderPrintCanvas, 20);
    }
  });

  function doPrint() {
    window.print();
  }

  function close() {
    open = false;
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') close();
  }

  // Get rooms for legend
  function getRooms(): { name: string; area: string }[] {
    const project = get(currentProject);
    if (!project) return [];
    const floor = getActiveFloor(project);
    if (!floor) return [];
    return floor.rooms.map(r => ({ name: r.name, area: formatArea(r.area, 'metric') }));
  }

  function getProjectName(): string {
    return get(currentProject)?.name ?? 'Untitled';
  }

  function getFloorName(): string {
    const project = get(currentProject);
    if (!project) return '';
    const floor = getActiveFloor(project);
    return floor?.name ?? '';
  }

  function todayStr(): string {
    return new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
  <!-- Print overlay - visible on screen for preview, and is the print target -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="fixed inset-0 bg-black/60 z-[100] flex items-start justify-center overflow-auto print-overlay-backdrop" onclick={close} onkeydown={(e) => { if (e.key === 'Escape') close(); }}>
    <!-- Control bar (hidden when printing) -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="fixed top-0 left-0 right-0 bg-slate-800 text-white px-6 py-3 flex items-center gap-4 z-[101] print-hide" onclick={(e) => e.stopPropagation()} onkeydown={() => {}}>
      <h3 class="font-semibold text-sm">Print Preview</h3>
      <div class="h-4 w-px bg-white/20"></div>

      <label class="text-xs text-white/70">
        Page:
        <select bind:value={pageSize} class="ml-1 bg-slate-700 text-white text-xs rounded px-2 py-1 border border-slate-600">
          <option value="letter">Letter</option>
          <option value="a4">A4</option>
        </select>
      </label>

      <label class="text-xs text-white/70">
        Orientation:
        <select bind:value={orientation} class="ml-1 bg-slate-700 text-white text-xs rounded px-2 py-1 border border-slate-600">
          <option value="landscape">Landscape</option>
          <option value="portrait">Portrait</option>
        </select>
      </label>

      <label class="text-xs text-white/70">
        Scale:
        <select bind:value={scale} class="ml-1 bg-slate-700 text-white text-xs rounded px-2 py-1 border border-slate-600">
          {#each scaleOptions as s}
            <option value={s}>{s}</option>
          {/each}
        </select>
      </label>

      <div class="flex-1"></div>

      <button onclick={doPrint} class="px-4 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold rounded-lg transition-colors flex items-center gap-2">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
        Print
      </button>
      <button onclick={close} class="px-3 py-1.5 text-white/70 hover:text-white text-sm transition-colors">✕ Close</button>
    </div>

    <!-- Print page -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="bg-white shadow-2xl mt-16 mb-8 print-page relative"
      class:print-landscape={orientation === 'landscape'}
      class:print-portrait={orientation === 'portrait'}
      class:print-a4={pageSize === 'a4'}
      class:print-letter={pageSize === 'letter'}
      onclick={(e) => e.stopPropagation()}
      onkeydown={() => {}}
    >
      <!-- Title block -->
      <div class="border-b-2 border-slate-800 pb-3 mb-4 flex items-end justify-between print-title-block">
        <div>
          <h1 class="text-xl font-bold text-slate-800">{getProjectName()}</h1>
          <p class="text-sm text-slate-500">{getFloorName()}</p>
        </div>
        <div class="text-right text-xs text-slate-500">
          <p class="font-semibold text-slate-700">Scale: {scale}</p>
          <p>{todayStr()}</p>
        </div>
      </div>

      <!-- Floor plan canvas -->
      <div class="flex-1 relative print-canvas-container">
        <canvas bind:this={printCanvas} class="w-full" style="height: calc(100% - 20px);"></canvas>

        <!-- North arrow -->
        <div class="absolute top-2 right-2 print-north-arrow">
          <svg width="40" height="40" viewBox="0 0 40 40">
            <polygon points="20,2 24,16 20,12 16,16" fill="#1e293b"/>
            <polygon points="20,38 24,24 20,28 16,24" fill="#94a3b8"/>
            <text x="20" y="10" text-anchor="middle" fill="#1e293b" font-size="8" font-weight="bold">N</text>
          </svg>
        </div>

        <!-- Scale bar -->
        <div class="absolute bottom-1 left-2 flex items-center gap-2 text-[10px] text-slate-600 print-scale-bar">
          <div class="flex items-end gap-0">
            <div class="w-12 h-1 bg-slate-800"></div>
            <div class="w-12 h-1 bg-slate-400"></div>
          </div>
          <span>{scale}</span>
        </div>
      </div>

      <!-- Room legend -->
      {#if getRooms().length > 0}
        <div class="border-t border-slate-300 pt-3 mt-2 print-legend">
          <h3 class="text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">Room Schedule</h3>
          <div class="grid grid-cols-3 gap-x-6 gap-y-1 text-xs">
            {#each getRooms() as room}
              <div class="flex justify-between">
                <span class="text-slate-600">{room.name}</span>
                <span class="text-slate-800 font-medium ml-2">{room.area}</span>
              </div>
            {/each}
          </div>
        </div>
      {/if}

      <!-- Footer -->
      <div class="border-t border-slate-200 pt-2 mt-3 flex justify-between text-[9px] text-slate-400 print-footer">
        <span>Generated by Open3D Floorplan</span>
        <span>Page 1 of 1</span>
      </div>
    </div>
  </div>
{/if}

<style>
  .print-page {
    display: flex;
    flex-direction: column;
    padding: 24px;
    box-sizing: border-box;
  }
  .print-landscape.print-letter { width: 11in; min-height: 8.5in; }
  .print-portrait.print-letter  { width: 8.5in; min-height: 11in; }
  .print-landscape.print-a4     { width: 297mm; min-height: 210mm; }
  .print-portrait.print-a4      { width: 210mm; min-height: 297mm; }

  .print-canvas-container {
    flex: 1;
    min-height: 0;
  }
  .print-canvas-container canvas {
    display: block;
  }
</style>
