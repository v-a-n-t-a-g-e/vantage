<script lang="ts">
  import { untrack } from 'svelte'
  import { sceneState } from '@/lib/sceneState.svelte.ts'
  import type { Tool } from '@/lib/sceneState.svelte.ts'
  import type { Component } from 'svelte'

  import IconCursor from '@/assets/icons/Cursor.svg'
  import IconTranslate from '@/assets/icons/Translate.svg'
  import IconRotate from '@/assets/icons/Rotate.svg'
  import IconScale from '@/assets/icons/Scale.svg'
  import IconAim from '@/assets/icons/Aim.svg'

  type ToolbarItem = {
    label: string
    icon: Component
    value: Tool
    hidden?: () => boolean
    disabled?: () => boolean
  }

  const tools: ToolbarItem[] = [
    {
      label: 'Cursor',
      icon: IconCursor,
      value: 'cursor',
      disabled: () => sceneState.tool === 'aim',
    },
    {
      label: 'Translate',
      icon: IconTranslate,
      value: 'translate',
      disabled: () => sceneState.tool === 'aim',
    },
    {
      label: 'Rotate',
      icon: IconRotate,
      value: 'rotate',
      disabled: () => sceneState.tool === 'aim',
    },
    {
      label: 'Scale',
      icon: IconScale,
      value: 'scale',
      hidden: () => sceneState.selected?.kind === 'projection',
    },
    {
      label: 'Aim',
      icon: IconAim,
      value: 'aim',
      hidden: () => sceneState.selected?.kind !== 'projection',
    },
  ]

  $effect(() => {
    const active = tools.find((t) => t.value === sceneState.tool)
    if (active?.hidden?.()) {
      const fallback = tools.find((t) => !t.hidden?.() && !t.disabled?.())
      if (fallback) untrack(() => (sceneState.tool = fallback.value))
    }
  })

</script>

<div
  class="ui-container col-start-3 row-start-1 flex justify-self-end"
  aria-label="Active tool"
  role="radiogroup"
>
  {#each tools as { icon: Icon, ...tool } (tool.label)}
    {#if !tool.hidden?.()}
      <label class="ui-button" class:!bg-green={sceneState.tool === tool.value}>
        <input
          name="active-tool"
          class="sr-only"
          aria-label={tool.label}
          type="radio"
          value={tool.value}
          bind:group={sceneState.tool}
        />
        <Icon />
      </label>
    {/if}
  {/each}
</div>
