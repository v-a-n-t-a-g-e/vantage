<script lang="ts">
  import { untrack } from 'svelte'
  import { sceneState, sceneActions } from '@/lib/sceneState.svelte.ts'
  import type { Tool } from '@/lib/sceneState.svelte.ts'
  import type { Component } from 'svelte'

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

  let prevTool: Tool = sceneState.tool

  $effect(() => {
    const currentTool = sceneState.tool
    if (currentTool === 'aim' && prevTool !== 'aim') {
      untrack(() => sceneActions.value?.enterAimMode())
    }
    prevTool = currentTool
  })
</script>

<div
  class="ui-container col-start-3 row-start-1 flex justify-self-end"
  aria-label="Active tool"
  role="radiogroup"
>
  {#each tools as { icon: Icon, ...tool } (tool.label)}
    {#if !tool.hidden?.()}
      <label
        class="ui-button"
        class:!bg-green={sceneState.tool === tool.value}
        class:cursor-pointer={!tool.disabled?.()}
        class:opacity-40={tool.disabled?.()}
      >
        <input
          name="active-tool"
          class="sr-only"
          aria-label={tool.label}
          disabled={tool.disabled?.()}
          type="radio"
          value={tool.value}
          bind:group={sceneState.tool}
        />
        <Icon />
      </label>
    {/if}
  {/each}
</div>
