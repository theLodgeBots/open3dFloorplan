<script lang="ts">
  import { onMount } from 'svelte';
  import { currentProject, viewMode, createDefaultProject } from '$lib/stores/project';
  import { localStore } from '$lib/services/datastore';
  import TopBar from '$lib/components/toolbar/TopBar.svelte';
  import BuildPanel from '$lib/components/sidebar/BuildPanel.svelte';
  import PropertiesPanel from '$lib/components/sidebar/PropertiesPanel.svelte';
  import FloorPlanCanvas from '$lib/components/editor/FloorPlanCanvas.svelte';
  import ThreeViewer from '$lib/components/viewer3d/ThreeViewer.svelte';

  let mode = $state<'2d' | '3d'>('2d');
  let ready = $state(false);
  let showHelp = $state(false);

  viewMode.subscribe((m) => { mode = m; });

  onMount(async () => {
    const url = new URL(window.location.href);
    const id = url.searchParams.get('id');
    if (id) {
      const project = await localStore.load(id);
      if (project) {
        currentProject.set(project);
        ready = true;
        return;
      }
    }
    currentProject.set(createDefaultProject());
    ready = true;

    // Auto-save on every project change (debounced)
    let saveTimeout: ReturnType<typeof setTimeout>;
    const unsub = currentProject.subscribe((p) => {
      if (!p) return;
      clearTimeout(saveTimeout);
      saveTimeout = setTimeout(() => localStore.save(p), 500);
    });
    return () => { unsub(); clearTimeout(saveTimeout); };
  });
</script>

<svelte:window on:keydown={(e) => { if (e.key === '?' && !e.ctrlKey && !e.metaKey) { showHelp = !showHelp; e.preventDefault(); } if (e.key === 'Escape' && showHelp) { showHelp = false; } }} />

{#if ready}
  <div class="h-screen flex flex-col">
    <TopBar />
    <div class="flex flex-1 overflow-hidden">
      <BuildPanel />
      <div class="flex-1 relative">
        {#if mode === '2d'}
          <FloorPlanCanvas />
        {:else}
          <ThreeViewer />
        {/if}
      </div>
      <PropertiesPanel />
    </div>
  </div>

  <!-- Help button -->
  <button
    class="fixed bottom-4 left-4 w-8 h-8 rounded-full bg-slate-700 text-white text-sm font-bold shadow-lg hover:bg-slate-600 transition-colors z-50"
    onclick={() => showHelp = !showHelp}
    title="Keyboard Shortcuts (?)"
  >?</button>

  <!-- Shortcuts overlay -->
  {#if showHelp}
    <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onclick={() => showHelp = false} onkeydown={(e) => { if (e.key === 'Escape') showHelp = false; }} role="dialog" tabindex="-1" aria-label="Keyboard Shortcuts">
      <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
      <div class="bg-white rounded-xl shadow-2xl p-6 max-w-md w-full mx-4" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.stopPropagation()} role="document">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-lg font-bold text-slate-800">Keyboard Shortcuts</h2>
          <button class="text-gray-400 hover:text-gray-600 text-xl" onclick={() => showHelp = false}>✕</button>
        </div>
        <div class="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <div class="font-semibold text-gray-400 col-span-2 mt-2 mb-1 uppercase text-xs">Tools</div>
          <div class="text-gray-600">Select tool</div><div class="font-mono text-slate-800">V</div>
          <div class="text-gray-600">Wall tool</div><div class="font-mono text-slate-800">W</div>
          <div class="text-gray-600">Door tool</div><div class="font-mono text-slate-800">D</div>
          <div class="text-gray-600">Delete selected</div><div class="font-mono text-slate-800">Del / Backspace</div>

          <div class="font-semibold text-gray-400 col-span-2 mt-3 mb-1 uppercase text-xs">Canvas</div>
          <div class="text-gray-600">Pan</div><div class="font-mono text-slate-800">Space + Drag</div>
          <div class="text-gray-600">Zoom</div><div class="font-mono text-slate-800">Scroll</div>
          <div class="text-gray-600">Toggle grid</div><div class="font-mono text-slate-800">G</div>
          <div class="text-gray-600">Measure</div><div class="font-mono text-slate-800">M / Right-click</div>

          <div class="font-semibold text-gray-400 col-span-2 mt-3 mb-1 uppercase text-xs">Edit</div>
          <div class="text-gray-600">Undo</div><div class="font-mono text-slate-800">Ctrl+Z</div>
          <div class="text-gray-600">Redo</div><div class="font-mono text-slate-800">Ctrl+Y</div>
          <div class="text-gray-600">Rotate furniture</div><div class="font-mono text-slate-800">R / Scroll</div>
          <div class="text-gray-600">Cancel action</div><div class="font-mono text-slate-800">Esc</div>

          <div class="font-semibold text-gray-400 col-span-2 mt-3 mb-1 uppercase text-xs">Walls</div>
          <div class="text-gray-600">Finish wall chain</div><div class="font-mono text-slate-800">Double-click</div>
          <div class="text-gray-600">Close wall loop</div><div class="font-mono text-slate-800">C / Click start point</div>
        </div>
        <p class="text-xs text-gray-400 mt-4 text-center">Press <span class="font-mono">?</span> or <span class="font-mono">Esc</span> to close</p>
      </div>
    </div>
  {/if}
{:else}
  <div class="h-screen flex items-center justify-center">
    <p class="text-gray-400">Loading...</p>
  </div>
{/if}
