<script lang="ts">
  import { onMount } from 'svelte';
  import { currentProject, viewMode, undo, redo, addFloor, removeFloor, setActiveFloor, updateProjectName, loadProject, createDefaultProject } from '$lib/stores/project';
  import { localStore } from '$lib/services/datastore';
  import { get } from 'svelte/store';
  import type { Floor, Project } from '$lib/models/types';
  import { exportAsPNG, exportAsJSON, exportAsSVG } from '$lib/utils/export';
  import { exportDXF, exportDWG } from '$lib/utils/cadExport';

  let projectName = $state('');
  let mode = $state<'2d' | '3d'>('2d');
  let floors: Floor[] = $state([]);
  let activeFloorId = $state('');
  let editingName = $state(false);
  let exportOpen = $state(false);
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

  function newProject() {
    if (!confirm('Create a new project? Unsaved changes will be lost.')) return;
    currentProject.set(createDefaultProject());
    exportOpen = false;
  }

  onMount(() => {
    function handleClickOutside(e: MouseEvent) {
      if (exportOpen && exportRef && !exportRef.contains(e.target as Node)) {
        exportOpen = false;
      }
    }
    document.addEventListener('click', handleClickOutside, true);
    return () => document.removeEventListener('click', handleClickOutside, true);
  });

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

  <button onclick={undo} class="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded transition-colors" title="Undo (Ctrl+Z)">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
  </button>
  <button onclick={redo} class="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded transition-colors" title="Redo (Ctrl+Y)">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.13-9.36L23 10"/></svg>
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

  <div class="h-5 w-px bg-white/20"></div>

  <!-- Export dropdown -->
  <div class="relative" bind:this={exportRef}>
    <button
      onclick={() => exportOpen = !exportOpen}
      class="px-3 py-1.5 text-sm text-white/90 hover:text-white hover:bg-white/10 rounded transition-colors flex items-center gap-1.5"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
      Export
    </button>
    {#if exportOpen}
      <div class="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200 py-1 w-48 z-50">
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

  <span class="text-[10px] text-white/40">auto-saved</span>
  <button onclick={save} class="px-3 py-1.5 text-sm bg-white text-slate-800 font-semibold rounded-lg hover:bg-blue-50 transition-colors shadow-sm">
    Save
  </button>
</div>
