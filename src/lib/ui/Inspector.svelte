<script lang="ts">
  import { sceneState, sceneActions } from '@/lib/sceneState.svelte.ts'
  import type { ProjectionItem } from '@/lib/sceneState.svelte.ts'
  import { pushCommand } from '@/lib/history.svelte.ts'
  import Vec3Controls from '@/lib/ui/Vec3Controls.svelte'
  import DragInput from '@/lib/ui/DragInput.svelte'
  import DeleteIcon from '@/assets/icons/Delete.svg'

  const sel = $derived(sceneState.selected)

  // Both Object3D and VantageProjection share position/rotation
  const transformTarget = $derived(
    sel?.kind === 'object' ? sel.object : sel?.kind === 'projection' ? sel.projection : null
  )

  // VantageProjection props aren't Svelte-reactive, so mirror them into state
  let cam = $state({ fov: 60, near: 1, far: 200 })

  $effect(() => {
    if (sel?.kind !== 'projection') return
    const p = sel.projection
    cam.fov = p.fov
    cam.near = p.near
    cam.far = p.far
  })

  function camHandler(key: 'fov' | 'near' | 'far') {
    let start = 0
    return {
      onstart: () => {
        start = (sel as ProjectionItem).projection[key]
      },
      onchange: (v: number) => {
        cam[key] = v
        const p = (sel as ProjectionItem).projection
        p[key] = v
        p.updateProjectionMatrix()
      },
      onend: (v: number) => {
        const p = (sel as ProjectionItem)?.projection
        if (!p || start === v) return
        const before = start
        pushCommand({
          undo: () => {
            p[key] = before
            p.updateProjectionMatrix()
            cam[key] = before
          },
          redo: () => {
            p[key] = v
            p.updateProjectionMatrix()
            cam[key] = v
          },
        })
      },
    }
  }

  const fovHandler = camHandler('fov')
  const nearHandler = camHandler('near')
  const farHandler = camHandler('far')
</script>

<aside class="ui-container pointer-events-auto row-span-2 min-h-0 flex-1 overflow-auto">
  {#if sel?.kind === 'object' || sel?.kind === 'projection'}
    <div class="flex h-10 items-center border-b px-3 tracking-wider">
      {sel.kind === 'object' ? 'Transform' : 'Projection'}
    </div>

    <Vec3Controls
      labels={['x', 'y', 'elevation']}
      object={transformTarget!}
      prop="position"
      step={0.1}
      title="Position"
    />
    <Vec3Controls
      fromDisplay={(v) => v * (Math.PI / 180)}
      labels={['pitch', 'yaw', 'roll']}
      object={transformTarget!}
      prop="rotation"
      step={0.1}
      title="Rotation"
      toDisplay={(v) => v * (180 / Math.PI)}
    />

    {#if sel.kind === 'object'}
      <Vec3Controls
        labels={['x', 'y', 'z']}
        object={sel.object}
        prop="scale"
        step={0.01}
        title="Scale"
      />
    {/if}

    {#if sel.kind === 'projection'}
      <div class="border-b border-black text-xs">
        <div class="px-3 py-1.5">Camera</div>
        <div class="flex divide-x">
          <div class="flex-1 px-3 py-1.5">
            <DragInput label="fov" step={0.5} value={cam.fov} {...fovHandler} />
          </div>
          <div class="flex-1 px-3 py-1.5">
            <DragInput label="near" step={0.1} value={cam.near} {...nearHandler} />
          </div>
          <div class="flex-1 px-3 py-1.5">
            <DragInput label="far" step={1} value={cam.far} {...farHandler} />
          </div>
        </div>
      </div>
    {/if}

    <button
      class="ui-button w-full gap-3 text-red"
      onclick={() =>
        sel.kind === 'object'
          ? sceneActions.value?.removeObject(sel)
          : sceneActions.value?.removeProjection(sel as ProjectionItem)}
    >
      <DeleteIcon />
      Delete
    </button>
  {/if}
</aside>
