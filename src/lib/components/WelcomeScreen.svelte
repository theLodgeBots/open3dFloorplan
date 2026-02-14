<script lang="ts">
  import { goto } from '$app/navigation';
  import { localStore } from '$lib/services/datastore';
  import { createDefaultProject, currentProject } from '$lib/stores/project';

  let { onDismiss }: { onDismiss: () => void } = $props();

  let showTour = $state(false);
  let tourStep = $state(0);

  const tourSteps = [
    { title: 'Left Sidebar', desc: 'Browse furniture and room presets', icon: '📦' },
    { title: 'Canvas', desc: "Draw walls with 'W' key, drag to place items", icon: '✏️' },
    { title: 'Top Bar', desc: 'Switch between 2D and 3D views', icon: '🔄' },
    { title: 'Status Bar', desc: 'Toggle grid, snap, and other options', icon: '⚙️' },
  ];

  function markSeen() {
    localStorage.setItem('hasSeenWelcome', 'true');
    onDismiss();
  }

  async function startFromScratch() {
    const p = createDefaultProject('Untitled Project');
    currentProject.set(p);
    await localStore.save(p);
    markSeen();
    goto(`/editor?id=${p.id}`);
  }

  async function useTemplate(name: string) {
    const p = createDefaultProject(name);
    currentProject.set(p);
    await localStore.save(p);
    markSeen();
    goto(`/editor?id=${p.id}`);
  }

  let showTemplates = $state(false);
  let showImport = $state(false);

  const templates = [
    { name: 'Living Room', icon: '🛋️' },
    { name: 'Kitchen', icon: '🍳' },
    { name: 'Bedroom', icon: '🛏️' },
    { name: 'Bathroom', icon: '🚿' },
    { name: 'Office', icon: '💼' },
    { name: 'Studio', icon: '🎨' },
  ];

  let fileInput: HTMLInputElement;

  async function handleImport() {
    fileInput.click();
  }

  async function onFileSelected(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      // If it looks like a project, load it
      if (data.id && data.floors) {
        data.updatedAt = new Date();
        currentProject.set(data);
        await localStore.save(data);
        markSeen();
        goto(`/editor?id=${data.id}`);
      } else {
        alert('Unrecognized file format');
      }
    } catch {
      alert('Failed to parse file');
    }
  }

  function startTour() {
    showTour = true;
    tourStep = 0;
  }

  function nextTourStep() {
    if (tourStep < tourSteps.length - 1) {
      tourStep++;
    } else {
      showTour = false;
      markSeen();
    }
  }
</script>

<input type="file" accept=".json" class="hidden" bind:this={fileInput} onchange={onFileSelected} />

<!-- Backdrop -->
<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
  {#if showTour}
    <!-- Tour overlay -->
    <div class="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4 text-center">
      <div class="text-5xl mb-4">{tourSteps[tourStep].icon}</div>
      <h2 class="text-xl font-bold text-gray-800 mb-2">{tourSteps[tourStep].title}</h2>
      <p class="text-gray-500 mb-6">{tourSteps[tourStep].desc}</p>
      <div class="flex items-center justify-between">
        <div class="flex gap-1.5">
          {#each tourSteps as _, i}
            <div class="w-2 h-2 rounded-full {i === tourStep ? 'bg-blue-500' : 'bg-gray-300'}"></div>
          {/each}
        </div>
        <button
          onclick={nextTourStep}
          class="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
        >
          {tourStep < tourSteps.length - 1 ? 'Next' : 'Get Started'}
        </button>
      </div>
    </div>
  {:else if showTemplates}
    <!-- Template grid -->
    <div class="bg-white rounded-2xl shadow-2xl p-8 max-w-lg w-full mx-4">
      <button onclick={() => showTemplates = false} class="text-gray-400 hover:text-gray-600 mb-4 text-sm">← Back</button>
      <h2 class="text-2xl font-bold text-gray-800 mb-6 text-center">Choose a Template</h2>
      <div class="grid grid-cols-3 gap-3">
        {#each templates as t}
          <button
            onclick={() => useTemplate(t.name)}
            class="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition-all"
          >
            <span class="text-3xl">{t.icon}</span>
            <span class="text-sm font-medium text-gray-700">{t.name}</span>
          </button>
        {/each}
      </div>
    </div>
  {:else}
    <!-- Main welcome card -->
    <div class="bg-white rounded-2xl shadow-2xl p-10 max-w-md w-full mx-4 text-center">
      <div class="text-5xl mb-4">🏠</div>
      <h1 class="text-3xl font-bold text-gray-800 mb-2">Welcome</h1>
      <p class="text-gray-500 mb-8">Design your dream space in 2D and 3D</p>

      <div class="space-y-3">
        <button
          onclick={startFromScratch}
          class="w-full flex items-center gap-3 px-5 py-3.5 rounded-xl border-2 border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition-all text-left"
        >
          <span class="text-2xl">✨</span>
          <div>
            <div class="font-semibold text-gray-800">Start from Scratch</div>
            <div class="text-xs text-gray-400">Open an empty editor</div>
          </div>
        </button>

        <button
          onclick={() => showTemplates = true}
          class="w-full flex items-center gap-3 px-5 py-3.5 rounded-xl border-2 border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition-all text-left"
        >
          <span class="text-2xl">📐</span>
          <div>
            <div class="font-semibold text-gray-800">Use a Template</div>
            <div class="text-xs text-gray-400">Start with a room preset</div>
          </div>
        </button>

        <button
          onclick={handleImport}
          class="w-full flex items-center gap-3 px-5 py-3.5 rounded-xl border-2 border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition-all text-left"
        >
          <span class="text-2xl">📂</span>
          <div>
            <div class="font-semibold text-gray-800">Import a Plan</div>
            <div class="text-xs text-gray-400">Load a JSON or RoomPlan file</div>
          </div>
        </button>

        <button
          onclick={startTour}
          class="w-full flex items-center gap-3 px-5 py-3.5 rounded-xl border-2 border-gray-200 hover:border-purple-400 hover:bg-purple-50 transition-all text-left"
        >
          <span class="text-2xl">🎓</span>
          <div>
            <div class="font-semibold text-gray-800">Quick Tour</div>
            <div class="text-xs text-gray-400">Learn the basics in 30 seconds</div>
          </div>
        </button>
      </div>
    </div>
  {/if}
</div>
