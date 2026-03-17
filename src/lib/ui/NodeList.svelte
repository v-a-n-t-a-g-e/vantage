<script lang="ts">
  import NodeListItem from '@/lib/ui/NodeListItem.svelte'
  import { sceneState, sceneActions } from '@/lib/sceneState.svelte.ts'
  import { loadGLTF } from '@/lib/gltfLoader.ts'
  import { VantageProjection, loadTexture } from 'vantage-renderer'
  import Add from '@/assets/icons/Add.svg'

  let assetInput: HTMLInputElement
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
    if (assetInput) assetInput.value = ''
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

<aside class="col-start-1 row-span-2 flex min-h-0 flex-1 flex-col gap-4 overflow-auto">
  <!-- Projections -->
  <section class="ui-container">
    <div class="mt-auto flex h-10 items-center justify-between border-b px-3">
      <span>Projections</span>
      <button
        class="-mr-3 ui-button h-full px-3"
        onclick={() => imageInput.click()}
        title="Import image"
      >
        <Add />
      </button>
    </div>
    <input
      bind:this={imageInput}
      class="hidden"
      accept=".jpg,.jpeg,.png,.webp"
      multiple
      onchange={(e) => handleImages((e.target as HTMLInputElement).files)}
      type="file"
    />
    {#each sceneState.projections as item (item.id)}
      <NodeListItem
        {item}
        ontoggle={(i) => {
          if (i.kind === 'projection') {
            i.visible = !i.visible
            for (const obj of sceneState.objects) {
              if (i.visible) {
                i.projection.project(obj.object)
              } else {
                i.projection.unproject(obj.object)
              }
            }
          }
        }}
      />
    {:else}
      <div
        class="h-10 px-3 flex justify-center items-center text-gray-400"
        onclick={() => imageInput.click()}
        role="presentation"
      >
        import an image
      </div>
    {/each}
  </section>

  <!-- Assets -->
  <section
    class="ui-container"
    onclick={(e) => {
      if (e.target === e.currentTarget) {
        sceneState.selected = null
      }
    }}
    role="presentation"
  >
    <div class="flex h-10 items-center justify-between border-b px-3">
      <span>Assets</span>
      <button
        class="-mr-3 ui-button h-full px-3"
        onclick={() => assetInput.click()}
        title="Import GLTF/GLB"
      >
        <Add />
      </button>
    </div>
    <input
      bind:this={assetInput}
      class="hidden"
      accept=".gltf,.glb"
      multiple
      onchange={(e) => handleFiles((e.target as HTMLInputElement).files)}
      type="file"
    />
    {#each sceneState.objects as item (item.id)}
      <NodeListItem
        {item}
        ontoggle={(i) => {
          if (i.kind === 'object') {
            i.object.visible = !i.object.visible
            i.visible = i.object.visible
          }
        }}
      />
    {:else}
      <div
        class="h-10 px-3 flex justify-center items-center text-gray-400"
        onclick={() => assetInput.click()}
        role="presentation"
      >
        import a 3D model
      </div>
    {/each}
  </section>
</aside>
