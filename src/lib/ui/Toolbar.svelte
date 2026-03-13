<script lang="ts">
  import { sceneState } from '@/lib/sceneState.svelte.ts'
  import type { TransformMode } from '@/lib/sceneState.svelte.ts'
  import type { Component } from 'svelte'

  import IconTranslate from '@/assets/icons/Translate.svg'
  import IconRotate from '@/assets/icons/Rotate.svg'
  import IconScale from '@/assets/icons/Scale.svg'

  type TransformModeItem = { mode: TransformMode; icon: Component }

  const modes: TransformModeItem[] = [
    { mode: 'translate', icon: IconTranslate },
    { mode: 'rotate', icon: IconRotate },
    { mode: 'scale', icon: IconScale },
  ]
</script>

<div class="ui-container col-start-3 row-start-1 flex justify-self-end">
  {#each modes as { mode, icon } (mode)}
    <label
      class="ui-button cursor-pointer"
      class:!bg-green={sceneState.transformMode === mode}
      aria-label={mode}
    >
      <input
        type="radio"
        name="transform-mode"
        value={mode}
        bind:group={sceneState.transformMode}
        class="sr-only"
      />
      <svelte:component this={icon} />
    </label>
  {/each}
</div>
