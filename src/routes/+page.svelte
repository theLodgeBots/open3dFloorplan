<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { localStore } from '$lib/services/datastore';
  import { createDefaultProject, currentProject } from '$lib/stores/project';
  import WelcomeScreen from '$lib/components/WelcomeScreen.svelte';

  let projects = $state<{ id: string; name: string; updatedAt: string }[]>([]);
  let showWelcome = $state(false);

  onMount(async () => {
    projects = await localStore.list();
    const seen = localStorage.getItem('hasSeenWelcome');
    if (!seen && projects.length === 0) {
      showWelcome = true;
    }
  });

  async function newProject() {
    const name = prompt('Project name:', 'Untitled Project');
    if (!name) return;
    const p = createDefaultProject(name);
    currentProject.set(p);
    await localStore.save(p);
    goto(`/editor?id=${p.id}`);
  }

  let confirmDeleteId = $state<string | null>(null);
  let confirmDeleteAll = $state(false);

  async function deleteAllProjects() {
    for (const p of projects) await localStore.delete(p.id);
    confirmDeleteAll = false;
    projects = await localStore.list();
  }

  async function deleteProject(id: string) {
    await localStore.delete(id);
    confirmDeleteId = null;
    projects = await localStore.list();
  }
</script>

{#if showWelcome}
  <WelcomeScreen onDismiss={() => { showWelcome = false; localStore.list().then(p => projects = p); }} />
{/if}

<div class="min-h-screen bg-gray-50 p-8">
  <div class="max-w-2xl mx-auto">
    <div class="flex items-center justify-between mb-8">
      <h1 class="text-3xl font-bold text-gray-800">Floor Plan Editor</h1>
      <button
        onclick={newProject}
        class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
      >+ New Project</button>
    </div>

    {#if projects.length > 1}
      <div class="flex justify-end mb-4">
        {#if confirmDeleteAll}
          <div class="flex items-center gap-2">
            <span class="text-sm text-gray-500">Delete all {projects.length} projects?</span>
            <button onclick={deleteAllProjects} class="px-3 py-1 bg-red-500 text-white text-sm rounded hover:bg-red-600">Yes, delete all</button>
            <button onclick={() => confirmDeleteAll = false} class="px-3 py-1 bg-gray-200 text-gray-600 text-sm rounded hover:bg-gray-300">Cancel</button>
          </div>
        {:else}
          <button onclick={() => confirmDeleteAll = true} class="text-red-400 hover:text-red-600 text-sm">Delete All Projects</button>
        {/if}
      </div>
    {/if}

    {#if projects.length === 0}
      <div class="text-center py-16 text-gray-400">
        <p class="text-lg">No projects yet</p>
        <p class="text-sm mt-1">Create a new project to get started</p>
      </div>
    {:else}
      <div class="space-y-3">
        {#each projects as project}
          <div class="bg-white rounded-lg border border-gray-200 p-4 flex items-center justify-between hover:shadow-sm transition-shadow">
            <a href="/editor?id={project.id}" class="flex-1">
              <h3 class="font-medium text-gray-800">{project.name || 'Untitled Project'}</h3>
              <p class="text-xs text-gray-400 mt-1">Last edited: {new Date(project.updatedAt).toLocaleDateString()}</p>
            </a>
            <button
              onclick={async (e) => { e.preventDefault(); const name = prompt('Rename project:', project.name); if (name) { const p = await localStore.load(project.id); if (p) { p.name = name; p.updatedAt = new Date(); await localStore.save(p); projects = await localStore.list(); } } }}
              class="text-gray-400 hover:text-gray-600 text-sm ml-2"
              title="Rename"
            >✏️</button>
            {#if confirmDeleteId === project.id}
              <div class="flex items-center gap-2 ml-4">
                <span class="text-xs text-gray-500">Delete?</span>
                <button
                  onclick={() => deleteProject(project.id)}
                  class="px-2 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600"
                >Yes</button>
                <button
                  onclick={() => confirmDeleteId = null}
                  class="px-2 py-1 bg-gray-200 text-gray-600 text-xs rounded hover:bg-gray-300"
                >No</button>
              </div>
            {:else}
              <button
                onclick={() => confirmDeleteId = project.id}
                class="text-red-400 hover:text-red-600 text-sm ml-4"
              >Delete</button>
            {/if}
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>
