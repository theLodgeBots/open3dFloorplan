<script lang="ts">
  import { getActiveTip, dismissTip, TIP_MESSAGES } from '$lib/stores/onboarding.svelte';

  // Reactive binding
  let tip = $derived(getActiveTip());
  let visible = $state(false);

  $effect(() => {
    if (tip) {
      // Small delay for enter animation
      visible = false;
      requestAnimationFrame(() => { visible = true; });
    } else {
      visible = false;
    }
  });
</script>

{#if tip}
  {@const msg = TIP_MESSAGES[tip.id]}
  {@const clampedX = Math.min(tip.x, (typeof window !== 'undefined' ? window.innerWidth : 1200) - 320)}
  {@const clampedY = Math.min(tip.y, (typeof window !== 'undefined' ? window.innerHeight : 800) - 100)}
  <div
    class="fixed z-[9999] pointer-events-auto"
    style="left:{clampedX}px;top:{clampedY}px;"
  >
    <div
      class="bg-slate-800 text-white rounded-xl shadow-2xl px-4 py-3 max-w-[280px] text-sm leading-relaxed transition-all duration-300 ease-out"
      class:opacity-0={!visible}
      class:translate-y-2={!visible}
      class:opacity-100={visible}
      class:translate-y-0={visible}
    >
      <p class="mb-2">{msg}</p>
      <button
        class="text-xs font-medium px-3 py-1 rounded-lg bg-blue-500 hover:bg-blue-400 transition-colors"
        onclick={dismissTip}
      >Got it</button>
    </div>
  </div>
{/if}
