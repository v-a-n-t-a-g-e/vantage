<script lang="ts">
  import NodeListItem from '@/lib/ui/NodeListItem.svelte'
  import { sceneState, sceneActions } from '@/lib/sceneState.svelte.ts'
  import { loadGLTF } from '@/lib/gltfLoader.ts'

  let fileInput: HTMLInputElement

  async function handleFiles(files: FileList | null | undefined) {
    if (!files) return
    for (const file of files) {
      if (!/\.(gltf|glb)$/i.test(file.name)) continue
      const { group, blob } = await loadGLTF(file)
      const name = file.name.replace(/\.(gltf|glb)$/i, '')
      sceneActions.value?.addObject(name, group, {
        kind: 'imported',
        relativePath: `geometry/${file.name}`,
        originalBlob: blob,
      })
    }
    if (fileInput) fileInput.value = ''
  }
</script>

<aside
  class="ui-container col-start-1 row-span-2 flex-1 min-h-0 overflow-auto pointer-events-auto"
  onclick={(e) => { if (e.target === e.currentTarget) sceneState.selected = null }}
>
  <div class="px-3 flex items-center justify-between h-10 border-b">
    <span class="tracking-wider">Assets</span>
    <button
      class="ui-button px-2 h-7 text-sm"
      onclick={() => fileInput.click()}
      title="Import GLTF/GLB"
    >Import</button>
  </div>
  <input
    type="file"
    accept=".gltf,.glb"
    multiple
    bind:this={fileInput}
    onchange={(e) => handleFiles((e.target as HTMLInputElement).files)}
    class="hidden"
  />
  {#each sceneState.objects as item (item.id)}
    <NodeListItem
      {item}
      ontoggle={(i) => {
        i.object.visible = !i.object.visible
        i.visible = i.object.visible
      }}
    />
  {/each}
</aside>
