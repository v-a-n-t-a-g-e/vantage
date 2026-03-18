<script lang="ts">
  import { sceneState, sceneActions } from '@/lib/sceneState.svelte.ts'
  import type { SceneObject, ProjectionItem } from '@/lib/sceneState.svelte.ts'
  import IconHide from '@/assets/icons/Hide.svg'

  interface Props {
    item: SceneObject | ProjectionItem
    ontoggle: (_item: SceneObject | ProjectionItem) => void
    ondragstart?: (_e: DragEvent) => void
    ondragover?: (_e: DragEvent) => void
    ondrop?: (_e: DragEvent) => void
    ondragend?: (_e: DragEvent) => void
    dropPosition?: 'above' | 'below' | null
  }

  let { item, ontoggle, ondragstart, ondragover, ondrop, ondragend, dropPosition }: Props = $props()

  function toggleVisibility(e: MouseEvent) {
    e.stopPropagation()
    ontoggle(item)
  }

  function select() {
    if (sceneState.tool === 'aim') sceneActions.value?.exitAimMode()
    sceneState.selected = item
  }
</script>

<div
  class="group relative flex h-10 items-center gap-1 px-3 select-none"
  class:bg-brand={sceneState.selected === item}
  draggable="true"
  onclick={select}
  ondblclick={() => {
    select()
    if (item.kind === 'object') sceneActions.value?.focusObject(item)
    else sceneActions.value?.focusProjection(item)
  }}
  {ondragend}
  {ondragover}
  {ondragstart}
  {ondrop}
  onkeydown={(e) => e.key === 'Enter' && select()}
  onmouseenter={() => {
    if (item.kind === 'object') sceneState.hovered = item
  }}
  onmouseleave={() => {
    if (item.kind === 'object') sceneState.hovered = null
  }}
  role="button"
  tabindex="0"
>
  {#if dropPosition}
    <div
      class="absolute right-3 left-3 h-1 bg-brand"
      class:bottom-0={dropPosition === 'below'}
      class:top-0={dropPosition === 'above'}
    ></div>
  {/if}

  <div class="overflow-hidden text-nowrap text-ellipsis" class:opacity-40={!item.visible}>
    {item.name}
  </div>

  <button
    class="-mx-1.5 ml-auto h-10 px-1.5
           opacity-0 group-hover:opacity-40 hover:opacity-100!"
    class:!opacity-40={!item.visible}
    aria-label="Toggle visibility"
    onclick={toggleVisibility}
    tabindex="-1"
  >
    <IconHide />
  </button>
</div>
