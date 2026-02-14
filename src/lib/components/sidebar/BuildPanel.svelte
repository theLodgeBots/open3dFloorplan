<script lang="ts">
  import { selectedTool, placingFurnitureId, placingDoorType, placingWindowType, placingStair, addStair, placingColumn, placingColumnShape, activeFloor, setBackgroundImage } from '$lib/stores/project';
  import type { Tool } from '$lib/stores/project';
  import type { Door, Window as Win } from '$lib/models/types';
  import { roomPresets, placePreset } from '$lib/utils/roomPresets';
  import { furnitureCatalog, furnitureCategories } from '$lib/utils/furnitureCatalog';
  import type { FurnitureDef } from '$lib/utils/furnitureCatalog';
  import { getModelFile, generateThumbnail, getThumbnail, preloadThumbnails } from '$lib/utils/furnitureThumbnails';
  import { onMount } from 'svelte';
  import { importRoomPlan, extractRoomJsonFromZip, ORTHO_VERSION } from '$lib/utils/roomplanImport';
  import { currentProject, loadProject, importFloorIntoCurrentProject, createDefaultProject } from '$lib/stores/project';
  import type { Project } from '$lib/models/types';

  let activeTab = $state<'draw' | 'rooms' | 'objects'>('draw');
  let constructionOpen = $state(true);
  let selectedCategory = $state<string>('All');
  let thumbsReady = $state(0); // increment to trigger reactivity

  onMount(() => {
    // Preload thumbnails, re-render as each completes
    const files = new Set(furnitureCatalog.map(f => getModelFile(f.id)).filter(Boolean) as string[]);
    for (const file of files) {
      generateThumbnail(file).then(() => { thumbsReady++; });
    }
  });

  // RoomPlan import dialog state
  let showImportDialog = $state(false);
  let importFileName = $state('');
  let importJsonData: any = $state(null);
  let optStraighten = $state(true);
  let optOrthogonal = $state(true);
  let optMergeDistance = $state(15);

  function setTool(tool: Tool) {
    selectedTool.set(tool);
    placingFurnitureId.set(null);
  }

  let currentTool = $state<Tool>('select');
  selectedTool.subscribe((t) => { currentTool = t; });

  let currentPlacing = $state<string | null>(null);
  placingFurnitureId.subscribe((id) => { currentPlacing = id; });

  function onPresetClick(presetId: string) {
    const preset = roomPresets.find(p => p.id === presetId);
    if (preset) {
      placePreset(preset, { x: -200, y: -150 });
    }
  }

  function onFurnitureClick(item: FurnitureDef) {
    selectedTool.set('furniture');
    placingFurnitureId.set(item.id);
  }

  let search = $state('');

  let filtered = $derived(
    furnitureCatalog.filter((f) => {
      const matchSearch = f.name.toLowerCase().includes(search.toLowerCase());
      const matchCat = selectedCategory === 'All' || f.category === selectedCategory;
      return matchSearch && matchCat;
    })
  );

  const doorCatalog: { type: Door['type']; name: string; desc: string; icon: string }[] = [
    { type: 'single', name: 'Single', desc: '90cm swing', icon: 'M6 3h12v18H6z' },
    { type: 'double', name: 'Double', desc: '150cm swing', icon: 'M3 3h8v18H3zM13 3h8v18h-8z' },
    { type: 'sliding', name: 'Sliding', desc: '180cm slide', icon: 'M3 6h18v12H3z' },
    { type: 'french', name: 'French', desc: '150cm glass', icon: 'M3 3h8v18H3zM13 3h8v18h-8z' },
    { type: 'pocket', name: 'Pocket', desc: '90cm recess', icon: 'M6 3h12v18H6z' },
    { type: 'bifold', name: 'Bifold', desc: '180cm fold', icon: 'M3 3h5v18H3zM9 3h6v18H9zM16 3h5v18h-5z' },
  ];

  const windowCatalog: { type: Win['type']; name: string; desc: string }[] = [
    { type: 'standard', name: 'Standard', desc: '120×120cm' },
    { type: 'fixed', name: 'Fixed', desc: '100×100cm' },
    { type: 'casement', name: 'Casement', desc: '80×130cm' },
    { type: 'sliding', name: 'Sliding', desc: '180×120cm' },
    { type: 'bay', name: 'Bay', desc: '200×150cm' },
  ];

  let selectedDoorType = $state<Door['type']>('single');
  let selectedWindowType = $state<Win['type']>('standard');

  function setDoorType(type: Door['type']) {
    selectedDoorType = type;
    placingDoorType.set(type);
    setTool('door');
  }

  function setWindowType(type: Win['type']) {
    selectedWindowType = type;
    placingWindowType.set(type);
    setTool('window');
  }

  let isPlacingStair = $state(false);
  placingStair.subscribe(v => { isPlacingStair = v; });

  let isPlacingColumn = $state(false);
  placingColumn.subscribe(v => { isPlacingColumn = v; });

  function onPlaceStair() {
    placingStair.set(true);
    selectedTool.set('select');
    placingFurnitureId.set(null);
  }

  function onPlaceColumn(shape: 'round' | 'square') {
    placingColumn.set(true);
    placingColumnShape.set(shape);
    selectedTool.set('select');
    placingFurnitureId.set(null);
  }

  function onImportImage() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      if (file.size > 5 * 1024 * 1024) {
        alert('Warning: Image is larger than 5MB. This may slow down the application.');
      }
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        setBackgroundImage({
          dataUrl,
          position: { x: 0, y: 0 },
          scale: 1,
          opacity: 0.4,
          rotation: 0,
          locked: false,
        });
      };
      reader.readAsDataURL(file);
    };
    input.click();
  }

  async function onImportRoomPlan() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,.zip';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        let jsonData: any;
        if (file.name.endsWith('.zip')) {
          jsonData = await extractRoomJsonFromZip(file);
        } else {
          const text = await file.text();
          jsonData = JSON.parse(text);
        }
        importJsonData = jsonData;
        importFileName = file.name.replace(/\.(json|zip)$/, '');
        showImportDialog = true;
      } catch (e: any) {
        alert('Failed to read RoomPlan file: ' + e.message);
      }
    };
    input.click();
  }

  function confirmImport() {
    if (!importJsonData) return;
    try {
      const floor = importRoomPlan(importJsonData, {
        straighten: optStraighten,
        orthogonal: optOrthogonal,
        mergeDistance: optMergeDistance,
      });
      // Create a new project for the imported data instead of merging into current
      const projectName = importFileName ? importFileName.replace(/\.(json|zip)$/i, '') : 'RoomPlan Import';
      const newProject = createDefaultProject(projectName);
      const activeFloor = newProject.floors[0];
      activeFloor.walls = floor.walls;
      activeFloor.doors = floor.doors;
      activeFloor.windows = floor.windows;
      activeFloor.furniture = floor.furniture;
      if (floor.stairs) activeFloor.stairs = floor.stairs;
      if (floor.columns) activeFloor.columns = floor.columns;
      loadProject(newProject);
    } catch (e: any) {
      alert('Failed to import RoomPlan: ' + e.message);
    }
    showImportDialog = false;
    importJsonData = null;
  }

  function cancelImport() {
    showImportDialog = false;
    importJsonData = null;
  }

  const categoryColors: Record<string, string> = {
    'Living Room': '#a78bfa',
    'Bedroom': '#60a5fa',
    'Kitchen': '#f87171',
    'Bathroom': '#93c5fd',
    'Office': '#34d399',
    'Dining': '#f59e0b',
    'Decor': '#c2956b',
    'Lighting': '#fbbf24',
    'Outdoor Furniture': '#92400e',
    'Landscaping': '#16a34a',
    'Fencing': '#78350f',
    'Structures': '#6b7280',
  };
</script>

<div class="w-64 bg-white border-r border-gray-200 flex flex-col h-full overflow-hidden">
  <!-- Tabs -->
  <div class="flex border-b border-gray-200">
    <button
      class="flex-1 py-2.5 text-xs font-semibold uppercase tracking-wide {activeTab === 'draw' ? 'text-slate-800 border-b-2 border-blue-500 bg-blue-50' : 'text-gray-500 hover:text-gray-700'}"
      onclick={() => activeTab = 'draw'}
    >Build</button>
    <button
      class="flex-1 py-2.5 text-xs font-semibold uppercase tracking-wide {activeTab === 'rooms' ? 'text-slate-800 border-b-2 border-blue-500 bg-blue-50' : 'text-gray-500 hover:text-gray-700'}"
      onclick={() => activeTab = 'rooms'}
    >Rooms</button>
    <button
      class="flex-1 py-2.5 text-xs font-semibold uppercase tracking-wide {activeTab === 'objects' ? 'text-slate-800 border-b-2 border-blue-500 bg-blue-50' : 'text-gray-500 hover:text-gray-700'}"
      onclick={() => activeTab = 'objects'}
    >Objects</button>
  </div>

  <div class="flex-1 overflow-y-auto p-3">
    {#if activeTab === 'draw'}
      <div class="space-y-1">
        <h3 class="text-xs font-semibold text-gray-400 uppercase mb-2">Tools</h3>
        <button
          class="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors {currentTool === 'select' ? 'bg-blue-50 text-slate-800 ring-1 ring-blue-200' : 'hover:bg-gray-50 text-gray-700'}"
          onclick={() => setTool('select')}
        >
          <div class="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center {currentTool === 'select' ? 'bg-blue-100' : ''}">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/><path d="M13 13l6 6"/></svg>
          </div>
          <div class="text-left">
            <div class="font-medium">Select <span class="text-gray-400 text-xs ml-1">V</span></div>
            <div class="text-xs text-gray-400">Click to select elements</div>
          </div>
        </button>
        <button
          class="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors {currentTool === 'wall' ? 'bg-blue-50 text-slate-800 ring-1 ring-blue-200' : 'hover:bg-gray-50 text-gray-700'}"
          onclick={() => setTool('wall')}
        >
          <div class="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center {currentTool === 'wall' ? 'bg-blue-100' : ''}">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="8" width="18" height="8" rx="1"/><line x1="7" y1="8" x2="7" y2="16"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="17" y1="8" x2="17" y2="16"/></svg>
          </div>
          <div class="text-left">
            <div class="font-medium">Draw Wall <span class="text-gray-400 text-xs ml-1">W</span></div>
            <div class="text-xs text-gray-400">Click to draw, dbl-click to finish</div>
          </div>
        </button>

        <h3 class="text-xs font-semibold text-gray-400 uppercase mb-2 mt-3">Structure</h3>
        <button
          class="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors {isPlacingStair ? 'bg-blue-50 text-slate-800 ring-1 ring-blue-200' : 'hover:bg-gray-50 text-gray-700'}"
          onclick={onPlaceStair}
        >
          <div class="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center {isPlacingStair ? 'bg-blue-100' : ''}">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 5h-5V2h-3v6h-4V5H7v6H2v3h5v3h3v-3h4v3h3v-6h5z"/></svg>
          </div>
          <div class="text-left">
            <div class="font-medium">Add Stairs</div>
            <div class="text-xs text-gray-400">Click to place stairs</div>
          </div>
        </button>

        <div class="flex gap-2">
          <button
            class="flex-1 flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm transition-colors {isPlacingColumn ? 'bg-blue-50 text-slate-800 ring-1 ring-blue-200' : 'hover:bg-gray-50 text-gray-700'}"
            onclick={() => onPlaceColumn('round')}
          >
            <div class="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center {isPlacingColumn ? 'bg-blue-100' : ''}">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="6"/><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>
            </div>
            <div class="text-left">
              <div class="font-medium text-xs">Round Column</div>
            </div>
          </button>
          <button
            class="flex-1 flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm transition-colors {isPlacingColumn ? 'bg-blue-50 text-slate-800 ring-1 ring-blue-200' : 'hover:bg-gray-50 text-gray-700'}"
            onclick={() => onPlaceColumn('square')}
          >
            <div class="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center {isPlacingColumn ? 'bg-blue-100' : ''}">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="6" width="12" height="12"/><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>
            </div>
            <div class="text-left">
              <div class="font-medium text-xs">Square Column</div>
            </div>
          </button>
        </div>

        <h3 class="text-xs font-semibold text-gray-400 uppercase mb-2 mt-3">Import</h3>
        <button
          class="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors hover:bg-gray-50 text-gray-700"
          onclick={onImportImage}
        >
          <div class="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
          </div>
          <div class="text-left">
            <div class="font-medium">Import Image</div>
            <div class="text-xs text-gray-400">Floor plan background</div>
          </div>
        </button>
        <button
          class="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors hover:bg-gray-50 text-gray-700"
          onclick={onImportRoomPlan}
        >
          <div class="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
          </div>
          <div class="text-left">
            <div class="font-medium">Import RoomPlan</div>
            <div class="text-xs text-gray-400">iOS LiDAR scan (.json/.zip)</div>
          </div>
        </button>

        <button
          class="w-full flex items-center justify-between px-1 py-2 mt-3"
          onclick={() => constructionOpen = !constructionOpen}
        >
          <h3 class="text-xs font-semibold text-gray-400 uppercase">Doors</h3>
          <span class="text-gray-400 text-xs">{constructionOpen ? '▼' : '▶'}</span>
        </button>

        {#if constructionOpen}
          <div class="grid grid-cols-2 gap-2 mb-3">
            {#each doorCatalog as dc}
              <button
                class="flex flex-col items-center gap-1 p-2.5 rounded-lg border-2 transition-colors cursor-grab active:cursor-grabbing {currentTool === 'door' && selectedDoorType === dc.type ? 'border-blue-400 bg-blue-50' : 'border-gray-100 hover:border-gray-200'}"
                onclick={() => setDoorType(dc.type)}
                draggable="true"
                ondragstart={(e) => { e.dataTransfer?.setData('application/o3d-type', 'door'); e.dataTransfer?.setData('application/o3d-id', dc.type); }}
              >
                <div class="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#92400e" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="{dc.icon}"/></svg>
                </div>
                <span class="text-xs font-medium text-gray-600">{dc.name}</span>
                <span class="text-[10px] text-gray-400">{dc.desc}</span>
              </button>
            {/each}
          </div>

          <h3 class="text-xs font-semibold text-gray-400 uppercase mb-2">Windows</h3>
          <div class="grid grid-cols-2 gap-2">
            {#each windowCatalog as wc}
              <button
                class="flex flex-col items-center gap-1 p-2.5 rounded-lg border-2 transition-colors cursor-grab active:cursor-grabbing {currentTool === 'window' && selectedWindowType === wc.type ? 'border-blue-400 bg-blue-50' : 'border-gray-100 hover:border-gray-200'}"
                onclick={() => setWindowType(wc.type)}
                draggable="true"
                ondragstart={(e) => { e.dataTransfer?.setData('application/o3d-type', 'window'); e.dataTransfer?.setData('application/o3d-id', wc.type); }}
              >
                <div class="w-9 h-9 rounded-lg bg-cyan-50 flex items-center justify-center">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0e7490" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="1"/><line x1="12" y1="4" x2="12" y2="20"/><line x1="3" y1="12" x2="21" y2="12"/></svg>
                </div>
                <span class="text-xs font-medium text-gray-600">{wc.name}</span>
                <span class="text-[10px] text-gray-400">{wc.desc}</span>
              </button>
            {/each}
          </div>
        {/if}
      </div>

    {:else if activeTab === 'rooms'}
      <div class="space-y-2">
        <h3 class="text-xs font-semibold text-gray-400 uppercase mb-2">Room Presets</h3>
        <p class="text-xs text-gray-400 mb-3">Click to add a room shape to the canvas</p>
        <div class="grid grid-cols-2 gap-2">
          {#each roomPresets as preset}
            <button
              class="flex flex-col items-center gap-1.5 p-3 rounded-lg border-2 border-gray-100 hover:border-blue-300 hover:bg-blue-50 transition-colors cursor-grab active:cursor-grabbing"
              onclick={() => onPresetClick(preset.id)}
              draggable="true"
              ondragstart={(e) => { e.dataTransfer?.setData('application/o3d-type', 'room'); e.dataTransfer?.setData('application/o3d-id', preset.id); }}
            >
              <div class="w-12 h-12 rounded-lg bg-gray-50 flex items-center justify-center text-2xl font-mono">{preset.icon}</div>
              <span class="text-xs font-medium text-gray-600">{preset.name}</span>
            </button>
          {/each}
        </div>
      </div>

    {:else}
      <div class="space-y-2">
        <input
          type="text"
          placeholder="Search furniture..."
          class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-200 focus:border-blue-400 outline-none"
          bind:value={search}
        />
        <!-- Category filter -->
        <div class="flex flex-wrap gap-1">
          <button
            class="px-2 py-0.5 rounded-full text-[10px] font-medium {selectedCategory === 'All' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}"
            onclick={() => selectedCategory = 'All'}
          >All</button>
          {#each furnitureCategories as cat}
            <button
              class="px-2 py-0.5 rounded-full text-[10px] font-medium {selectedCategory === cat ? 'text-white' : 'text-gray-600 hover:bg-gray-200'}"
              style={selectedCategory === cat ? `background-color: ${categoryColors[cat] ?? '#6b7280'}` : 'background-color: #f3f4f6'}
              onclick={() => selectedCategory = cat}
            >{cat}</button>
          {/each}
        </div>
        <div class="grid grid-cols-2 gap-2 mt-2">
          {#each filtered as item}
            <button
              class="flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-colors cursor-grab active:cursor-grabbing {currentPlacing === item.id ? 'border-blue-400 bg-blue-50 ring-1 ring-blue-300' : 'border-gray-100 hover:border-blue-300 hover:bg-blue-50'}"
              onclick={() => onFurnitureClick(item)}
              draggable="true"
              ondragstart={(e) => { e.dataTransfer?.setData('application/o3d-type', 'furniture'); e.dataTransfer?.setData('application/o3d-id', item.id); }}
            >
              {#if thumbsReady >= 0 && getModelFile(item.id) && getThumbnail(getModelFile(item.id)!)}
                <img src={getThumbnail(getModelFile(item.id)!)} alt={item.name} class="w-12 h-12 object-contain" />
              {:else}
                <div class="w-10 h-10 rounded-lg flex items-center justify-center" style="background-color: {item.color}20">
                  <div class="w-5 h-5 rounded-sm" style="background-color: {item.color}; opacity: 0.7"></div>
                </div>
              {/if}
              <span class="text-xs font-medium text-gray-600">{item.name}</span>
              <span class="text-[10px] text-gray-400">{item.width}×{item.depth}cm</span>
            </button>
          {/each}
        </div>
      </div>
    {/if}
  </div>
</div>

<!-- RoomPlan Import Options Dialog -->
{#if showImportDialog}
  <div class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onclick={cancelImport}>
    <div class="bg-white rounded-xl shadow-2xl w-80 p-5" onclick={(e) => e.stopPropagation()}>
      <h3 class="text-sm font-bold text-gray-800 mb-1">Import RoomPlan</h3>
      <p class="text-xs text-gray-400 mb-4">{importFileName}</p>

      <div class="space-y-3">
        <label class="flex items-start gap-2.5 cursor-pointer">
          <input type="checkbox" bind:checked={optStraighten} class="accent-blue-500 mt-0.5" />
          <div>
            <div class="text-sm font-medium text-gray-700">Straighten walls</div>
            <div class="text-xs text-gray-400">Snap near-horizontal/vertical walls to axis</div>
          </div>
        </label>

        <label class="flex items-start gap-2.5 cursor-pointer">
          <input type="checkbox" bind:checked={optOrthogonal} class="accent-blue-500 mt-0.5" />
          <div>
            <div class="text-sm font-medium text-gray-700">Enforce orthogonal <span class="text-xs text-blue-400 font-mono">{ORTHO_VERSION}</span></div>
            <div class="text-xs text-gray-400">Force all walls to 90°/180° angles</div>
          </div>
        </label>

        <label class="block">
          <div class="text-xs text-gray-500 mb-1">Corner merge distance (cm)</div>
          <input type="number" bind:value={optMergeDistance} min="0" max="50" step="5" class="w-full px-2 py-1 border border-gray-200 rounded text-sm" />
        </label>
      </div>

      <div class="flex gap-2 mt-5">
        <button onclick={cancelImport} class="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors">Cancel</button>
        <button onclick={confirmImport} class="flex-1 px-3 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors">Import</button>
      </div>
    </div>
  </div>
{/if}
