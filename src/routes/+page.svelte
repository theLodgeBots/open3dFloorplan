<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { localStore } from '$lib/services/datastore';
  import { createDefaultProject, currentProject } from '$lib/stores/project';
  import WelcomeScreen from '$lib/components/WelcomeScreen.svelte';
  import { houseTemplates } from '$lib/utils/houseTemplates';

  let projects = $state<{ id: string; name: string; updatedAt: string }[]>([]);
  let thumbnails = $state<Record<string, string | null>>({});
  let showWelcome = $state(false);
  let confirmDeleteId = $state<string | null>(null);
  let renamingId = $state<string | null>(null);
  let renameValue = $state('');
  let contextMenuId = $state<string | null>(null);
  let showTemplateModal = $state(false);

  onMount(async () => {
    projects = await localStore.list();
    // Sort by most recent
    projects.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    // Load thumbnails
    const thumbs: Record<string, string | null> = {};
    for (const p of projects) {
      thumbs[p.id] = localStore.getThumbnail(p.id);
    }
    thumbnails = thumbs;
    const seen = localStorage.getItem('hasSeenWelcome');
    if (!seen && projects.length === 0) {
      showWelcome = true;
    }
  });

  async function createFromTemplate(index: number) {
    const template = houseTemplates[index];
    const p = template.create();
    currentProject.set(p);
    await localStore.save(p);
    showTemplateModal = false;
    goto(`/editor?id=${p.id}`);
  }

  async function newProject() {
    const p = createDefaultProject('Untitled Project');
    currentProject.set(p);
    await localStore.save(p);
    goto(`/editor?id=${p.id}`);
  }

  async function deleteProject(id: string) {
    await localStore.delete(id);
    confirmDeleteId = null;
    projects = (await localStore.list()).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  async function duplicateProject(id: string) {
    const dup = await localStore.duplicate(id);
    if (dup) {
      projects = (await localStore.list()).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      thumbnails = { ...thumbnails, [dup.id]: localStore.getThumbnail(dup.id) };
    }
    contextMenuId = null;
  }

  async function startRename(id: string, currentName: string) {
    renamingId = id;
    renameValue = currentName;
    contextMenuId = null;
    await new Promise(r => setTimeout(r, 50));
    const input = document.getElementById('rename-input') as HTMLInputElement;
    input?.focus();
    input?.select();
  }

  async function commitRename(id: string) {
    if (renameValue.trim()) {
      const p = await localStore.load(id);
      if (p) {
        p.name = renameValue.trim();
        p.updatedAt = new Date();
        await localStore.save(p);
        projects = (await localStore.list()).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      }
    }
    renamingId = null;
  }

  function formatDate(d: string) {
    const date = new Date(d);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDay = Math.floor(diffHr / 24);
    if (diffDay < 7) return `${diffDay}d ago`;
    return date.toLocaleDateString();
  }
</script>

<svelte:window onclick={() => { contextMenuId = null; }} />

{#if showWelcome}
  <WelcomeScreen onDismiss={() => { showWelcome = false; localStore.list().then(p => { projects = p.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()); }); }} />
{/if}

<div class="min-h-screen bg-gray-50">
  <!-- Header -->
  <div class="bg-gradient-to-r from-slate-800 to-slate-700 shadow-sm">
    <div class="max-w-5xl mx-auto px-6 py-5 flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-white">Floor Plan Editor</h1>
        <p class="text-sm text-white/50 mt-0.5">{projects.length} project{projects.length !== 1 ? 's' : ''}</p>
      </div>
      <div class="flex items-center gap-3">
        <button
          onclick={() => showTemplateModal = true}
          class="px-4 py-2.5 bg-white/10 text-white rounded-lg hover:bg-white/20 font-medium text-sm transition-all flex items-center gap-2 border border-white/20"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
          Templates
        </button>
        <button
          onclick={newProject}
          class="px-5 py-2.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 font-semibold text-sm shadow-lg shadow-blue-500/25 transition-all hover:shadow-blue-500/40 flex items-center gap-2"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          New Project
        </button>
      </div>
    </div>
  </div>

  <div class="max-w-5xl mx-auto px-6 py-8">
    {#if projects.length === 0}
      <div class="text-center py-24">
        <div class="w-16 h-16 bg-gray-200 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="text-gray-400"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>
        </div>
        <p class="text-lg text-gray-400 font-medium">No projects yet</p>
        <p class="text-sm text-gray-300 mt-1">Create your first floor plan to get started</p>
        <div class="mt-6 flex items-center gap-3 justify-center">
          <button onclick={newProject} class="px-5 py-2.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 font-semibold text-sm">
            Create Project
          </button>
          <button onclick={() => showTemplateModal = true} class="px-5 py-2.5 bg-white text-gray-700 rounded-lg hover:bg-gray-100 font-semibold text-sm border border-gray-200">
            Start from Template
          </button>
        </div>
      </div>
    {:else}
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {#each projects as project}
          <div class="group bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-lg hover:border-gray-300 transition-all duration-200 relative">
            <!-- Thumbnail -->
            <a href="/editor?id={project.id}" class="block">
              <div class="aspect-[4/3] bg-gray-100 relative overflow-hidden">
                {#if thumbnails[project.id]}
                  <img src={thumbnails[project.id]} alt="" class="w-full h-full object-contain" />
                {:else}
                  <div class="w-full h-full flex items-center justify-center">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" class="text-gray-300"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>
                  </div>
                {/if}
              </div>
            </a>

            <!-- Info -->
            <div class="p-4">
              {#if renamingId === project.id}
                <input
                  id="rename-input"
                  type="text"
                  bind:value={renameValue}
                  onblur={() => commitRename(project.id)}
                  onkeydown={(e) => { if (e.key === 'Enter') commitRename(project.id); if (e.key === 'Escape') renamingId = null; }}
                  class="font-semibold text-gray-800 text-sm bg-blue-50 border border-blue-300 rounded px-2 py-1 w-full outline-none"
                />
              {:else}
                <a href="/editor?id={project.id}" class="block">
                  <h3 class="font-semibold text-gray-800 text-sm truncate">{project.name || 'Untitled Project'}</h3>
                </a>
              {/if}
              <p class="text-xs text-gray-400 mt-1">{formatDate(project.updatedAt)}</p>
            </div>

            <!-- Actions menu button -->
            <button
              onclick={(e) => { e.stopPropagation(); contextMenuId = contextMenuId === project.id ? null : project.id; }}
              class="absolute top-3 right-3 w-8 h-8 bg-white/90 backdrop-blur rounded-lg shadow-sm border border-gray-200 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-gray-50"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" class="text-gray-500"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>
            </button>

            <!-- Context menu -->
            {#if contextMenuId === project.id}
              <div
                class="absolute top-12 right-3 bg-white rounded-lg shadow-xl border border-gray-200 py-1 w-40 z-50"
                onclick={(e) => e.stopPropagation()}
              >
                <button onclick={() => { goto(`/editor?id=${project.id}`); }} class="w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left flex items-center gap-2">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
                  Open
                </button>
                <button onclick={() => startRename(project.id, project.name)} class="w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left flex items-center gap-2">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>
                  Rename
                </button>
                <button onclick={() => duplicateProject(project.id)} class="w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left flex items-center gap-2">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                  Duplicate
                </button>
                <div class="h-px bg-gray-100 my-1"></div>
                {#if confirmDeleteId === project.id}
                  <div class="px-3 py-2 flex items-center gap-2">
                    <span class="text-xs text-gray-500">Delete?</span>
                    <button onclick={() => deleteProject(project.id)} class="px-2 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600">Yes</button>
                    <button onclick={() => confirmDeleteId = null} class="px-2 py-1 bg-gray-200 text-gray-600 text-xs rounded hover:bg-gray-300">No</button>
                  </div>
                {:else}
                  <button onclick={() => { confirmDeleteId = project.id; }} class="w-full px-3 py-2 text-sm text-red-500 hover:bg-red-50 text-left flex items-center gap-2">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                    Delete
                  </button>
                {/if}
              </div>
            {/if}
          </div>
        {/each}
      </div>
    {/if}
  </div>

  <!-- Template Modal -->
  {#if showTemplateModal}
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onclick={() => showTemplateModal = false}>
      <div class="bg-white rounded-2xl shadow-2xl p-8 max-w-xl w-full mx-4" onclick={(e) => e.stopPropagation()}>
        <div class="flex items-center justify-between mb-2">
          <h2 class="text-2xl font-bold text-gray-800">Floor Plan Templates</h2>
          <button onclick={() => showTemplateModal = false} class="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>
        <p class="text-sm text-gray-400 mb-6">Complete house layouts with walls, doors & windows</p>
        <div class="space-y-3">
          {#each houseTemplates as t, i}
            <button
              onclick={() => createFromTemplate(i)}
              class="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition-all text-left"
            >
              <span class="text-3xl">{t.icon}</span>
              <div class="flex-1 min-w-0">
                <div class="font-semibold text-gray-800">{t.name}</div>
                <div class="text-xs text-gray-400">{t.description}</div>
              </div>
              <span class="text-xs font-medium text-blue-500 bg-blue-50 px-2 py-1 rounded-lg shrink-0">{t.area}</span>
            </button>
          {/each}
        </div>
      </div>
    </div>
  {/if}
</div>
