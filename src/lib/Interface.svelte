<script lang="ts">
  import MenuBar from '@/lib/ui/MenuBar.svelte'
  import Toolbar from '@/lib/ui/Toolbar.svelte'
  import NodeList from '@/lib/ui/NodeList.svelte'
  import Inspector from '@/lib/ui/Inspector.svelte'
  import ConfigBar from '@/lib/ui/ConfigBar.svelte'
  import { sceneState } from '@/lib/sceneState.svelte.ts'
</script>

<div
  class="pointer-events-none absolute inset-4 grid grid-cols-[250px_1fr_1fr_300px] grid-rows-[auto_1fr] gap-4"
>
  <NodeList />
  <MenuBar />

  {#if sceneState.selected}
    <Toolbar />
    <Inspector />
  {/if}
</div>

<ConfigBar />
