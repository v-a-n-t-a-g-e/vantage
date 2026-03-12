<script>
  import MenuBar from '@/lib/ui/MenuBar.svelte'
  import Toolbar from '@/lib/ui/Toolbar.svelte'
  import Assets from '@/lib/ui/Assets.svelte'
  import TransformPanel from '@/lib/ui/TransformPanel.svelte'
  import { sceneState } from '@/lib/sceneState.svelte.js'
</script>

<div
  class="absolute inset-4 grid pointer-events-none grid-cols-[250px_1fr_1fr_250px] grid-rows-[auto_1fr] gap-4"
>
  <Assets />
  <MenuBar />
  <Toolbar />
  {#if sceneState.selected}
    <TransformPanel />
  {/if}
</div>
