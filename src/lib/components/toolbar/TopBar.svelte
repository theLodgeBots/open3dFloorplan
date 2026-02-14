<script lang="ts">
  import { onMount } from 'svelte';
  import { currentProject, viewMode, undo, redo, addFloor, removeFloor, setActiveFloor, updateProjectName, loadProject, createDefaultProject, snapEnabled, canvasZoom, panMode, showFurnitureStore, layerVisibility, importFloorIntoCurrentProject } from '$lib/stores/project';
  import { localStore } from '$lib/services/datastore';
  import { get } from 'svelte/store';
  import type { Floor, Project } from '$lib/models/types';
  import { exportAsPNG, exportAsJSON, exportAsSVG, exportPDF } from '$lib/utils/export';
  import { exportDXF, exportDWG } from '$lib/utils/cadExport';
  import { importRoomPlan } from '$lib/utils/roomplanImport';
  import SettingsDialog from './SettingsDialog.svelte';
  import AreaSummaryPanel from '$lib/components/sidebar/AreaSummaryPanel.svelte';
  import { saveState, lastSavedAt, manualSave, initAutoSave } from '$lib/stores/saveStatus';
  import { initVersionHistory, snapshotOnAction } from '$lib/stores/versionHistory';
  import VersionHistoryPanel from './VersionHistoryPanel.svelte';

  let settingsOpen = $state(false);
  let areaOpen = $state(false);
  let versionHistoryOpen = $state(false);

  let projectName = $state('');
  let mode = $state<'2d' | '3d'>('2d');
  let floors: Floor[] = $state([]);
  let activeFloorId = $state('');
  let editingName = $state(false);
  let exportOpen = $state(false);
  import { triggerTip } from '$lib/stores/onboarding.svelte';
  let snapOn = $state(true);
  let exportRef: HTMLDivElement;

  currentProject.subscribe((p) => {
    if (p) {
      projectName = p.name;
      floors = p.floors;
      activeFloorId = p.activeFloorId;
    }
  });
  viewMode.subscribe((m) => { mode = m; });

  function setMode(m: '2d' | '3d') {
    viewMode.set(m);
  }

  function onNameBlur() {
    editingName = false;
    updateProjectName(projectName);
  }

  function onNameKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
  }

  function onAddFloor() {
    addFloor(`Floor ${floors.length}`);
  }

  function onRemoveFloor(id: string) {
    if (floors.length <= 1) return;
    removeFloor(id);
  }

  async function save() {
    await manualSave();
  }

  // Relative time for tooltip
  let lastSavedText = $state('');
  let lastSavedTime: Date | null = $state(null);
  lastSavedAt.subscribe(v => { lastSavedTime = v; updateLastSavedText(); });

  function updateLastSavedText() {
    if (!lastSavedTime) { lastSavedText = ''; return; }
    const diff = Math.floor((Date.now() - lastSavedTime.getTime()) / 1000);
    if (diff < 5) lastSavedText = 'Last saved: just now';
    else if (diff < 60) lastSavedText = `Last saved: ${diff}s ago`;
    else if (diff < 3600) lastSavedText = `Last saved: ${Math.floor(diff / 60)} min ago`;
    else lastSavedText = `Last saved: ${Math.floor(diff / 3600)}h ago`;
  }

  function onExport2DPNG() {
    const p = get(currentProject);
    const canvas = document.querySelector('canvas') as HTMLCanvasElement;
    if (canvas) exportAsPNG(canvas, p ?? undefined);
    exportOpen = false;
  }

  function onExport3DPNG() {
    const p = get(currentProject);
    const name = p?.name || 'floorplan';
    // Switch to 3D, wait a tick, then screenshot
    const oldMode = mode;
    viewMode.set('3d');
    setTimeout(() => {
      const c = document.querySelector('.w-full.h-full canvas, div canvas') as HTMLCanvasElement;
      if (c) {
        c.toBlob((blob) => {
          if (blob) {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = `${name}-3d.png`; a.click();
            URL.revokeObjectURL(url);
          }
        });
      }
      if (oldMode === '2d') viewMode.set('2d');
    }, 500);
    exportOpen = false;
  }

  function onExportJSON() {
    const p = get(currentProject);
    if (p) exportAsJSON(p);
    exportOpen = false;
  }

  function onExportSVG() {
    const p = get(currentProject);
    if (p) exportAsSVG(p);
    exportOpen = false;
  }

  function onExportDXF() {
    const p = get(currentProject);
    if (p) exportDXF(p);
    exportOpen = false;
  }

  function onExportDWG() {
    const p = get(currentProject);
    if (p) exportDWG(p);
    exportOpen = false;
  }

  function onExportPDF() {
    const p = get(currentProject);
    if (p) exportPDF(p);
    exportOpen = false;
  }

  function onShareProject() {
    const p = get(currentProject);
    if (!p) return;
    const json = JSON.stringify(p, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${p.name || 'floorplan'}.openplan.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function newProject() {
    if (!confirm('Create a new project? Unsaved changes will be lost.')) return;
    currentProject.set(createDefaultProject());
    exportOpen = false;
  }

  onMount(() => {
    initAutoSave();
    initVersionHistory();

    // Update relative timestamp every 15s
    const interval = setInterval(updateLastSavedText, 15000);

    function handleClickOutside(e: MouseEvent) {
      if (exportOpen && exportRef && !exportRef.contains(e.target as Node)) {
        exportOpen = false;
      }
    }
    function handleKeydown(e: KeyboardEvent) {
      if (exportOpen) exportOpen = false;
      if (e.key === 'Escape' && versionHistoryOpen) versionHistoryOpen = false;
      if (e.key === 'Escape' && areaOpen) areaOpen = false;
    }
    document.addEventListener('click', handleClickOutside, true);
    document.addEventListener('keydown', handleKeydown, true);
    return () => {
      document.removeEventListener('click', handleClickOutside, true);
      document.removeEventListener('keydown', handleKeydown, true);
      clearInterval(interval);
    };
  });

  function onImportJSON() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,.zip';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        // Detect RoomPlan format (has walls array with dimensions, or rooms/doors/windows at top level)
        if (data.walls && Array.isArray(data.walls) && data.walls[0]?.dimensions) {
          // RoomPlan JSON — import into current project
          const floor = importRoomPlan(data, { straighten: true, orthogonal: true });
          importFloorIntoCurrentProject(floor);
        } else if (data.floors && data.id) {
          // Validate project structure
          if (!Array.isArray(data.floors) || data.floors.length === 0) {
            alert('Invalid project file: "floors" must be a non-empty array.');
            return;
          }
          for (const fl of data.floors) {
            if (!fl.id || !Array.isArray(fl.walls)) {
              alert('Invalid project file: each floor must have an "id" and "walls" array.');
              return;
            }
          }
          if (!data.activeFloorId || !data.floors.some((f: any) => f.id === data.activeFloorId)) {
            data.activeFloorId = data.floors[0].id;
          }
          // Revive dates
          if (data.createdAt) data.createdAt = new Date(data.createdAt);
          if (data.updatedAt) data.updatedAt = new Date(data.updatedAt);
          loadProject(data as Project);
        } else {
          alert('Unrecognized file format. Expected a project file or Apple RoomPlan JSON.');
        }
      } catch (e: any) {
        alert('Failed to import: ' + e.message);
      }
    };
    input.click();
    exportOpen = false;
  }
</script>

<div class="h-12 bg-gradient-to-r from-slate-800 to-slate-700 flex items-center px-4 gap-3 shrink-0 shadow-sm">
  <!-- Back to Projects -->
  <a
    href="/"
    class="flex items-center gap-1 text-white/70 hover:text-white text-sm transition-colors"
    title="Back to Projects"
  >
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
    <span class="hidden sm:inline">Projects</span>
  </a>

  <div class="h-5 w-px bg-white/20"></div>

  {#if editingName}
    <input
      type="text"
      bind:value={projectName}
      onblur={onNameBlur}
      onkeydown={onNameKeydown}
      class="bg-white/20 text-white font-semibold px-2 py-0.5 rounded border border-white/30 outline-none text-sm w-40"
    />
  {:else}
    <button
      class="font-semibold text-white text-sm hover:bg-white/10 px-2 py-0.5 rounded transition-colors"
      onclick={() => editingName = true}
      title="Click to rename"
    >{projectName}</button>
  {/if}

  <div class="h-5 w-px bg-white/20"></div>

  <!-- Floor selector as buttons -->
  <div class="flex items-center gap-1">
    {#each floors as fl}
      <button
        class="px-2 py-0.5 text-xs rounded transition-colors {fl.id === activeFloorId ? 'bg-white text-slate-800 font-semibold' : 'text-white/80 hover:bg-white/10'}"
        onclick={() => setActiveFloor(fl.id)}
        ondblclick={() => onRemoveFloor(fl.id)}
        title={fl.id === activeFloorId ? 'Active floor (dbl-click to remove)' : 'Click to switch, dbl-click to remove'}
      >{fl.name}</button>
    {/each}
    <button
      onclick={onAddFloor}
      class="text-white/80 hover:text-white text-xs hover:bg-white/10 px-1.5 py-0.5 rounded transition-colors"
      title="Add Floor"
      aria-label="Add Floor"
    >+</button>
    <span class="text-white/40 text-[10px] ml-1">{floors.length}F</span>
  </div>

  <div class="flex-1"></div>

  <button onclick={undo} class="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded transition-colors" title="Undo (Ctrl+Z)" aria-label="Undo">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
  </button>
  <button onclick={redo} class="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded transition-colors" title="Redo (Ctrl+Y)" aria-label="Redo">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.13-9.36L23 10"/></svg>
  </button>

  <div class="h-5 w-px bg-white/20"></div>

  <!-- Snap to grid toggle -->
  <button
    onclick={() => { snapEnabled.update(v => !v); snapOn = !snapOn; }}
    class="p-1.5 rounded transition-colors {snapOn ? 'text-white bg-white/20' : 'text-white/40 hover:text-white/70 hover:bg-white/10'}"
    title="Snap to Grid ({snapOn ? 'On' : 'Off'})"
    aria-label="Snap to Grid"
  >
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
    </svg>
  </button>

  <!-- Select / Pan toggle -->
  {#if mode === '2d'}
  <div class="flex bg-white/15 rounded-full p-0.5">
    <button
      onclick={() => panMode.set(false)}
      class="px-2 py-1 text-xs font-semibold rounded-full transition-colors {!$panMode ? 'bg-white text-slate-800' : 'text-white/80 hover:text-white'}"
      title="Select mode (V)"
      aria-label="Select mode"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/><path d="M13 13l6 6"/></svg>
    </button>
    <button
      onclick={() => panMode.set(true)}
      class="px-2 py-1 text-xs font-semibold rounded-full transition-colors {$panMode ? 'bg-white text-slate-800' : 'text-white/80 hover:text-white'}"
      title="Pan mode (H)"
      aria-label="Pan mode"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 11V6a2 2 0 0 0-4 0v1"/><path d="M14 10V4a2 2 0 0 0-4 0v2"/><path d="M10 10.5V6a2 2 0 0 0-4 0v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/></svg>
    </button>
  </div>
  {/if}

  <!-- Furniture visibility toggle -->
  <button
    onclick={() => layerVisibility.update(v => ({ ...v, furniture: !v.furniture }))}
    class="p-1.5 rounded transition-colors {$showFurnitureStore ? 'text-white bg-white/20' : 'text-white/40 hover:text-white/70 hover:bg-white/10'}"
    title="Toggle Furniture ({$showFurnitureStore ? 'Visible' : 'Hidden'})"
    aria-label="Toggle Furniture"
  >
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="2" y="12" width="20" height="8" rx="1"/><path d="M4 12V7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v5"/><line x1="12" y1="12" x2="12" y2="20"/>
    </svg>
  </button>

  <div class="h-5 w-px bg-white/20"></div>

  <!-- 2D/3D pill toggle -->
  <div class="flex bg-white/15 rounded-full p-0.5">
    <button
      onclick={() => setMode('2d')}
      class="px-3 py-1 text-xs font-semibold rounded-full transition-colors {mode === '2d' ? 'bg-white text-slate-800' : 'text-white/80 hover:text-white'}"
    >2D</button>
    <button
      onclick={() => setMode('3d')}
      class="px-3 py-1 text-xs font-semibold rounded-full transition-colors {mode === '3d' ? 'bg-white text-slate-800' : 'text-white/80 hover:text-white'}"
    >3D</button>
  </div>

  <!-- Zoom controls (2D only) -->
  {#if mode === '2d'}
    <div class="flex items-center gap-1 bg-white/15 rounded-full p-0.5">
      <button
        onclick={() => canvasZoom.update(z => Math.max(0.1, z / 1.25))}
        class="w-7 h-7 flex items-center justify-center text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-colors text-sm font-bold"
        title="Zoom Out (−)"
        aria-label="Zoom Out"
      >−</button>
      <button
        onclick={() => canvasZoom.set(1)}
        class="px-2 py-1 text-xs font-medium text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-colors min-w-[3rem] text-center"
        title="Reset Zoom (100%)"
      >{Math.round($canvasZoom * 100)}%</button>
      <button
        onclick={() => canvasZoom.update(z => Math.min(10, z * 1.25))}
        class="w-7 h-7 flex items-center justify-center text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-colors text-sm font-bold"
        title="Zoom In (+)"
        aria-label="Zoom In"
      >+</button>
    </div>
  {/if}

  <!-- Version History button -->
  <button
    onclick={() => versionHistoryOpen = true}
    class="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded transition-colors"
    title="Version History"
    aria-label="Version History"
  >
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
  </button>

  <!-- Area summary button -->
  <button
    onclick={() => areaOpen = true}
    class="px-2 py-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded transition-colors"
    title="Area Summary"
    aria-label="Area Summary"
  >
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 3v18"/></svg>
  </button>

  <!-- Settings button -->
  <button
    onclick={() => settingsOpen = true}
    class="px-2 py-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded transition-colors"
    title="Settings"
    aria-label="Settings"
  >
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
  </button>

  <div class="h-5 w-px bg-white/20"></div>

  <!-- Export dropdown -->
  <div class="relative" bind:this={exportRef}>
    <button
      onclick={() => { exportOpen = !exportOpen; if (exportOpen) triggerTip('first-export', 300, 60); }}
      class="px-3 py-1.5 text-sm text-white/90 hover:text-white hover:bg-white/10 rounded transition-colors flex items-center gap-1.5"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
      Export
    </button>
    {#if exportOpen}
      <div class="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200 py-1 w-48 z-50">
        <button class="w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 text-left flex items-center gap-2" onclick={() => { exportOpen = false; window.dispatchEvent(new KeyboardEvent('keydown', { key: 'p', ctrlKey: true })); }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
          Print Layout
        </button>
        <div class="h-px bg-gray-100 my-1"></div>
        <button class="w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 text-left flex items-center gap-2" onclick={onExport2DPNG}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
          Export 2D as PNG
        </button>
        <button class="w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 text-left flex items-center gap-2" onclick={onExport3DPNG}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
          Export 3D as PNG
        </button>
        <button class="w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 text-left flex items-center gap-2" onclick={onExportSVG}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 19V5"/><path d="M5 12l7-7 7 7"/></svg>
          Export as SVG
        </button>
        <button class="w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 text-left flex items-center gap-2" onclick={onExportDXF}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M8 16h2"/><path d="M14 16h2"/></svg>
          Export as DXF
        </button>
        <button class="w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 text-left flex items-center gap-2" onclick={onExportDWG}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M9 16h6"/></svg>
          Export as DWG
        </button>
        <button class="w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 text-left flex items-center gap-2" onclick={onExportPDF}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M16 11v6"/><path d="M8 11v6"/><path d="M12 11v6"/></svg>
          Export as PDF
        </button>
        <button class="w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 text-left flex items-center gap-2" onclick={onExportJSON}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>
          Download JSON
        </button>
        <div class="h-px bg-gray-100 my-1"></div>
        <button class="w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 text-left flex items-center gap-2" onclick={onImportJSON}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          Import JSON
        </button>
        <button class="w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 text-left flex items-center gap-2" onclick={newProject}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          New Project
        </button>
      </div>
    {/if}
  </div>

  <span
    class="text-[11px] font-medium transition-all duration-300 {$saveState === 'saved' ? 'text-emerald-400' : $saveState === 'saving' ? 'text-amber-300 animate-pulse' : 'text-white/50'}"
    title={lastSavedText || 'Not saved yet'}
  >
    {#if $saveState === 'saving'}
      Saving…
    {:else if $saveState === 'saved'}
      Saved ✓
    {:else}
      Unsaved •
    {/if}
  </span>
  <button onclick={save} class="px-3 py-1.5 text-sm bg-white text-slate-800 font-semibold rounded-lg hover:bg-blue-50 transition-colors shadow-sm">
    Save
  </button>
</div>

<SettingsDialog bind:open={settingsOpen} />
<VersionHistoryPanel bind:open={versionHistoryOpen} />

{#if areaOpen}
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onclick={() => areaOpen = false} onkeydown={(e) => { if (e.key === 'Escape') areaOpen = false; }}>
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="bg-white rounded-xl shadow-2xl w-[420px] max-h-[80vh] overflow-hidden" onclick={(e) => e.stopPropagation()}>
    <div class="flex items-center justify-between px-5 py-3 border-b border-gray-200">
      <h2 class="text-base font-semibold text-gray-800">📐 Area Summary</h2>
      <button onclick={() => areaOpen = false} class="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
    </div>
    <div class="overflow-y-auto max-h-[calc(80vh-52px)] p-1">
      <AreaSummaryPanel />
    </div>
  </div>
</div>
{/if}
