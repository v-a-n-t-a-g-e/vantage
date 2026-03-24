<script lang="ts">
  import { sceneState, sceneActions } from '@/lib/sceneState.svelte.ts'
  import type { SceneObject, ProjectionItem } from '@/lib/types.ts'
  import { pushCommand } from '@/lib/history.svelte.ts'
  import IconHide from '@/assets/icons/Hide.svg'
  import IconLock from '@/assets/icons/Lock.svg'

  interface Props {
    item: SceneObject | ProjectionItem
    altPressed: boolean
    ontoggle: (_item: SceneObject | ProjectionItem) => void
    onlock: (_item: SceneObject | ProjectionItem) => void
    ondragstart?: (_e: DragEvent) => void
    ondragover?: (_e: DragEvent) => void
    ondrop?: (_e: DragEvent) => void
    ondragend?: (_e: DragEvent) => void
    dropPosition?: 'above' | 'below' | null
  }

  let {
    item,
    altPressed,
    ontoggle,
    onlock,
    ondragstart,
    ondragover,
    ondrop,
    ondragend,
    dropPosition,
  }: Props = $props()

  // Show lock icon when: locked+visible, OR unlocked+visible+alt
  // Show hide icon when: hidden (any lock state), OR unlocked+visible+no-alt
  const showLockIcon = $derived(
    (item.locked && item.visible) || (!item.locked && item.visible && altPressed)
  )

  // Button is always visible (not just on hover) when item has a non-default state
  const alwaysVisible = $derived(item.locked || !item.visible)

  function handleToggle(e: MouseEvent) {
    e.stopPropagation()
    if (showLockIcon) onlock(item)
    else ontoggle(item)
  }

  const isRenaming = $derived(sceneState.renaming === item)

  function select() {
    if (sceneState.tool === 'aim') sceneActions.value?.exitAimMode()
    sceneState.selected = item
  }

  function commitRename(input: HTMLInputElement) {
    const value = input.value.trim()
    if (value && value !== item.name) {
      const oldName = item.name
      item.name = value
      pushCommand({
        undo: () => {
          item.name = oldName
        },
        redo: () => {
          item.name = value
        },
      })
    }
    sceneState.renaming = null
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

  {#if isRenaming}
    <!-- svelte-ignore a11y_autofocus -->
    <input
      class="min-w-0 flex-1 bg-transparent outline-none"
      autofocus
      onblur={(e) => commitRename(e.currentTarget)}
      onclick={(e) => e.stopPropagation()}
      onkeydown={(e) => {
        e.stopPropagation()
        if (e.key === 'Enter') e.currentTarget.blur()
        if (e.key === 'Escape') {
          e.currentTarget.value = item.name
          e.currentTarget.blur()
        }
      }}
      value={item.name}
    />
  {:else}
    <div class="overflow-hidden text-nowrap text-ellipsis" class:opacity-40={!item.visible}>
      {item.name}
    </div>
  {/if}

  <button
    class="-mx-1.5 ml-auto h-10 px-1.5 hover:opacity-100!"
    class:group-hover:opacity-40={!alwaysVisible}
    class:opacity-0={!alwaysVisible}
    class:opacity-40={alwaysVisible}
    aria-label={showLockIcon ? 'Toggle lock' : 'Toggle visibility'}
    onclick={handleToggle}
    tabindex="-1"
  >
    {#if showLockIcon}
      <IconLock />
    {:else}
      <IconHide />
    {/if}
  </button>
</div>
