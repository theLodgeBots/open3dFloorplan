<script lang="ts">
  import { snapshotsStore, refreshSnapshots, restoreSnapshot, deleteAllSnapshots, type Snapshot } from '$lib/stores/versionHistory';
  import { currentProject } from '$lib/stores/project';
  import { get } from 'svelte/store';

  let { open = $bindable(false) } = $props();

  let snapshots: Snapshot[] = $state([]);
  snapshotsStore.subscribe(v => { snapshots = v; });

  $effect(() => {
    if (open) refreshSnapshots();
  });

  function formatTime(ts: number): string {
    const d = new Date(ts);
    const now = Date.now();
    const diff = Math.floor((now - ts) / 1000);
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function onRestore(index: number) {
    const p = get(currentProject);
    if (!p) return;
    if (!confirm('Restore this version? Current unsaved changes will be lost.')) return;
    restoreSnapshot(p.id, index);
    open = false;
  }

  function onClearAll() {
    const p = get(currentProject);
    if (!p) return;
    if (!confirm('Delete all version history for this project?')) return;
    deleteAllSnapshots(p.id);
  }
</script>

{#if open}
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" onclick={() => open = false} onkeydown={(e) => { if (e.key === 'Escape') open = false; }}>
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="bg-white rounded-xl shadow-2xl w-96 max-h-[70vh] flex flex-col" onclick={(e) => e.stopPropagation()} onkeydown={() => {}}>
    <div class="flex items-center justify-between px-4 py-3 border-b border-gray-100">
      <h2 class="text-sm font-semibold text-gray-800 flex items-center gap-2">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        Version History
      </h2>
      <button onclick={() => open = false} class="text-gray-400 hover:text-gray-600 transition-colors" aria-label="Close">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>

    <div class="flex-1 overflow-y-auto px-4 py-2">
      {#if snapshots.length === 0}
        <p class="text-sm text-gray-400 text-center py-8">No snapshots yet.<br>Versions are saved automatically every 5 minutes.</p>
      {:else}
        <div class="space-y-1">
          {#each [...snapshots].reverse() as snap, i}
            {@const realIndex = snapshots.length - 1 - i}
            <div class="flex items-center justify-between py-2 px-2 rounded-lg hover:bg-gray-50 group transition-colors">
              <div class="flex-1 min-w-0">
                <div class="text-sm font-medium text-gray-700 truncate">{snap.description}</div>
                <div class="text-xs text-gray-400">{formatTime(snap.timestamp)}</div>
              </div>
              <button
                onclick={() => onRestore(realIndex)}
                class="text-xs px-2.5 py-1 bg-blue-50 text-blue-600 rounded-md hover:bg-blue-100 transition-colors opacity-0 group-hover:opacity-100 font-medium shrink-0 ml-2"
              >
                Restore
              </button>
            </div>
          {/each}
        </div>
      {/if}
    </div>

    {#if snapshots.length > 0}
      <div class="px-4 py-2 border-t border-gray-100">
        <button onclick={onClearAll} class="text-xs text-red-400 hover:text-red-600 transition-colors">
          Clear all versions
        </button>
      </div>
    {/if}
  </div>
</div>
{/if}
