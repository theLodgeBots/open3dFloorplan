<script lang="ts">
  import { wallColors, type WallColor } from '$lib/utils/materials';
  import { updateWall } from '$lib/stores/project';
  import type { Wall } from '$lib/models/types';

  interface Props {
    wall: Wall;
    screenX: number;
    screenY: number;
    onclose: () => void;
  }

  let { wall, screenX, screenY, onclose }: Props = $props();

  let activeTab: 'interior' | 'exterior' = $state('interior');

  // Preview state — stores uncommitted changes
  let previewInteriorColor: string | null = $state(null);
  let previewInteriorTexture: string | null = $state(null);
  let previewExteriorColor: string | null = $state(null);
  let previewExteriorTexture: string | null = $state(null);

  // Quick-access material presets
  const quickMaterials: { id: string; name: string; icon: string; wallColorId: string }[] = [
    { id: 'brick', name: 'Brick', icon: '🧱', wallColorId: 'red-brick' },
    { id: 'concrete', name: 'Concrete', icon: '🏗️', wallColorId: 'concrete-block' },
    { id: 'stucco', name: 'Stucco', icon: '🏠', wallColorId: 'cream' },
    { id: 'drywall', name: 'Drywall', icon: '⬜', wallColorId: 'white' },
    { id: 'wood', name: 'Wood Panel', icon: '🪵', wallColorId: 'wood-panel' },
    { id: 'stone', name: 'Stone', icon: '🪨', wallColorId: 'stone' },
    { id: 'tile', name: 'Subway Tile', icon: '🔲', wallColorId: 'subway-tile' },
  ];

  const textureThumbs: Record<string, string> = {
    'red-brick': '/textures/brick.jpg',
    'exposed-brick': '/textures/exposed-brick.jpg',
    'stone': '/textures/stone.jpg',
    'wood-panel': '/textures/wood-panel.jpg',
    'concrete-block': '/textures/concrete.jpg',
    'subway-tile': '/textures/subway-tile.jpg',
  };

  const plainColors = wallColors.filter(wc => !wc.texture);
  const texturedColors = wallColors.filter(wc => wc.texture);

  function getCurrentColor(side: 'interior' | 'exterior'): string {
    if (side === 'interior') return previewInteriorColor ?? wall.interiorColor ?? wall.color ?? '#ffffff';
    return previewExteriorColor ?? wall.exteriorColor ?? wall.color ?? '#d4cfc9';
  }

  function getCurrentTexture(side: 'interior' | 'exterior'): string | undefined {
    if (side === 'interior') {
      const t = previewInteriorTexture ?? wall.interiorTexture ?? wall.texture;
      return t === 'none' ? undefined : t;
    }
    const t = previewExteriorTexture ?? wall.exteriorTexture ?? wall.texture;
    return t === 'none' ? undefined : t;
  }

  function applyQuickMaterial(preset: typeof quickMaterials[0]) {
    const wc = wallColors.find(c => c.id === preset.wallColorId);
    if (!wc) return;
    
    const updates: Partial<Wall> = {};
    if (activeTab === 'interior') {
      updates.interiorColor = wc.color;
      updates.interiorTexture = wc.texture ?? 'none';
      previewInteriorColor = wc.color;
      previewInteriorTexture = wc.texture ?? 'none';
    } else {
      updates.exteriorColor = wc.color;
      updates.exteriorTexture = wc.texture ?? 'none';
      previewExteriorColor = wc.color;
      previewExteriorTexture = wc.texture ?? 'none';
    }
    updateWall(wall.id, updates);
  }

  function applyColor(wc: WallColor) {
    const updates: Partial<Wall> = {};
    if (activeTab === 'interior') {
      updates.interiorColor = wc.color;
      if (wc.texture) {
        updates.interiorTexture = wc.id;
      }
      previewInteriorColor = wc.color;
      previewInteriorTexture = wc.texture ? wc.id : (previewInteriorTexture ?? wall.interiorTexture ?? null);
    } else {
      updates.exteriorColor = wc.color;
      if (wc.texture) {
        updates.exteriorTexture = wc.id;
      }
      previewExteriorColor = wc.color;
      previewExteriorTexture = wc.texture ? wc.id : (previewExteriorTexture ?? wall.exteriorTexture ?? null);
    }
    updateWall(wall.id, updates);
  }

  function applyTexture(wc: WallColor) {
    const updates: Partial<Wall> = {};
    if (activeTab === 'interior') {
      updates.interiorTexture = wc.id;
      updates.interiorColor = wc.color;
      previewInteriorTexture = wc.id;
      previewInteriorColor = wc.color;
    } else {
      updates.exteriorTexture = wc.id;
      updates.exteriorColor = wc.color;
      previewExteriorTexture = wc.id;
      previewExteriorColor = wc.color;
    }
    updateWall(wall.id, updates);
  }

  function clearTexture() {
    const updates: Partial<Wall> = {};
    if (activeTab === 'interior') {
      updates.interiorTexture = 'none';
      previewInteriorTexture = 'none';
    } else {
      updates.exteriorTexture = 'none';
      previewExteriorTexture = 'none';
    }
    updateWall(wall.id, updates);
  }

  function applyCustomColor(e: Event) {
    const color = (e.target as HTMLInputElement).value;
    const updates: Partial<Wall> = {};
    if (activeTab === 'interior') {
      updates.interiorColor = color;
      previewInteriorColor = color;
    } else {
      updates.exteriorColor = color;
      previewExteriorColor = color;
    }
    updateWall(wall.id, updates);
  }

  // Clamp position to viewport
  function clampX(x: number): number {
    return Math.min(Math.max(x, 16), (typeof window !== 'undefined' ? window.innerWidth : 1200) - 336);
  }
  function clampY(y: number): number {
    return Math.min(Math.max(y, 16), (typeof window !== 'undefined' ? window.innerHeight : 800) - 500);
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="fixed z-[100] bg-gray-900/95 backdrop-blur-md rounded-xl shadow-2xl border border-gray-700 text-white w-[320px] select-none"
  style="left: {clampX(screenX + 20)}px; top: {clampY(screenY - 40)}px;"
  onclick={(e) => e.stopPropagation()}
  onpointerdown={(e) => e.stopPropagation()}
>
  <!-- Header -->
  <div class="flex items-center justify-between px-3 py-2 border-b border-gray-700">
    <div class="flex items-center gap-2">
      <span class="text-lg">🎨</span>
      <span class="font-semibold text-sm">Material Editor</span>
    </div>
    <button
      onclick={onclose}
      class="text-gray-400 hover:text-white p-1 rounded hover:bg-gray-700 transition-colors"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
      </svg>
    </button>
  </div>

  <!-- Interior / Exterior Tabs -->
  <div class="flex border-b border-gray-700">
    <button
      class="flex-1 py-2 text-xs font-medium transition-colors {activeTab === 'interior' ? 'text-blue-400 border-b-2 border-blue-400 bg-blue-500/10' : 'text-gray-400 hover:text-gray-200'}"
      onclick={() => activeTab = 'interior'}
    >
      🏠 Interior
    </button>
    <button
      class="flex-1 py-2 text-xs font-medium transition-colors {activeTab === 'exterior' ? 'text-orange-400 border-b-2 border-orange-400 bg-orange-500/10' : 'text-gray-400 hover:text-gray-200'}"
      onclick={() => activeTab = 'exterior'}
    >
      🏗️ Exterior
    </button>
  </div>

  <div class="p-3 space-y-3 max-h-[420px] overflow-y-auto">
    <!-- Current preview -->
    <div class="flex items-center gap-2 text-xs text-gray-400">
      <span>Current:</span>
      <div
        class="w-6 h-6 rounded border border-gray-600"
        style="background-color: {getCurrentColor(activeTab)}"
      ></div>
      {#if getCurrentTexture(activeTab)}
        <span class="text-gray-300">{getCurrentTexture(activeTab)}</span>
      {/if}
      <div class="ml-auto">
        <input
          type="color"
          value={getCurrentColor(activeTab)}
          oninput={applyCustomColor}
          class="w-6 h-6 rounded border border-gray-600 cursor-pointer bg-transparent"
          title="Custom color"
        />
      </div>
    </div>

    <!-- Quick Materials -->
    <div>
      <div class="text-xs text-gray-400 mb-1.5 font-medium">Quick Materials</div>
      <div class="grid grid-cols-4 gap-1.5">
        {#each quickMaterials as preset}
          {@const wc = wallColors.find(c => c.id === preset.wallColorId)}
          {@const isActive = wc && getCurrentColor(activeTab) === wc.color && (wc.texture ? getCurrentTexture(activeTab) === wc.id : !getCurrentTexture(activeTab))}
          <button
            class="flex flex-col items-center gap-0.5 p-1.5 rounded-lg border transition-all {isActive ? 'border-blue-400 bg-blue-500/20 ring-1 ring-blue-400' : 'border-gray-700 hover:border-gray-500 hover:bg-gray-800'}"
            onclick={() => applyQuickMaterial(preset)}
            title={preset.name}
          >
            {#if textureThumbs[preset.wallColorId]}
              <img src={textureThumbs[preset.wallColorId]} alt={preset.name} class="w-10 h-10 rounded object-cover" />
            {:else}
              <div class="w-10 h-10 rounded flex items-center justify-center text-xl" style="background-color: {wc?.color ?? '#888'}">{preset.icon}</div>
            {/if}
            <span class="text-[10px] text-gray-300 leading-tight text-center">{preset.name}</span>
          </button>
        {/each}
      </div>
    </div>

    <!-- Paint Colors -->
    <div>
      <div class="text-xs text-gray-400 mb-1.5 font-medium">Paint Colors</div>
      <div class="flex flex-wrap gap-1">
        {#each plainColors as wc}
          {@const isActive = getCurrentColor(activeTab) === wc.color && !getCurrentTexture(activeTab)}
          <button
            class="w-7 h-7 rounded-md border-2 transition-all hover:scale-110 {isActive ? 'border-blue-400 ring-1 ring-blue-400 scale-110' : 'border-gray-600 hover:border-gray-400'}"
            style="background-color: {wc.color}"
            onclick={() => { applyColor(wc); clearTexture(); }}
            title={wc.name}
          ></button>
        {/each}
      </div>
    </div>

    <!-- Textured Materials -->
    <div>
      <div class="text-xs text-gray-400 mb-1.5 font-medium">Textures</div>
      <div class="grid grid-cols-3 gap-1.5">
        {#each texturedColors as wc}
          {@const thumbUrl = textureThumbs[wc.id]}
          {@const isActive = getCurrentTexture(activeTab) === wc.id}
          <button
            class="relative rounded-lg border-2 overflow-hidden transition-all hover:scale-105 {isActive ? 'border-blue-400 ring-1 ring-blue-400' : 'border-gray-700 hover:border-gray-500'}"
            onclick={() => applyTexture(wc)}
            title={wc.name}
          >
            {#if thumbUrl}
              <img src={thumbUrl} alt={wc.name} class="w-full h-14 object-cover" />
            {:else}
              <div class="w-full h-14" style="background-color: {wc.color}"></div>
            {/if}
            <div class="absolute bottom-0 inset-x-0 bg-black/60 text-[10px] py-0.5 text-center">{wc.name}</div>
          </button>
        {/each}
        <!-- Clear texture button -->
        <button
          class="relative rounded-lg border-2 overflow-hidden transition-all hover:scale-105 {!getCurrentTexture(activeTab) ? 'border-blue-400 ring-1 ring-blue-400' : 'border-gray-700 hover:border-gray-500'}"
          onclick={clearTexture}
          title="No Texture"
        >
          <div class="w-full h-14 flex items-center justify-center bg-gray-800 text-gray-400">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </div>
          <div class="absolute bottom-0 inset-x-0 bg-black/60 text-[10px] py-0.5 text-center">None</div>
        </button>
      </div>
    </div>
  </div>
</div>
