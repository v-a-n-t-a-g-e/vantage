<script lang="ts">
  import { sceneState, sceneActions } from '@/lib/sceneState.svelte.ts'
  import type { SceneObject, ProjectionItem } from '@/lib/sceneState.svelte.ts'
  import IconHide from '@/assets/icons/Hide.svg'

  interface Props {
    item: SceneObject | ProjectionItem
    ontoggle: (_item: SceneObject | ProjectionItem) => void
  }

  let { item, ontoggle }: Props = $props()

  function toggleVisibility(e: MouseEvent) {
    e.stopPropagation()
    ontoggle(item)
  }

  function select() {
    if (sceneState.aimMode) sceneActions.value?.exitAimMode()
    sceneState.selected = item
  }
</script>

<div
  class="group flex h-10 cursor-pointer items-center gap-1 px-3 select-none"
  class:bg-brand={sceneState.selected === item}
  onclick={select}
  ondblclick={() => {
    select()
    if (item.kind === 'object') sceneActions.value?.focusObject(item)
    else sceneActions.value?.focusProjection(item)
  }}
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
