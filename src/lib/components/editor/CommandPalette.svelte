<script lang="ts">
  import { furnitureCatalog } from '$lib/utils/furnitureCatalog';
  import { selectedTool, snapEnabled, placingFurnitureId, undo, redo, currentProject, viewMode } from '$lib/stores/project';
  import { exportAsPNG, exportAsJSON, exportAsSVG, exportPDF } from '$lib/utils/export';
  import { exportDXF } from '$lib/utils/cadExport';
  import { get } from 'svelte/store';
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  import { locale, t } from '$lib/i18n';

  interface Props {
    open: boolean;
  }

  let { open = $bindable(false) }: Props = $props();

  let query = $state('');
  let selectedIndex = $state(0);
  let inputEl: HTMLInputElement | undefined = $state();

  type ResultItem = {
    id: string;
    name: string;
    icon: string;
    category: 'furniture' | 'tool' | 'action';
    categoryLabel: string;
    action: () => void;
  };

  function buildTools(): ResultItem[] {
    const toolLabel = `🔧 ${t('commandPalette.tool')}`;
    return [
      { id: 't-select', name: t('commandPalette.selectTool'), icon: '🔧', category: 'tool', categoryLabel: toolLabel, action: () => selectedTool.set('select') },
      { id: 't-wall', name: t('commandPalette.wallTool'), icon: '🔧', category: 'tool', categoryLabel: toolLabel, action: () => selectedTool.set('wall') },
      { id: 't-door', name: t('commandPalette.doorTool'), icon: '🔧', category: 'tool', categoryLabel: toolLabel, action: () => selectedTool.set('door') },
      { id: 't-window', name: t('commandPalette.windowTool'), icon: '🔧', category: 'tool', categoryLabel: toolLabel, action: () => selectedTool.set('window') },
      { id: 't-furniture', name: t('commandPalette.furnitureTool'), icon: '🔧', category: 'tool', categoryLabel: toolLabel, action: () => selectedTool.set('furniture') },
      { id: 't-text', name: t('commandPalette.textTool'), icon: '🔧', category: 'tool', categoryLabel: toolLabel, action: () => selectedTool.set('text') },
    ];
  }

  function buildActions(): ResultItem[] {
    const actionLabel = `⚡ ${t('commandPalette.action')}`;
    return [
      { id: 'a-export-svg', name: t('commandPalette.exportSvg'), icon: '⚡', category: 'action', categoryLabel: actionLabel, action: () => { const p = get(currentProject); if (p) exportAsSVG(p); } },
      { id: 'a-export-dxf', name: t('commandPalette.exportDxf'), icon: '⚡', category: 'action', categoryLabel: actionLabel, action: () => { const p = get(currentProject); if (p) exportDXF(p); } },
      { id: 'a-export-pdf', name: t('commandPalette.exportPdf'), icon: '⚡', category: 'action', categoryLabel: actionLabel, action: () => { const p = get(currentProject); if (p) exportPDF(p); } },
      { id: 'a-export-png', name: t('commandPalette.exportPng'), icon: '⚡', category: 'action', categoryLabel: actionLabel, action: () => { const canvas = document.querySelector('canvas'); const p = get(currentProject); if (canvas && p) exportAsPNG(canvas, p); } },
      { id: 'a-export-json', name: t('commandPalette.exportJson'), icon: '⚡', category: 'action', categoryLabel: actionLabel, action: () => { const p = get(currentProject); if (p) exportAsJSON(p); } },
      { id: 'a-toggle-grid', name: t('commandPalette.toggleGrid'), icon: '⚡', category: 'action', categoryLabel: actionLabel, action: () => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'g', bubbles: true })); } },
      { id: 'a-toggle-snap', name: t('commandPalette.toggleSnap'), icon: '⚡', category: 'action', categoryLabel: actionLabel, action: () => { snapEnabled.update(v => !v); } },
      { id: 'a-zoom-fit', name: t('commandPalette.zoomToFit'), icon: '⚡', category: 'action', categoryLabel: actionLabel, action: () => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'f', bubbles: true })); } },
      { id: 'a-undo', name: t('commandPalette.undo'), icon: '⚡', category: 'action', categoryLabel: actionLabel, action: () => undo() },
      { id: 'a-redo', name: t('commandPalette.redo'), icon: '⚡', category: 'action', categoryLabel: actionLabel, action: () => redo() },
      { id: 'a-settings', name: t('topbar.settings'), icon: '⚡', category: 'action', categoryLabel: actionLabel, action: () => { window.dispatchEvent(new CustomEvent('open-settings')); } },
      { id: 'a-new-project', name: t('topbar.newProject'), icon: '⚡', category: 'action', categoryLabel: actionLabel, action: () => goto(base || '/') },
      { id: 'a-toggle-3d', name: t('commandPalette.toggle2d3d'), icon: '⚡', category: 'action', categoryLabel: actionLabel, action: () => { viewMode.update(m => m === '2d' ? '3d' : '2d'); } },
    ];
  }

  const furnitureItems: ResultItem[] = furnitureCatalog.map(f => ({
    id: `f-${f.id}`,
    name: f.name,
    icon: f.icon,
    category: 'furniture' as const,
    categoryLabel: `🪑 ${f.category}`,
    action: () => {
      selectedTool.set('furniture');
      placingFurnitureId.set(f.id);
    },
  }));

  let allItems = $derived.by(() => {
    $locale;
    return [...buildActions(), ...buildTools(), ...furnitureItems];
  });

  let results = $derived.by(() => {
    const q = query.toLowerCase().trim();
    if (!q) return allItems.slice(0, 12);
    return allItems.filter(item => item.name.toLowerCase().includes(q) || item.categoryLabel.toLowerCase().includes(q)).slice(0, 20);
  });

  $effect(() => {
    if (open) {
      query = '';
      selectedIndex = 0;
      // Focus after mount
      requestAnimationFrame(() => inputEl?.focus());
    }
  });

  // Reset index when results change
  $effect(() => {
    results; // track
    selectedIndex = 0;
  });

  function execute(item: ResultItem) {
    open = false;
    item.action();
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      selectedIndex = Math.min(selectedIndex + 1, results.length - 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      selectedIndex = Math.max(selectedIndex - 1, 0);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (results[selectedIndex]) execute(results[selectedIndex]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      open = false;
    }
  }
</script>

{#if open}
  {#key $locale}
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div
    class="fixed inset-0 bg-black/40 z-[100] flex justify-center"
    onclick={() => open = false}
    onkeydown={(e) => { if (e.key === 'Escape') open = false; }}
    role="dialog"
    aria-label={t('commandPalette.title')}
  >
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <div
      class="mt-[15vh] w-full max-w-lg h-fit bg-white rounded-xl shadow-2xl overflow-hidden"
      onclick={(e) => e.stopPropagation()}
      onkeydown={() => {}}
      role="listbox"
    >
      <!-- Search input -->
      <div class="flex items-center gap-2 px-4 py-3 border-b border-gray-200">
        <span class="text-gray-400 text-lg">🔍</span>
        <input
          bind:this={inputEl}
          bind:value={query}
          onkeydown={onKeydown}
          class="flex-1 bg-transparent outline-none text-sm text-gray-800 placeholder-gray-400"
          placeholder={t('commandPalette.searchPlaceholder')}
          type="text"
          spellcheck="false"
        />
        <kbd class="text-[10px] px-1.5 py-0.5 bg-gray-100 rounded border border-gray-200 text-gray-400">ESC</kbd>
      </div>

      <!-- Results -->
      <div class="max-h-[50vh] overflow-y-auto">
        {#if results.length === 0}
          <div class="px-4 py-6 text-center text-sm text-gray-400">{t('commandPalette.noResults')}</div>
        {:else}
          {#each results as item, i}
            <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
            <div
              class="flex items-center gap-3 px-4 py-2 cursor-pointer text-sm transition-colors"
              class:bg-blue-50={i === selectedIndex}
              class:text-blue-700={i === selectedIndex}
              class:text-gray-700={i !== selectedIndex}
              onmouseenter={() => selectedIndex = i}
              onclick={() => execute(item)}
              onkeydown={() => {}}
              role="option"
              aria-selected={i === selectedIndex}
            >
              <span class="text-base w-6 text-center flex-shrink-0">{item.icon}</span>
              <span class="flex-1 truncate">{item.name}</span>
              <span class="text-xs text-gray-400 flex-shrink-0">{item.categoryLabel}</span>
            </div>
          {/each}
        {/if}
      </div>

      <!-- Footer hint -->
      <div class="px-4 py-2 border-t border-gray-100 flex items-center gap-3 text-[10px] text-gray-400">
        <span><kbd class="px-1 py-0.5 bg-gray-100 rounded border border-gray-200">↑↓</kbd> {t('commandPalette.navigate')}</span>
        <span><kbd class="px-1 py-0.5 bg-gray-100 rounded border border-gray-200">↵</kbd> {t('commandPalette.select')}</span>
        <span><kbd class="px-1 py-0.5 bg-gray-100 rounded border border-gray-200">esc</kbd> {t('commandPalette.close')}</span>
      </div>
    </div>
  </div>
  {/key}
{/if}
