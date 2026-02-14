<script lang="ts">
  import { activeFloor, selectedElementId, layerVisibility } from '$lib/stores/project';
  import { getCatalogItem } from '$lib/utils/furnitureCatalog';
  import type { Floor } from '$lib/models/types';

  let floor: Floor | null = $state(null);
  activeFloor.subscribe(f => { floor = f; });

  let selId: string | null = $state(null);
  selectedElementId.subscribe(id => { selId = id; });

  let vis = $state({ walls: true, doors: true, windows: true, furniture: true, stairs: true, columns: true, guides: true, measurements: true, annotations: true });
  layerVisibility.subscribe(v => { vis = v; });

  // Collapsed state per category
  let collapsed: Record<string, boolean> = $state({});

  function toggle(cat: string) {
    collapsed[cat] = !collapsed[cat];
  }

  function toggleVisibility(cat: keyof typeof vis) {
    layerVisibility.update(v => ({ ...v, [cat]: !v[cat] }));
  }

  function select(id: string) {
    selectedElementId.set(id);
  }

  interface Category {
    key: keyof typeof vis;
    label: string;
    icon: string;
    items: { id: string; label: string; icon: string }[];
  }

  let categories: Category[] = $derived.by(() => {
    if (!floor) return [];
    const cats: Category[] = [];

    cats.push({
      key: 'walls', label: 'Walls', icon: '🧱',
      items: floor.walls.map((w, i) => ({ id: w.id, label: `Wall ${i + 1}`, icon: '─' })),
    });

    cats.push({
      key: 'doors', label: 'Doors', icon: '🚪',
      items: floor.doors.map((d, i) => ({ id: d.id, label: `${d.type} door ${i + 1}`, icon: '🚪' })),
    });

    cats.push({
      key: 'windows', label: 'Windows', icon: '🪟',
      items: floor.windows.map((w, i) => ({ id: w.id, label: `${w.type} window ${i + 1}`, icon: '🪟' })),
    });

    cats.push({
      key: 'furniture', label: 'Furniture', icon: '🪑',
      items: floor.furniture.map((fi) => {
        const cat = getCatalogItem(fi.catalogId);
        return { id: fi.id, label: cat?.name ?? fi.catalogId, icon: cat?.icon ?? '📦' };
      }),
    });

    if (floor.stairs?.length) {
      cats.push({
        key: 'stairs', label: 'Stairs', icon: '🪜',
        items: floor.stairs.map((s, i) => ({ id: s.id, label: `Stair ${i + 1} (${s.direction})`, icon: '🪜' })),
      });
    }

    if (floor.columns?.length) {
      cats.push({
        key: 'columns', label: 'Columns', icon: '🏛️',
        items: floor.columns.map((c, i) => ({ id: c.id, label: `${c.shape} column ${i + 1}`, icon: '🏛️' })),
      });
    }

    if (floor.guides?.length) {
      cats.push({
        key: 'guides', label: 'Guides', icon: '📏',
        items: floor.guides.map((g, i) => ({ id: g.id, label: `${g.orientation} guide ${i + 1}`, icon: g.orientation === 'horizontal' ? '─' : '│' })),
      });
    }

    if (floor.measurements?.length) {
      cats.push({
        key: 'measurements', label: 'Measurements', icon: '📐',
        items: floor.measurements.map((m, i) => {
          const dist = Math.round(Math.hypot(m.x2 - m.x1, m.y2 - m.y1));
          return { id: m.id, label: `Measurement ${i + 1} (${dist} cm)`, icon: '📐' };
        }),
      });
    }

    if (floor.annotations?.length) {
      cats.push({
        key: 'annotations', label: 'Annotations', icon: '📏',
        items: floor.annotations.map((a, i) => {
          const dist = Math.round(Math.hypot(a.x2 - a.x1, a.y2 - a.y1));
          const label = a.label || `${dist} cm`;
          return { id: a.id, label: `Annotation ${i + 1} (${label})`, icon: '📏' };
        }),
      });
    }

    return cats;
  });
</script>

<div class="w-56 bg-white border-l border-gray-200 flex flex-col overflow-hidden text-xs select-none">
  <div class="px-3 py-2 border-b border-gray-100 font-semibold text-gray-700 text-sm flex items-center gap-1.5">
    🗂 Layers
  </div>
  <div class="flex-1 overflow-y-auto">
    {#each categories as cat}
      <div class="border-b border-gray-50 relative">
        <!-- Category header -->
        <button
          class="w-full flex items-center gap-1.5 px-2 py-1.5 hover:bg-gray-50 text-left"
          onclick={() => toggle(cat.key)}
        >
          <span class="text-[10px] text-gray-400 w-3">{collapsed[cat.key] ? '▸' : '▾'}</span>
          <span>{cat.icon}</span>
          <span class="font-medium text-gray-700 flex-1">{cat.label}</span>
          <span class="text-gray-400 mr-1">{cat.items.length}</span>
        </button>
        <!-- Visibility toggle (outside button to avoid nesting) -->
        <span
          role="button"
          tabindex="0"
          class="inline-flex p-0.5 rounded hover:bg-gray-200 text-sm leading-none cursor-pointer absolute right-2 top-1.5"
          class:opacity-30={!vis[cat.key]}
          onclick={(e) => { e.stopPropagation(); toggleVisibility(cat.key); }}
          onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleVisibility(cat.key); } }}
          title={vis[cat.key] ? `Hide ${cat.label}` : `Show ${cat.label}`}
        >👁</span>
        <!-- Items -->
        {#if !collapsed[cat.key]}
          {#each cat.items as item}
            <button
              class="w-full flex items-center gap-1.5 pl-7 pr-2 py-1 hover:bg-blue-50 text-left transition-colors"
              class:bg-blue-100={selId === item.id}
              class:text-blue-700={selId === item.id}
              class:opacity-40={!vis[cat.key]}
              onclick={() => select(item.id)}
            >
              <span class="text-[10px]">{item.icon}</span>
              <span class="truncate flex-1">{item.label}</span>
            </button>
          {/each}
          {#if cat.items.length === 0}
            <div class="pl-7 pr-2 py-1 text-gray-300 italic">Empty</div>
          {/if}
        {/if}
      </div>
    {/each}
    {#if categories.length === 0}
      <div class="p-4 text-gray-400 text-center">No elements</div>
    {/if}
  </div>
</div>
