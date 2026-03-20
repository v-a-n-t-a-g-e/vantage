<script lang="ts">
  import { sceneState } from '@/lib/sceneState.svelte.ts'
  import { pushCommand } from '@/lib/history.svelte.ts'

  let colorBefore = ''
  import IconGrid from '@/assets/icons/Grid.svg'
</script>

<div class="ui-container pointer-events-auto flex h-10 shrink-0 items-center gap-3 px-3">
  <button
    class="flex items-center transition-opacity"
    class:text-brand={sceneState.showGrid}
    onclick={() => {
      sceneState.showGrid = !sceneState.showGrid
      const now = sceneState.showGrid
      pushCommand({
        undo: () => {
          sceneState.showGrid = !now
        },
        redo: () => {
          sceneState.showGrid = now
        },
      })
    }}
  >
    <IconGrid />
  </button>

  <label class="relative flex size-4 cursor-pointer items-center justify-center">
    <span
      style="background-color: {sceneState.clearColor}"
      class="size-4 rounded-full border border-black"
    ></span>
    <input
      class="absolute inset-0 cursor-pointer opacity-0"
      onchange={(e) => {
        const after = (e.target as HTMLInputElement).value
        sceneState.clearColor = after
        const before = colorBefore
        if (before !== after) {
          pushCommand({
            undo: () => {
              sceneState.clearColor = before
            },
            redo: () => {
              sceneState.clearColor = after
            },
          })
        }
      }}
      onfocus={() => {
        colorBefore = sceneState.clearColor
      }}
      oninput={(e) => {
        sceneState.clearColor = (e.target as HTMLInputElement).value
      }}
      type="color"
      value={sceneState.clearColor}
    />
  </label>
</div>
