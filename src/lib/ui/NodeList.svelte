<script lang="ts">
  import NodeListItem from '@/lib/ui/NodeListItem.svelte'
  import { sceneState } from '@/lib/sceneState.svelte.ts'
</script>

<aside class="ui-container col-start-1 row-span-2 flex-1 min-h-0 overflow-auto pointer-events-auto">
  <div class="px-3 flex items-center tracking-wider h-10 border-b">Assets</div>
  {#each sceneState.objects as item (item.name)}
    <NodeListItem
      {item}
      ontoggle={(i) => {
        i.object.visible = !i.object.visible
        i.visible = i.object.visible
      }}
    />
  {/each}
</aside>
