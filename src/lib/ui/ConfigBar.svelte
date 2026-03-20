<script lang="ts">
  import { sceneState } from '@/lib/sceneState.svelte.ts'
  import { pushCommand } from '@/lib/history.svelte.ts'

  let colorBefore = ''
</script>

<div class="ui-container pointer-events-auto flex h-10 shrink-0 items-center gap-3 px-3">
  <label class="flex items-center gap-1.5 text-xs">
    <input
      type="checkbox"
      checked={sceneState.showGrid}
      onchange={() => {
        sceneState.showGrid = !sceneState.showGrid
        const now = sceneState.showGrid
        pushCommand({
          undo: () => { sceneState.showGrid = !now },
          redo: () => { sceneState.showGrid = now },
        })
      }}
    />
    Grid
  </label>

  <label class="flex items-center gap-1.5 text-xs">
    BG
    <input
      type="color"
      class="h-5 w-5 cursor-pointer border border-black p-0"
      value={sceneState.clearColor}
      onfocus={() => { colorBefore = sceneState.clearColor }}
      oninput={(e) => { sceneState.clearColor = (e.target as HTMLInputElement).value }}
      onchange={(e) => {
        const after = (e.target as HTMLInputElement).value
        sceneState.clearColor = after
        const before = colorBefore
        if (before !== after) {
          pushCommand({
            undo: () => { sceneState.clearColor = before },
            redo: () => { sceneState.clearColor = after },
          })
        }
      }}
    />
  </label>
</div>
