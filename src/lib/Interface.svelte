<script>
  import MenuBar from '@/lib/ui/MenuBar.svelte'
  import Inspector from '@/lib/ui/Inspector.svelte'
  import TransformPanel from '@/lib/ui/TransformPanel.svelte'
  import { sceneState } from '@/lib/sceneState.svelte.js'
</script>

<div
  class="absolute inset-0 grid pointer-events-none grid-cols-[auto_1fr_auto] grid-rows-[auto_auto_1fr]"
>
  <MenuBar />
  <Inspector />
  {#if sceneState.selected}
    <TransformPanel />
  {/if}
</div>
