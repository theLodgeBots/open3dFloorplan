<script lang="ts">
  import { selectedTool, placingFurnitureId } from '$lib/stores/project';
  import type { Tool } from '$lib/stores/project';
  import { roomPresets, placePreset } from '$lib/utils/roomPresets';
  import { furnitureCatalog, furnitureCategories } from '$lib/utils/furnitureCatalog';
  import type { FurnitureDef } from '$lib/utils/furnitureCatalog';

  let activeTab = $state<'draw' | 'rooms' | 'objects'>('draw');
  let constructionOpen = $state(true);
  let selectedCategory = $state<string>('All');

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

  const categoryColors: Record<string, string> = {
    'Living Room': '#a78bfa',
    'Bedroom': '#60a5fa',
    'Kitchen': '#f87171',
    'Bathroom': '#93c5fd',
    'Office': '#34d399',
    'Dining': '#f59e0b',
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

        <button
          class="w-full flex items-center justify-between px-1 py-2 mt-3"
          onclick={() => constructionOpen = !constructionOpen}
        >
          <h3 class="text-xs font-semibold text-gray-400 uppercase">Construction</h3>
          <span class="text-gray-400 text-xs">{constructionOpen ? '▼' : '▶'}</span>
        </button>

        {#if constructionOpen}
          <div class="grid grid-cols-2 gap-2">
            <button
              class="flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-colors {currentTool === 'door' ? 'border-blue-400 bg-blue-50' : 'border-gray-100 hover:border-gray-200'}"
              onclick={() => setTool('door')}
            >
              <div class="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#92400e" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="3" width="12" height="18" rx="1"/><circle cx="15" cy="12" r="1" fill="#92400e"/><path d="M6 21H4V3h2"/></svg>
              </div>
              <span class="text-xs font-medium text-gray-600">Door <span class="text-gray-400">D</span></span>
            </button>
            <button
              class="flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-colors {currentTool === 'window' ? 'border-blue-400 bg-blue-50' : 'border-gray-100 hover:border-gray-200'}"
              onclick={() => setTool('window')}
            >
              <div class="w-10 h-10 rounded-lg bg-cyan-50 flex items-center justify-center">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0e7490" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="1"/><line x1="12" y1="4" x2="12" y2="20"/><line x1="3" y1="12" x2="21" y2="12"/></svg>
              </div>
              <span class="text-xs font-medium text-gray-600">Window</span>
            </button>
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
              class="flex flex-col items-center gap-1.5 p-3 rounded-lg border-2 border-gray-100 hover:border-blue-300 hover:bg-blue-50 transition-colors"
              onclick={() => onPresetClick(preset.id)}
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
              class="flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-colors {currentPlacing === item.id ? 'border-blue-400 bg-blue-50 ring-1 ring-blue-300' : 'border-gray-100 hover:border-blue-300 hover:bg-blue-50'}"
              onclick={() => onFurnitureClick(item)}
            >
              <div class="w-10 h-10 rounded-lg flex items-center justify-center" style="background-color: {item.color}20">
                <div class="w-5 h-5 rounded-sm" style="background-color: {item.color}; opacity: 0.7"></div>
              </div>
              <span class="text-xs font-medium text-gray-600">{item.name}</span>
              <span class="text-[10px] text-gray-400">{item.width}×{item.depth}cm</span>
            </button>
          {/each}
        </div>
      </div>
    {/if}
  </div>
</div>
