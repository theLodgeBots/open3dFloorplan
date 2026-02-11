<script lang="ts">
  import { currentProject, viewMode, undo, redo, addFloor, removeFloor, setActiveFloor, updateProjectName, loadProject } from '$lib/stores/project';
  import { localStore } from '$lib/services/datastore';
  import { get } from 'svelte/store';
  import type { Floor, Project } from '$lib/models/types';
  import { exportAsPNG, exportAsJSON, exportAsSVG } from '$lib/utils/export';

  let projectName = $state('');
  let mode = $state<'2d' | '3d'>('2d');
  let floors: Floor[] = $state([]);
  let activeFloorId = $state('');
  let editingName = $state(false);
  let exportOpen = $state(false);

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
    const p = get(currentProject);
    if (p) {
      await localStore.save(p);
      alert('Project saved!');
    }
  }

  function onExport2DPNG() {
    const canvas = document.querySelector('canvas') as HTMLCanvasElement;
    if (canvas) exportAsPNG(canvas);
    exportOpen = false;
  }

  function onExport3DPNG() {
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
            a.href = url; a.download = 'floorplan-3d.png'; a.click();
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

  function onImportJSON() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const project = JSON.parse(text) as Project;
        if (!project.floors || !project.id) {
          alert('Invalid project file.');
          return;
        }
        loadProject(project);
      } catch {
        alert('Failed to parse project file.');
      }
    };
    input.click();
    exportOpen = false;
  }
</script>

<div class="h-12 bg-gradient-to-r from-slate-800 to-slate-700 flex items-center px-4 gap-3 shrink-0 shadow-sm">
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
    >+</button>
    <span class="text-white/40 text-[10px] ml-1">{floors.length}F</span>
  </div>

  <div class="flex-1"></div>

  <button onclick={undo} class="px-2 py-1 text-sm text-white/80 hover:text-white hover:bg-white/10 rounded transition-colors" title="Undo (Ctrl+Z)">↶</button>
  <button onclick={redo} class="px-2 py-1 text-sm text-white/80 hover:text-white hover:bg-white/10 rounded transition-colors" title="Redo (Ctrl+Y)">↷</button>

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

  <div class="h-5 w-px bg-white/20"></div>

  <!-- Export dropdown -->
  <div class="relative">
    <button
      onclick={() => exportOpen = !exportOpen}
      class="px-3 py-1.5 text-sm text-white/90 hover:text-white hover:bg-white/10 rounded transition-colors"
    >Export ▾</button>
    {#if exportOpen}
      <div class="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200 py-1 w-48 z-50">
        <button class="w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left" onclick={onExport2DPNG}>📷 Export 2D as PNG</button>
        <button class="w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left" onclick={onExport3DPNG}>🏠 Export 3D as PNG</button>
        <button class="w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left" onclick={onExportSVG}>✏️ Export as SVG</button>
        <button class="w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left" onclick={onExportJSON}>📄 Download Project JSON</button>
        <div class="h-px bg-gray-200 my-1"></div>
        <button class="w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left" onclick={onImportJSON}>📂 Import Project JSON</button>
      </div>
    {/if}
  </div>

  <span class="text-[10px] text-white/40">auto-saved</span>
  <button onclick={save} class="px-3 py-1.5 text-sm bg-white text-slate-800 font-semibold rounded-lg hover:bg-blue-50 transition-colors shadow-sm">
    Save
  </button>
</div>
