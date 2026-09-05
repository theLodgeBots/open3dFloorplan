<script lang="ts">
  import { page } from '$app/state';
  import { base } from '$app/paths';
  import { prepareToLeave } from '$lib/services/deployment';
  import { currentProject } from '$lib/stores/project';
  import { downloadProjectJSON as exportAsJSON } from '$lib/utils/projectBackup';
  let saveFailed = $state(false);
  async function retry() {
    if (await prepareToLeave()) window.location.reload();
    else saveFailed = true;
  }
</script>

<main class="mx-auto max-w-xl p-8 text-slate-700">
  <h1 class="text-2xl font-semibold">{page.status === 404 ? 'Page not found' : 'This page could not load'}</h1>
  <p class="mt-3">Check your connection and try again. A recent app update may require a reload.</p>
  {#if saveFailed}<p role="alert" class="mt-3 text-red-700">Your changes could not be saved. Download a backup before reloading.</p>{/if}
  <div class="mt-5 flex gap-4">
    <button class="rounded bg-blue-600 px-4 py-2 text-white" onclick={retry}>Try again</button>
    {#if $currentProject}<button onclick={() => { if ($currentProject) exportAsJSON($currentProject); }}>Download JSON backup</button>{/if}
    <a class="p-2 underline" href={`${base}/`}>Project library</a>
  </div>
</main>
