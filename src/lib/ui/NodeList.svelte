<script lang="ts">
  import NodeListItem from '@/lib/ui/NodeListItem.svelte'
  import ProjectionListItem from '@/lib/ui/ProjectionListItem.svelte'
  import { sceneState, sceneActions } from '@/lib/sceneState.svelte.ts'
  import { loadGLTF } from '@/lib/gltfLoader.ts'
  import { VantageProjection, loadTexture } from 'vantage-renderer'

  let fileInput: HTMLInputElement
  let imageInput: HTMLInputElement

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

  async function handleImages(files: FileList | null | undefined) {
    if (!files) return
    for (const file of files) {
      if (!/\.(jpe?g|png|webp)$/i.test(file.name)) continue
      const url = URL.createObjectURL(file)
      try {
        const texture = await loadTexture(url)
        const projection = new VantageProjection({ texture })
        const name = file.name.replace(/\.(jpe?g|png|webp)$/i, '')
        const imagePath = `projections/${file.name}`
        sceneActions.value?.addProjection(name, projection, file, imagePath)
      } finally {
        URL.revokeObjectURL(url)
      }
    }
    if (imageInput) imageInput.value = ''
  }
</script>

<aside
  class="ui-container col-start-1 row-span-2 flex-1 min-h-0 overflow-auto pointer-events-auto flex flex-col"
  onclick={(e) => {
    if (e.target === e.currentTarget) {
      sceneState.selected = null
      sceneState.selectedProjection = null
    }
  }}
>
  <!-- Assets section -->
  <div class="px-3 flex items-center justify-between h-10 border-b">
    <span class="tracking-wider">Assets</span>
    <button
      class="ui-button px-2 h-7 text-sm"
      onclick={() => fileInput.click()}
      title="Import GLTF/GLB">Import</button
    >
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

  <!-- Projections section -->
  <div class="px-3 flex items-center justify-between h-10 border-b border-t mt-auto">
    <span class="tracking-wider">Projections</span>
    <button
      class="ui-button px-2 h-7 text-sm"
      onclick={() => imageInput.click()}
      title="Import image">Import</button
    >
  </div>
  <input
    type="file"
    accept=".jpg,.jpeg,.png,.webp"
    multiple
    bind:this={imageInput}
    onchange={(e) => handleImages((e.target as HTMLInputElement).files)}
    class="hidden"
  />
  {#each sceneState.projections as item (item.id)}
    <ProjectionListItem
      {item}
      ontoggle={(i) => {
        i.visible = !i.visible
        for (const obj of sceneState.objects) {
          if (i.visible) {
            i.projection.project(obj.object)
          } else {
            i.projection.unproject(obj.object)
          }
        }
      }}
    />
  {/each}
</aside>
