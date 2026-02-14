<script lang="ts">
  import { onMount } from 'svelte';
  import { currentProject, viewMode, selectedElementId, selectedRoomId, createDefaultProject } from '$lib/stores/project';
  import { localStore } from '$lib/services/datastore';
  import TopBar from '$lib/components/toolbar/TopBar.svelte';
  import BuildPanel from '$lib/components/sidebar/BuildPanel.svelte';
  import PropertiesPanel from '$lib/components/sidebar/PropertiesPanel.svelte';
  import LayersPanel from '$lib/components/sidebar/LayersPanel.svelte';

  let showLayers = $state(false);
  import FloorPlanCanvas from '$lib/components/editor/FloorPlanCanvas.svelte';
  import AlignmentToolbar from '$lib/components/editor/AlignmentToolbar.svelte';

  // Lazy-load ThreeViewer to avoid loading Three.js (~1.4MB) until 3D mode is activated
  let ThreeViewer: any = $state(null);
  $effect(() => {
    if (mode === '3d' && !ThreeViewer) {
      import('$lib/components/viewer3d/ThreeViewer.svelte').then(m => { ThreeViewer = m.default; });
    }
  });

  let mode = $state<'2d' | '3d'>('2d');
  let ready = $state(false);
  let showHelp = $state(false);

  viewMode.subscribe((m) => {
    mode = m;
    if (m === '3d') {
      // Clear selection when entering 3D — start in view-only mode
      selectedElementId.set(null);
      selectedRoomId.set(null);
    }
  });

  onMount(async () => {
    const url = new URL(window.location.href);
    const id = url.searchParams.get('id');
    if (id) {
      const project = await localStore.load(id);
      if (project) {
        currentProject.set(project);
      } else {
        // ID not found — create new and update URL
        const p = createDefaultProject();
        currentProject.set(p);
        await localStore.save(p);
        history.replaceState(null, '', `/editor?id=${p.id}`);
      }
    } else {
      // No ID param — create new and update URL
      const p = createDefaultProject();
      currentProject.set(p);
      await localStore.save(p);
      history.replaceState(null, '', `/editor?id=${p.id}`);
    }
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

<svelte:window on:keydown={(e) => { if (e.key === '?' && !e.ctrlKey && !e.metaKey) { showHelp = !showHelp; e.preventDefault(); } if (e.key === 'Escape' && showHelp) { showHelp = false; } if (e.key === 'l' && !e.ctrlKey && !e.metaKey && !e.altKey && (e.target as HTMLElement)?.tagName !== 'INPUT') { showLayers = !showLayers; } }} />

{#if ready}
  <div class="h-screen flex flex-col overflow-hidden">
    <TopBar />
    <div class="flex flex-1 overflow-hidden">
      {#if mode === '2d'}
        <BuildPanel />
      {/if}
      <div class="flex-1 min-w-0 relative">
        {#if mode === '2d'}
          <FloorPlanCanvas />
          <AlignmentToolbar />
        {:else}
          {#if ThreeViewer}
            <ThreeViewer />
          {:else}
            <div class="flex items-center justify-center h-full text-slate-400">Loading 3D viewer…</div>
          {/if}
        {/if}
      </div>
      {#if showLayers && mode === '2d'}
        <LayersPanel />
      {/if}
      <PropertiesPanel is3D={mode === '3d'} />
    </div>
  </div>

  <!-- Layers toggle button -->
  {#if mode === '2d'}
    <button
      class="fixed bottom-4 left-14 w-8 h-8 rounded-full shadow-lg hover:bg-slate-600 transition-colors z-50 text-sm"
      class:bg-blue-600={showLayers}
      class:text-white={showLayers}
      class:bg-slate-700={!showLayers}
      class:text-gray-300={!showLayers}
      onclick={() => showLayers = !showLayers}
      title="Layers Panel (L)"
      aria-label="Toggle Layers Panel"
    >🗂</button>
  {/if}

  <!-- Help button -->
  <button
    class="fixed bottom-4 left-4 w-8 h-8 rounded-full bg-slate-700 text-white text-sm font-bold shadow-lg hover:bg-slate-600 transition-colors z-50"
    onclick={() => showHelp = !showHelp}
    title="Keyboard Shortcuts (?)"
    aria-label="Keyboard Shortcuts"
  >?</button>

  <!-- Shortcuts overlay -->
  {#if showHelp}
    {@const shortcutsCopied = { value: false }}
    <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onclick={() => showHelp = false} onkeydown={(e) => { if (e.key === 'Escape') showHelp = false; }} role="dialog" tabindex="-1" aria-label="Keyboard Shortcuts">
      <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
      <div class="bg-white rounded-2xl shadow-2xl max-w-2xl w-full mx-4 max-h-[85vh] flex flex-col" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.stopPropagation()} role="document">
        <!-- Header -->
        <div class="flex items-center justify-between px-6 pt-5 pb-3 border-b border-gray-100">
          <div class="flex items-center gap-2">
            <svg class="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707"/></svg>
            <h2 class="text-lg font-bold text-slate-800">Keyboard Shortcuts</h2>
          </div>
          <div class="flex items-center gap-2">
            <button
              class="text-xs px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-800 transition-colors flex items-center gap-1.5"
              onclick={() => {
                const text = [
                  'KEYBOARD SHORTCUTS — Open3D Floorplan',
                  '',
                  '── TOOLS ──',
                  'V          Select tool',
                  'W          Wall tool',
                  'D          Door tool',
                  'H          Pan mode',
                  'M          Measure tool',
                  'N          Annotate tool',
                  'T          Text tool',
                  'S          Toggle snap',
                  '',
                  '── EDIT ──',
                  'Ctrl+Z     Undo',
                  'Ctrl+Y     Redo',
                  'Ctrl+C     Copy',
                  'Ctrl+V     Paste',
                  'Ctrl+A     Select all',
                  'Ctrl+D     Deselect all',
                  'Ctrl+S     Save project',
                  'Esc        Cancel / Deselect',
                  '',
                  '── ELEMENTS ──',
                  'R          Rotate element',
                  'Del/Back   Delete selected',
                  'Ctrl+L     Lock/Unlock',
                  'Ctrl+G     Group selection',
                  'Ctrl+⇧+G   Ungroup',
                  '',
                  '── VIEW ──',
                  'Tab        Toggle 2D/3D',
                  'F          Zoom to fit',
                  'G          Toggle grid',
                  'L          Toggle layers',
                  '?          Show shortcuts',
                  '',
                  '── CANVAS ──',
                  'Scroll     Zoom in/out',
                  '+/-        Zoom in/out',
                  'Space+Drag Pan canvas',
                  '',
                  '── WALLS ──',
                  'Dbl-click  Finish wall chain',
                  'C          Close wall loop',
                ].join('\n');
                navigator.clipboard.writeText(text);
              }}
              aria-label="Copy all shortcuts"
            >
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
              Copy All
            </button>
            <button class="text-gray-400 hover:text-gray-600 text-xl leading-none" onclick={() => showHelp = false} aria-label="Close shortcuts">✕</button>
          </div>
        </div>

        <!-- Body -->
        <div class="overflow-y-auto px-6 py-4">
          <div class="grid grid-cols-2 gap-x-8 gap-y-0 text-sm">
            <!-- Left column -->
            <div>
              <!-- Tools -->
              <div class="flex items-center gap-2 mb-2">
                <span class="text-xs font-bold uppercase tracking-wider text-indigo-500">Tools</span>
                <div class="flex-1 h-px bg-indigo-100"></div>
              </div>
              <div class="space-y-1.5 mb-5">
                <div class="flex justify-between"><span class="text-gray-600">Select tool</span><kbd class="px-1.5 py-0.5 bg-gray-100 rounded text-xs font-mono text-slate-700 border border-gray-200">V</kbd></div>
                <div class="flex justify-between"><span class="text-gray-600">Wall tool</span><kbd class="px-1.5 py-0.5 bg-gray-100 rounded text-xs font-mono text-slate-700 border border-gray-200">W</kbd></div>
                <div class="flex justify-between"><span class="text-gray-600">Door tool</span><kbd class="px-1.5 py-0.5 bg-gray-100 rounded text-xs font-mono text-slate-700 border border-gray-200">D</kbd></div>
                <div class="flex justify-between"><span class="text-gray-600">Pan mode</span><kbd class="px-1.5 py-0.5 bg-gray-100 rounded text-xs font-mono text-slate-700 border border-gray-200">H</kbd></div>
                <div class="flex justify-between"><span class="text-gray-600">Measure tool</span><kbd class="px-1.5 py-0.5 bg-gray-100 rounded text-xs font-mono text-slate-700 border border-gray-200">M</kbd></div>
                <div class="flex justify-between"><span class="text-gray-600">Annotate tool</span><kbd class="px-1.5 py-0.5 bg-gray-100 rounded text-xs font-mono text-slate-700 border border-gray-200">N</kbd></div>
                <div class="flex justify-between"><span class="text-gray-600">Text tool</span><kbd class="px-1.5 py-0.5 bg-gray-100 rounded text-xs font-mono text-slate-700 border border-gray-200">T</kbd></div>
                <div class="flex justify-between"><span class="text-gray-600">Toggle snap</span><kbd class="px-1.5 py-0.5 bg-gray-100 rounded text-xs font-mono text-slate-700 border border-gray-200">S</kbd></div>
              </div>

              <!-- Edit -->
              <div class="flex items-center gap-2 mb-2">
                <span class="text-xs font-bold uppercase tracking-wider text-amber-500">Edit</span>
                <div class="flex-1 h-px bg-amber-100"></div>
              </div>
              <div class="space-y-1.5 mb-5">
                <div class="flex justify-between"><span class="text-gray-600">Undo</span><kbd class="px-1.5 py-0.5 bg-gray-100 rounded text-xs font-mono text-slate-700 border border-gray-200">Ctrl+Z</kbd></div>
                <div class="flex justify-between"><span class="text-gray-600">Redo</span><kbd class="px-1.5 py-0.5 bg-gray-100 rounded text-xs font-mono text-slate-700 border border-gray-200">Ctrl+Y</kbd></div>
                <div class="flex justify-between"><span class="text-gray-600">Copy</span><kbd class="px-1.5 py-0.5 bg-gray-100 rounded text-xs font-mono text-slate-700 border border-gray-200">Ctrl+C</kbd></div>
                <div class="flex justify-between"><span class="text-gray-600">Paste</span><kbd class="px-1.5 py-0.5 bg-gray-100 rounded text-xs font-mono text-slate-700 border border-gray-200">Ctrl+V</kbd></div>
                <div class="flex justify-between"><span class="text-gray-600">Select all</span><kbd class="px-1.5 py-0.5 bg-gray-100 rounded text-xs font-mono text-slate-700 border border-gray-200">Ctrl+A</kbd></div>
                <div class="flex justify-between"><span class="text-gray-600">Deselect all</span><kbd class="px-1.5 py-0.5 bg-gray-100 rounded text-xs font-mono text-slate-700 border border-gray-200">Ctrl+D</kbd></div>
                <div class="flex justify-between"><span class="text-gray-600">Save project</span><kbd class="px-1.5 py-0.5 bg-gray-100 rounded text-xs font-mono text-slate-700 border border-gray-200">Ctrl+S</kbd></div>
                <div class="flex justify-between"><span class="text-gray-600">Cancel / Deselect</span><kbd class="px-1.5 py-0.5 bg-gray-100 rounded text-xs font-mono text-slate-700 border border-gray-200">Esc</kbd></div>
              </div>
            </div>

            <!-- Right column -->
            <div>
              <!-- Elements -->
              <div class="flex items-center gap-2 mb-2">
                <span class="text-xs font-bold uppercase tracking-wider text-emerald-500">Elements</span>
                <div class="flex-1 h-px bg-emerald-100"></div>
              </div>
              <div class="space-y-1.5 mb-5">
                <div class="flex justify-between"><span class="text-gray-600">Rotate element</span><kbd class="px-1.5 py-0.5 bg-gray-100 rounded text-xs font-mono text-slate-700 border border-gray-200">R</kbd></div>
                <div class="flex justify-between"><span class="text-gray-600">Delete selected</span><kbd class="px-1.5 py-0.5 bg-gray-100 rounded text-xs font-mono text-slate-700 border border-gray-200">Del</kbd></div>
                <div class="flex justify-between"><span class="text-gray-600">Lock / Unlock</span><kbd class="px-1.5 py-0.5 bg-gray-100 rounded text-xs font-mono text-slate-700 border border-gray-200">Ctrl+L</kbd></div>
                <div class="flex justify-between"><span class="text-gray-600">Group selection</span><kbd class="px-1.5 py-0.5 bg-gray-100 rounded text-xs font-mono text-slate-700 border border-gray-200">Ctrl+G</kbd></div>
                <div class="flex justify-between"><span class="text-gray-600">Ungroup</span><kbd class="px-1.5 py-0.5 bg-gray-100 rounded text-xs font-mono text-slate-700 border border-gray-200">Ctrl+⇧+G</kbd></div>
              </div>

              <!-- View -->
              <div class="flex items-center gap-2 mb-2">
                <span class="text-xs font-bold uppercase tracking-wider text-blue-500">View</span>
                <div class="flex-1 h-px bg-blue-100"></div>
              </div>
              <div class="space-y-1.5 mb-5">
                <div class="flex justify-between"><span class="text-gray-600">Toggle 2D / 3D</span><kbd class="px-1.5 py-0.5 bg-gray-100 rounded text-xs font-mono text-slate-700 border border-gray-200">Tab</kbd></div>
                <div class="flex justify-between"><span class="text-gray-600">Zoom to fit</span><kbd class="px-1.5 py-0.5 bg-gray-100 rounded text-xs font-mono text-slate-700 border border-gray-200">F</kbd></div>
                <div class="flex justify-between"><span class="text-gray-600">Toggle grid</span><kbd class="px-1.5 py-0.5 bg-gray-100 rounded text-xs font-mono text-slate-700 border border-gray-200">G</kbd></div>
                <div class="flex justify-between"><span class="text-gray-600">Toggle layers</span><kbd class="px-1.5 py-0.5 bg-gray-100 rounded text-xs font-mono text-slate-700 border border-gray-200">L</kbd></div>
                <div class="flex justify-between"><span class="text-gray-600">Show shortcuts</span><kbd class="px-1.5 py-0.5 bg-gray-100 rounded text-xs font-mono text-slate-700 border border-gray-200">?</kbd></div>
              </div>

              <!-- Canvas -->
              <div class="flex items-center gap-2 mb-2">
                <span class="text-xs font-bold uppercase tracking-wider text-purple-500">Canvas</span>
                <div class="flex-1 h-px bg-purple-100"></div>
              </div>
              <div class="space-y-1.5 mb-5">
                <div class="flex justify-between"><span class="text-gray-600">Zoom in / out</span><kbd class="px-1.5 py-0.5 bg-gray-100 rounded text-xs font-mono text-slate-700 border border-gray-200">Scroll</kbd></div>
                <div class="flex justify-between"><span class="text-gray-600">Zoom in / out</span><kbd class="px-1.5 py-0.5 bg-gray-100 rounded text-xs font-mono text-slate-700 border border-gray-200">+ / −</kbd></div>
                <div class="flex justify-between"><span class="text-gray-600">Pan canvas</span><kbd class="px-1.5 py-0.5 bg-gray-100 rounded text-xs font-mono text-slate-700 border border-gray-200">Space+Drag</kbd></div>
              </div>

              <!-- Walls -->
              <div class="flex items-center gap-2 mb-2">
                <span class="text-xs font-bold uppercase tracking-wider text-rose-500">Walls</span>
                <div class="flex-1 h-px bg-rose-100"></div>
              </div>
              <div class="space-y-1.5">
                <div class="flex justify-between"><span class="text-gray-600">Finish wall chain</span><kbd class="px-1.5 py-0.5 bg-gray-100 rounded text-xs font-mono text-slate-700 border border-gray-200">Dbl-click</kbd></div>
                <div class="flex justify-between"><span class="text-gray-600">Close wall loop</span><kbd class="px-1.5 py-0.5 bg-gray-100 rounded text-xs font-mono text-slate-700 border border-gray-200">C</kbd></div>
              </div>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="px-6 py-3 border-t border-gray-100 text-center">
          <p class="text-xs text-gray-400">Press <kbd class="px-1 py-0.5 bg-gray-100 rounded text-xs font-mono border border-gray-200">?</kbd> or <kbd class="px-1 py-0.5 bg-gray-100 rounded text-xs font-mono border border-gray-200">Esc</kbd> to close</p>
        </div>
      </div>
    </div>
  {/if}
{:else}
  <div class="h-screen flex items-center justify-center">
    <p class="text-gray-400">Loading...</p>
  </div>
{/if}
