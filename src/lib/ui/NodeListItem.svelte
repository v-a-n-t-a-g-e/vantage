<script lang="ts">
  import { sceneState } from '@/lib/sceneState.svelte.ts'
  import type { SceneObject } from '@/lib/sceneState.svelte.ts'
  import IconHide from '@/assets/icons/Hide.svg'

  interface Props {
    item: SceneObject
    ontoggle: (_item: SceneObject) => void
  }

  let { item, ontoggle }: Props = $props()

  function toggleVisibility(e: MouseEvent) {
    e.stopPropagation()
    ontoggle(item)
  }

  function select() {
    sceneState.selected = sceneState.selected === item ? null : item
  }
</script>

<div
  class="group flex items-center h-10 gap-2 px-3 cursor-pointer select-none"
  class:bg-brand={sceneState.selected === item}
  role="button"
  tabindex="0"
  onclick={select}
  onkeydown={(e) => e.key === 'Enter' && select()}
>
  <span class:opacity-40={!item.visible}>{item.name}</span>

  <button
    class="ml-auto -mx-1.5 px-1.5 h-10
           opacity-0 group-hover:opacity-40 hover:opacity-100!"
    class:!opacity-40={!item.visible}
    onclick={toggleVisibility}
    tabindex="-1"
    aria-label="Toggle visibility"
  >
    <IconHide />
  </button>
</div>
