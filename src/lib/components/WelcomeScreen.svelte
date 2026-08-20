<script lang="ts">
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  import { localStore } from '$lib/services/datastore';
  import { createDefaultProject, currentProject } from '$lib/stores/project';
  import { houseTemplates } from '$lib/utils/houseTemplates';
  import { locale, t } from '$lib/i18n';

  let { onDismiss }: { onDismiss: () => void } = $props();

  let showTour = $state(false);
  let tourStep = $state(0);

  function buildTourSteps() {
    void $locale; // re-run when the locale changes
    return [
      { title: t('welcome.tourLeftSidebarTitle'), desc: t('welcome.tourLeftSidebarDesc'), icon: '📦' },
      { title: t('welcome.tourCanvasTitle'), desc: t('welcome.tourCanvasDesc'), icon: '✏️' },
      { title: t('welcome.tourTopBarTitle'), desc: t('welcome.tourTopBarDesc'), icon: '🔄' },
      { title: t('welcome.tourStatusBarTitle'), desc: t('welcome.tourStatusBarDesc'), icon: '⚙️' },
    ];
  }
  const tourSteps = $derived(buildTourSteps());

  function markSeen() {
    localStorage.setItem('hasSeenWelcome', 'true');
    onDismiss();
  }

  async function startFromScratch() {
    const p = createDefaultProject(t('common.untitledProject'));
    currentProject.set(p);
    await localStore.save(p);
    markSeen();
    goto(`${base}/editor?id=${p.id}`);
  }

  async function useHouseTemplate(index: number) {
    const template = houseTemplates[index];
    const p = template.create();
    currentProject.set(p);
    await localStore.save(p);
    markSeen();
    goto(`${base}/editor?id=${p.id}`);
  }

  let showTemplates = $state(false);
  let showImport = $state(false);

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
        goto(`${base}/editor?id=${data.id}`);
      } else {
        alert(t('welcome.unrecognizedFormat'));
      }
    } catch {
      alert(t('welcome.failedToParse'));
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
  {#key $locale}
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
          {tourStep < tourSteps.length - 1 ? t('welcome.next') : t('welcome.getStarted')}
        </button>
      </div>
    </div>
  {:else if showTemplates}
    <!-- Template grid -->
    <div class="bg-white rounded-2xl shadow-2xl p-8 max-w-xl w-full mx-4">
      <button onclick={() => showTemplates = false} class="text-gray-400 hover:text-gray-600 mb-4 text-sm">{t('welcome.back')}</button>
      <h2 class="text-2xl font-bold text-gray-800 mb-2 text-center">{t('welcome.templatesTitle')}</h2>
      <p class="text-sm text-gray-400 text-center mb-6">{t('welcome.templatesSubtitle')}</p>
      <div class="space-y-3">
        {#each houseTemplates as tpl, i}
          <button
            onclick={() => useHouseTemplate(i)}
            class="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition-all text-left"
          >
            <span class="text-3xl">{tpl.icon}</span>
            <div class="flex-1 min-w-0">
              <div class="font-semibold text-gray-800">{t(`houseTemplateName:${tpl.name}`)}</div>
              <div class="text-xs text-gray-400">{t(`houseTemplateDesc:${tpl.name}`)}</div>
            </div>
            <span class="text-xs font-medium text-blue-500 bg-blue-50 px-2 py-1 rounded-lg shrink-0">{tpl.area}</span>
          </button>
        {/each}
      </div>
    </div>
  {:else}
    <!-- Main welcome card -->
    <div class="bg-white rounded-2xl shadow-2xl p-10 max-w-md w-full mx-4 text-center">
      <div class="text-5xl mb-4">🏠</div>
      <h1 class="text-3xl font-bold text-gray-800 mb-2">{t('welcome.title')}</h1>
      <p class="text-gray-500 mb-8">{t('welcome.subtitle')}</p>

      <div class="space-y-3">
        <button
          onclick={startFromScratch}
          class="w-full flex items-center gap-3 px-5 py-3.5 rounded-xl border-2 border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition-all text-left"
        >
          <span class="text-2xl">✨</span>
          <div>
            <div class="font-semibold text-gray-800">{t('welcome.startFromScratch')}</div>
            <div class="text-xs text-gray-400">{t('welcome.startFromScratchDesc')}</div>
          </div>
        </button>

        <button
          onclick={() => showTemplates = true}
          class="w-full flex items-center gap-3 px-5 py-3.5 rounded-xl border-2 border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition-all text-left"
        >
          <span class="text-2xl">📐</span>
          <div>
            <div class="font-semibold text-gray-800">{t('welcome.useTemplate')}</div>
            <div class="text-xs text-gray-400">{t('welcome.useTemplateDesc')}</div>
          </div>
        </button>

        <button
          onclick={handleImport}
          class="w-full flex items-center gap-3 px-5 py-3.5 rounded-xl border-2 border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition-all text-left"
        >
          <span class="text-2xl">📂</span>
          <div>
            <div class="font-semibold text-gray-800">{t('welcome.importPlan')}</div>
            <div class="text-xs text-gray-400">{t('welcome.importPlanDesc')}</div>
          </div>
        </button>

        <button
          onclick={startTour}
          class="w-full flex items-center gap-3 px-5 py-3.5 rounded-xl border-2 border-gray-200 hover:border-purple-400 hover:bg-purple-50 transition-all text-left"
        >
          <span class="text-2xl">🎓</span>
          <div>
            <div class="font-semibold text-gray-800">{t('welcome.quickTour')}</div>
            <div class="text-xs text-gray-400">{t('welcome.quickTourDesc')}</div>
          </div>
        </button>
      </div>
    </div>
  {/if}
  {/key}
</div>
