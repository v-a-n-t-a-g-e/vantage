<script>
  import InspectorItem from '@/lib/ui/InspectorItem.svelte'
  import { sceneState } from '@/lib/sceneState.svelte.js'
</script>

<aside class="col-start-3 row-start-1 pointer-events-auto min-w-40">
  <div class="px-2 py-1 text-xs font-bold uppercase tracking-wider opacity-60">Scene</div>
  {#each sceneState.objects as item (item.name)}
    <InspectorItem
      {item}
      ontoggle={(i) => {
        i.object.visible = !i.object.visible
        i.visible = i.object.visible
      }}
    />
  {/each}
</aside>
