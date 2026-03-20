<script lang="ts">
  import { sceneState } from '@/lib/sceneState.svelte.ts'
</script>

<div class="ui-container pointer-events-auto flex h-10 shrink-0 items-center gap-3 px-3">
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
