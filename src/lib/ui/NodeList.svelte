<script lang="ts">
  import NodeListItem from '@/lib/ui/NodeListItem.svelte'
  import { sceneState, sceneActions } from '@/lib/sceneState.svelte.ts'
  import type { SceneObject, ProjectionItem } from '@/lib/sceneState.svelte.ts'
  import { loadGLTF } from '@/lib/gltfLoader.ts'
  import { VantageProjection, loadTexture } from 'vantage-renderer'
  import Add from '@/assets/icons/Add.svg'

  let modelInput: HTMLInputElement
  let imageInput: HTMLInputElement

  let altPressed = $state(false)

  $effect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'Alt') altPressed = true
    }
    const up = (e: KeyboardEvent) => {
      if (e.key === 'Alt') altPressed = false
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  })

  // Drag-and-drop state
  let dragList: 'projections' | 'objects' | null = $state(null)
  let dragIndex: number | null = $state(null)
  let dropIndex: number | null = $state(null)
  let dropPosition: 'above' | 'below' | null = $state(null)

  function handleDragStart(list: 'projections' | 'objects', index: number, e: DragEvent) {
    dragList = list
    dragIndex = index
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move'
    }
  }

  function handleDragOver(list: 'projections' | 'objects', index: number, e: DragEvent) {
    if (dragList !== list || dragIndex === null) return
    e.preventDefault()
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const midY = rect.top + rect.height / 2
    const above = e.clientY < midY

    dropIndex = index
    dropPosition = above ? 'above' : 'below'
  }

  function handleDrop(list: 'projections' | 'objects', _index: number, e: DragEvent) {
    e.preventDefault()
    if (dragList !== list || dragIndex === null || dropIndex === null || dropPosition === null)
      return

    // Column-reverse: visual above = after in array, visual below = before in array
    const targetIndex = dropPosition === 'above' ? dropIndex + 1 : dropIndex
    reorder(list, dragIndex, targetIndex)
    resetDragState()
  }

  function handleDragEnd() {
    resetDragState()
  }

  function resetDragState() {
    dragList = null
    dragIndex = null
    dropIndex = null
    dropPosition = null
  }

  function reorder(list: 'projections' | 'objects', fromIndex: number, toIndex: number) {
    if (fromIndex === toIndex || fromIndex + 1 === toIndex) return

    const arr: (SceneObject | ProjectionItem)[] =
      list === 'projections' ? sceneState.projections : sceneState.objects
    const [item] = arr.splice(fromIndex, 1)
    const insertAt = toIndex > fromIndex ? toIndex - 1 : toIndex
    arr.splice(insertAt, 0, item)

    if (list === 'projections') reprojectAll()
  }

  function reprojectAll() {
    for (const p of sceneState.projections) {
      if (p.visible) {
        for (const obj of sceneState.objects) {
          p.projection.unproject(obj.object)
        }
      }
    }
    for (const p of sceneState.projections) {
      if (p.visible) {
        for (const obj of sceneState.objects) {
          p.projection.project(obj.object)
        }
      }
    }
  }

  function getDropPosition(list: 'projections' | 'objects', index: number) {
    if (dragList !== list || dropIndex !== index || dragIndex === null) return null
    // Column-reverse: above = after in array, below = before in array
    if (dropPosition === 'above' && (index === dragIndex || index === dragIndex - 1)) return null
    if (dropPosition === 'below' && (index === dragIndex || index === dragIndex + 1)) return null
    return dropPosition
  }

  async function handleFiles(files: FileList | null | undefined) {
    if (!files) return
    for (const file of files) {
      if (!/\.(gltf|glb)$/i.test(file.name)) continue
      const { group, blob } = await loadGLTF(file)
      const name = file.name.replace(/\.(gltf|glb)$/i, '')
      sceneActions.value?.addObject(name, group, {
        kind: 'imported',
        relativePath: `models/${file.name}`,
        originalBlob: blob,
      })
    }
    if (modelInput) modelInput.value = ''
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

<aside class="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
  <!-- Projections -->
  <section class="ui-container flex max-h-fit min-h-0 flex-1 flex-col">
    <div class="flex h-10 shrink-0 items-center justify-between px-3">
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
    <div class="border-b"></div>
    <div class="flex min-h-0 flex-1 flex-col-reverse overflow-auto">
      {#each sceneState.projections as item, index (item.id)}
        <NodeListItem
          {altPressed}
          dropPosition={getDropPosition('projections', index)}
          {item}
          ondragend={handleDragEnd}
          ondragover={(e) => handleDragOver('projections', index, e)}
          ondragstart={(e) => handleDragStart('projections', index, e)}
          ondrop={(e) => handleDrop('projections', index, e)}
          onlock={(i) => {
            i.locked = !i.locked
          }}
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
    </div>
  </section>

  <!-- Models -->
  <section
    class="ui-container flex max-h-fit min-h-0 flex-1 flex-col"
    onclick={(e) => {
      if (e.target === e.currentTarget) {
        sceneState.selected = null
      }
    }}
    role="presentation"
  >
    <div class="flex h-10 shrink-0 items-center justify-between px-3">
      <span>Models</span>
      <button
        class="-mr-3 ui-button h-full px-3"
        onclick={() => modelInput.click()}
        title="Import GLTF/GLB"
      >
        <Add />
      </button>
    </div>
    <div class="border-b"></div>
    <input
      bind:this={modelInput}
      class="hidden"
      accept=".gltf,.glb"
      multiple
      onchange={(e) => handleFiles((e.target as HTMLInputElement).files)}
      type="file"
    />
    <div class="flex min-h-0 flex-1 flex-col-reverse overflow-auto">
      {#each sceneState.objects as item, index (item.id)}
        <NodeListItem
          {altPressed}
          dropPosition={getDropPosition('objects', index)}
          {item}
          ondragend={handleDragEnd}
          ondragover={(e) => handleDragOver('objects', index, e)}
          ondragstart={(e) => handleDragStart('objects', index, e)}
          ondrop={(e) => handleDrop('objects', index, e)}
          onlock={(i) => {
            i.locked = !i.locked
          }}
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
          onclick={() => modelInput.click()}
          role="presentation"
        >
          import a 3D model
        </div>
      {/each}
    </div>
  </section>
</aside>
