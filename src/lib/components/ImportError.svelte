<script lang="ts">
  let { message, onDismiss }: { message: string; onDismiss: () => void } = $props();
</script>

<div role="alert" class="fixed top-16 left-1/2 -translate-x-1/2 z-[60] w-[min(28rem,calc(100vw-2rem))] rounded-xl border border-red-200 bg-white p-4 shadow-xl">
  <div class="flex items-start justify-between gap-3">
    <div>
      <p class="font-semibold text-red-800">Couldn't import plan</p>
      <p class="mt-1 text-sm text-gray-700">{message}</p>
      <p class="mt-2 text-xs text-gray-500">Choose another file or retry the export from the source app.</p>
    </div>
    <button aria-label="Dismiss import error" class="rounded px-2 py-1 text-gray-600 hover:bg-gray-100" onclick={onDismiss}>✕</button>
  </div>
</div>
