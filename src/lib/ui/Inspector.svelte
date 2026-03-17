<script lang="ts">
  import { sceneState, sceneActions } from '@/lib/sceneState.svelte.ts'
  import type { ProjectionItem } from '@/lib/sceneState.svelte.ts'
  import { pushCommand } from '@/lib/history.svelte.ts'
  import Vec3Controls from '@/lib/ui/Vec3Controls.svelte'
  import DragInput from '@/lib/ui/DragInput.svelte'

  let fovValue = $state(60)
  let nearValue = $state(1)
  let farValue = $state(200)

  let fovStart = 0
  let nearStart = 0
  let farStart = 0

  $effect(() => {
    if (sceneState.selected?.kind !== 'projection') return
    const proj = sceneState.selected.projection
    fovValue = proj.fov
    nearValue = proj.near
    farValue = proj.far
  })
</script>

<aside class="ui-container pointer-events-auto row-span-2 min-h-0 flex-1 overflow-auto">
  {#if sceneState.selected?.kind === 'object'}
    <div class="flex h-10 items-center border-b px-3 tracking-wider">Transform</div>
    <Vec3Controls
      labels={['x', 'y', 'elevation']}
      object={sceneState.selected.object}
      prop="position"
      step={0.1}
      title="Position"
    />
    <Vec3Controls
      fromDisplay={(v) => v * (Math.PI / 180)}
      labels={['pitch', 'yaw', 'roll']}
      object={sceneState.selected.object}
      prop="rotation"
      step={0.1}
      title="Rotation"
      toDisplay={(v) => v * (180 / Math.PI)}
    />
    <Vec3Controls
      labels={['x', 'y', 'z']}
      object={sceneState.selected.object}
      prop="scale"
      step={0.01}
      title="Scale"
    />
    <button
      class="ui-button w-full border-t text-red-400"
      onclick={() => sceneActions.value?.removeObject(sceneState.selected! as any)}>Delete</button
    >
  {:else if sceneState.selected?.kind === 'projection'}
    <div class="flex h-10 items-center border-b px-3 tracking-wider">Projection</div>
    <Vec3Controls
      labels={['x', 'y', 'elevation']}
      object={(sceneState.selected as ProjectionItem).projection}
      prop="position"
      step={0.1}
      title="Position"
    />
    <Vec3Controls
      fromDisplay={(v) => v * (Math.PI / 180)}
      labels={['pitch', 'yaw', 'roll']}
      object={(sceneState.selected as ProjectionItem).projection}
      prop="rotation"
      step={0.1}
      title="Rotation"
      toDisplay={(v) => v * (180 / Math.PI)}
    />

    <!-- FOV -->
    <div class="border-b border-black text-xs">
      <div class="px-3 py-1.5">Camera</div>
      <div class="flex divide-x">
        <div class="flex-1 px-3 py-1.5">
          <DragInput
            label="fov"
            onchange={(v) => {
              fovValue = v
              const proj = (sceneState.selected as ProjectionItem | null)?.projection
              if (proj) {
                proj.fov = v
                proj.updateProjectionMatrix()
              }
            }}
            onend={(v) => {
              const proj = (sceneState.selected as ProjectionItem | null)?.projection
              if (!proj) return
              const before = fovStart
              const after = v
              if (before !== after)
                pushCommand({
                  undo: () => {
                    proj.fov = before
                    proj.updateProjectionMatrix()
                    fovValue = before
                  },
                  redo: () => {
                    proj.fov = after
                    proj.updateProjectionMatrix()
                    fovValue = after
                  },
                })
            }}
            onstart={() => {
              fovStart = (sceneState.selected as ProjectionItem).projection.fov
            }}
            step={0.5}
            value={fovValue}
          />
        </div>
        <div class="flex-1 px-3 py-1.5">
          <DragInput
            label="near"
            onchange={(v) => {
              nearValue = v
              const proj = (sceneState.selected as ProjectionItem | null)?.projection
              if (proj) {
                proj.near = v
                proj.updateProjectionMatrix()
              }
            }}
            onend={(v) => {
              const proj = (sceneState.selected as ProjectionItem | null)?.projection
              if (!proj) return
              const before = nearStart
              const after = v
              if (before !== after)
                pushCommand({
                  undo: () => {
                    proj.near = before
                    proj.updateProjectionMatrix()
                    nearValue = before
                  },
                  redo: () => {
                    proj.near = after
                    proj.updateProjectionMatrix()
                    nearValue = after
                  },
                })
            }}
            onstart={() => {
              nearStart = (sceneState.selected as ProjectionItem).projection.near
            }}
            step={0.1}
            value={nearValue}
          />
        </div>
        <div class="flex-1 px-3 py-1.5">
          <DragInput
            label="far"
            onchange={(v) => {
              farValue = v
              const proj = (sceneState.selected as ProjectionItem | null)?.projection
              if (proj) {
                proj.far = v
                proj.updateProjectionMatrix()
              }
            }}
            onend={(v) => {
              const proj = (sceneState.selected as ProjectionItem | null)?.projection
              if (!proj) return
              const before = farStart
              const after = v
              if (before !== after)
                pushCommand({
                  undo: () => {
                    proj.far = before
                    proj.updateProjectionMatrix()
                    farValue = before
                  },
                  redo: () => {
                    proj.far = after
                    proj.updateProjectionMatrix()
                    farValue = after
                  },
                })
            }}
            onstart={() => {
              farStart = (sceneState.selected as ProjectionItem).projection.far
            }}
            step={1}
            value={farValue}
          />
        </div>
      </div>
    </div>

    <button
      class="ui-button w-full border-t text-red-400"
      onclick={() => sceneActions.value?.removeProjection(sceneState.selected as ProjectionItem)}
      >Delete</button
    >
  {/if}
</aside>
