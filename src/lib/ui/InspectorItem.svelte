<script>
  import { sceneState } from '@/lib/sceneState.svelte.js'

  let { item, ontoggle } = $props()

  function toggleVisibility() {
    ontoggle(item)
  }

  function select() {
    sceneState.selected = sceneState.selected === item ? null : item
  }
</script>

<div
  class="flex items-center gap-2 px-2 py-0.5 cursor-pointer select-none {sceneState.selected ===
  item
    ? 'bg-white/10'
    : ''}"
  role="button"
  tabindex="0"
  onclick={select}
  onkeydown={(e) => e.key === 'Enter' && select()}
>
  <input
    type="checkbox"
    checked={item.visible}
    onclick={(e) => {
      e.stopPropagation()
      toggleVisibility()
    }}
  />
  <span class={item.visible ? '' : 'opacity-40'}>{item.name}</span>
</div>
