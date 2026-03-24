<script lang="ts">
  import NodeListItem from '@/lib/ui/NodeListItem.svelte'
  import { sceneState } from '@/lib/sceneState.svelte.ts'
  import { toggleVisibility, toggleLock } from '@/lib/editActions.ts'
  import { importModelFiles, importImageFiles } from '@/lib/fileImport.ts'
  import { useModifierKeys } from '@/lib/useModifierKeys.svelte.ts'
  import { useDragReorder } from '@/lib/ui/useDragReorder.svelte.ts'
  import Add from '@/assets/icons/Add.svg'

  let modelInput: HTMLInputElement
  let imageInput: HTMLInputElement

  const { keys: modKeys, cleanup: cleanupModKeys } = useModifierKeys()
  const altPressed = $derived(modKeys.alt)
  $effect(() => cleanupModKeys)

  const drag = useDragReorder()

  async function handleFiles(files: FileList | null | undefined) {
    if (!files) return
    await importModelFiles(files)
    if (modelInput) modelInput.value = ''
  }

  async function handleImages(files: FileList | null | undefined) {
    if (!files) return
    await importImageFiles(files)
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
          dropPosition={drag.getDropPosition('projections', index)}
          {item}
          ondragend={drag.handleDragEnd}
          ondragover={(e) => drag.handleDragOver('projections', index, e)}
          ondragstart={(e) => drag.handleDragStart('projections', index, e)}
          ondrop={(e) => drag.handleDrop('projections', index, e)}
          onlock={toggleLock}
          ontoggle={toggleVisibility}
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
          dropPosition={drag.getDropPosition('objects', index)}
          {item}
          ondragend={drag.handleDragEnd}
          ondragover={(e) => drag.handleDragOver('objects', index, e)}
          ondragstart={(e) => drag.handleDragStart('objects', index, e)}
          ondrop={(e) => drag.handleDrop('objects', index, e)}
          onlock={toggleLock}
          ontoggle={toggleVisibility}
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
