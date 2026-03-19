<script lang="ts">
  import { sceneState } from '@/lib/sceneState.svelte.ts'
</script>

<div class="ui-container pointer-events-auto absolute bottom-4 left-4 flex items-center gap-3 px-3 py-1.5">
  <label class="flex items-center gap-1.5 text-xs">
    <input type="checkbox" bind:checked={sceneState.showGrid} />
    Grid
  </label>

  <label class="flex items-center gap-1.5 text-xs">
    BG
    <input
      type="color"
      class="h-5 w-5 cursor-pointer border border-black p-0"
      bind:value={sceneState.clearColor}
    />
  </label>
</div>
