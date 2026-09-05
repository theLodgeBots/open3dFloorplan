<script lang="ts">
  import { getModelFile } from '$lib/utils/furnitureModelFiles';

  let { catalogId, name, color }: { catalogId: string; name: string; color: string } = $props();
  let element: HTMLDivElement;
  let src = $state<string | null>(null);

  $effect(() => {
    const file = getModelFile(catalogId);
    if (!element) return;
    src = null;
    let disposed = false;
    let started = false;
    const load = async () => {
      if (started) return;
      started = true;
      if (!file) return;
      try {
        // Three.js and model bytes are needed only for visible catalog previews.
        const { generateThumbnail } = await import('$lib/utils/furnitureThumbnails');
        if (disposed) return;
        const result = await generateThumbnail(file);
        if (!disposed) src = result;
      } catch { /* Keep the usable color placeholder if a preview cannot load. */ }
    };
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        observer.disconnect();
        void load();
      }
    });
    observer.observe(element);
    return () => { disposed = true; observer.disconnect(); };
  });
</script>

<div bind:this={element} class="flex h-full w-full items-center justify-center">
  {#if src}
    <img {src} alt={name} class="max-h-full max-w-full object-contain" />
  {:else}
    <div class="w-8 h-8 rounded-lg flex items-center justify-center" style:background-color={`${color}20`}>
      <div class="w-4 h-4 rounded-sm opacity-70" style:background-color={color}></div>
    </div>
  {/if}
</div>
