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
      placePreset(preset, { x: 100, y: 100 });
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
      class="flex-1 py-2.5 text-xs font-semibold uppercase tracking-wide {activeTab === 'draw' ? 'text-green-700 border-b-2 border-green-600 bg-green-50' : 'text-gray-500 hover:text-gray-700'}"
      onclick={() => activeTab = 'draw'}
    >Build</button>
    <button
      class="flex-1 py-2.5 text-xs font-semibold uppercase tracking-wide {activeTab === 'rooms' ? 'text-green-700 border-b-2 border-green-600 bg-green-50' : 'text-gray-500 hover:text-gray-700'}"
      onclick={() => activeTab = 'rooms'}
    >Rooms</button>
    <button
      class="flex-1 py-2.5 text-xs font-semibold uppercase tracking-wide {activeTab === 'objects' ? 'text-green-700 border-b-2 border-green-600 bg-green-50' : 'text-gray-500 hover:text-gray-700'}"
      onclick={() => activeTab = 'objects'}
    >Objects</button>
  </div>

  <div class="flex-1 overflow-y-auto p-3">
    {#if activeTab === 'draw'}
      <div class="space-y-1">
        <h3 class="text-xs font-semibold text-gray-400 uppercase mb-2">Tools</h3>
        <button
          class="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors {currentTool === 'select' ? 'bg-green-50 text-green-700 ring-1 ring-green-200' : 'hover:bg-gray-50 text-gray-700'}"
          onclick={() => setTool('select')}
        >
          <div class="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center text-lg {currentTool === 'select' ? 'bg-green-100' : ''}">↖</div>
          <div class="text-left">
            <div class="font-medium">Select <span class="text-gray-400 text-xs ml-1">V</span></div>
            <div class="text-xs text-gray-400">Click to select elements</div>
          </div>
        </button>
        <button
          class="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors {currentTool === 'wall' ? 'bg-green-50 text-green-700 ring-1 ring-green-200' : 'hover:bg-gray-50 text-gray-700'}"
          onclick={() => setTool('wall')}
        >
          <div class="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center text-lg {currentTool === 'wall' ? 'bg-green-100' : ''}">▭</div>
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
              class="flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-colors {currentTool === 'door' ? 'border-green-400 bg-green-50' : 'border-gray-100 hover:border-gray-200'}"
              onclick={() => setTool('door')}
            >
              <div class="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center text-xl">🚪</div>
              <span class="text-xs font-medium text-gray-600">Door <span class="text-gray-400">D</span></span>
            </button>
            <button
              class="flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-colors {currentTool === 'window' ? 'border-green-400 bg-green-50' : 'border-gray-100 hover:border-gray-200'}"
              onclick={() => setTool('window')}
            >
              <div class="w-10 h-10 rounded-lg bg-cyan-50 flex items-center justify-center text-xl">🪟</div>
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
              class="flex flex-col items-center gap-1.5 p-3 rounded-lg border-2 border-gray-100 hover:border-green-300 hover:bg-green-50 transition-colors"
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
          class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-green-200 focus:border-green-400 outline-none"
          bind:value={search}
        />
        <!-- Category filter -->
        <div class="flex flex-wrap gap-1">
          <button
            class="px-2 py-0.5 rounded-full text-[10px] font-medium {selectedCategory === 'All' ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}"
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
              class="flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-colors {currentPlacing === item.id ? 'border-green-400 bg-green-50 ring-1 ring-green-300' : 'border-gray-100 hover:border-green-300 hover:bg-green-50'}"
              onclick={() => onFurnitureClick(item)}
            >
              <div class="w-10 h-10 rounded-lg flex items-center justify-center text-xl" style="background-color: {item.color}20">{item.icon}</div>
              <span class="text-xs font-medium text-gray-600">{item.name}</span>
              <span class="text-[10px] text-gray-400">{item.width}×{item.depth}cm</span>
            </button>
          {/each}
        </div>
      </div>
    {/if}
  </div>
</div>
