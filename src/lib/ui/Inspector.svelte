<script lang="ts">
  import { sceneState, sceneActions } from '@/lib/sceneState.svelte.ts'
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
    const proj = sceneState.selectedProjection?.projection
    if (!proj) return
    fovValue = proj.fov
    nearValue = proj.near
    farValue = proj.far
  })
</script>

<aside class="ui-container row-span-2 flex-1 min-h-0 overflow-auto pointer-events-auto">
  {#if sceneState.selected}
    <div class="px-3 flex items-center tracking-wider h-10 border-b">Transform</div>
    <Vec3Controls
      title="Position"
      object={sceneState.selected?.object}
      prop="position"
      labels={['x', 'y', 'elevation']}
      step={0.1}
    />
    <Vec3Controls
      title="Rotation"
      object={sceneState.selected?.object}
      prop="rotation"
      labels={['pitch', 'yaw', 'roll']}
      step={0.1}
      toDisplay={(v) => v * (180 / Math.PI)}
      fromDisplay={(v) => v * (Math.PI / 180)}
    />
    <Vec3Controls
      title="Scale"
      object={sceneState.selected?.object}
      prop="scale"
      labels={['x', 'y', 'z']}
      step={0.01}
    />
    <button
      class="ui-button w-full border-t text-red-400"
      onclick={() => sceneActions.value?.removeObject(sceneState.selected!)}>Delete</button
    >
  {:else if sceneState.selectedProjection}
    <div class="px-3 flex items-center tracking-wider h-10 border-b">Projection</div>
    <Vec3Controls
      title="Position"
      object={sceneState.selectedProjection?.projection}
      prop="position"
      labels={['x', 'y', 'elevation']}
      step={0.1}
    />
    <Vec3Controls
      title="Rotation"
      object={sceneState.selectedProjection?.projection}
      prop="rotation"
      labels={['pitch', 'yaw', 'roll']}
      step={0.1}
      toDisplay={(v) => v * (180 / Math.PI)}
      fromDisplay={(v) => v * (Math.PI / 180)}
    />

    <!-- FOV -->
    <div class="border-b border-black text-xs">
      <div class="px-3 py-1.5">Camera</div>
      <div class="flex divide-x">
        <div class="flex-1 px-3 py-1.5">
          <DragInput
            label="fov"
            value={fovValue}
            step={0.5}
            onstart={() => {
              fovStart = sceneState.selectedProjection!.projection.fov
            }}
            onchange={(v) => {
              fovValue = v
              const proj = sceneState.selectedProjection?.projection
              if (proj) {
                proj.fov = v
                proj.updateProjectionMatrix()
              }
            }}
            onend={(v) => {
              const proj = sceneState.selectedProjection?.projection
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
          />
        </div>
        <div class="flex-1 px-3 py-1.5">
          <DragInput
            label="near"
            value={nearValue}
            step={0.1}
            onstart={() => {
              nearStart = sceneState.selectedProjection!.projection.near
            }}
            onchange={(v) => {
              nearValue = v
              const proj = sceneState.selectedProjection?.projection
              if (proj) {
                proj.near = v
                proj.updateProjectionMatrix()
              }
            }}
            onend={(v) => {
              const proj = sceneState.selectedProjection?.projection
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
          />
        </div>
        <div class="flex-1 px-3 py-1.5">
          <DragInput
            label="far"
            value={farValue}
            step={1}
            onstart={() => {
              farStart = sceneState.selectedProjection!.projection.far
            }}
            onchange={(v) => {
              farValue = v
              const proj = sceneState.selectedProjection?.projection
              if (proj) {
                proj.far = v
                proj.updateProjectionMatrix()
              }
            }}
            onend={(v) => {
              const proj = sceneState.selectedProjection?.projection
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
          />
        </div>
      </div>
    </div>

    <button
      class="ui-button w-full border-t text-red-400"
      onclick={() => sceneActions.value?.removeProjection(sceneState.selectedProjection!)}
      >Delete</button
    >
  {/if}
</aside>
