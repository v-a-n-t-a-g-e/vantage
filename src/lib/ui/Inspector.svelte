<script lang="ts">
  import { sceneState, sceneActions } from '@/lib/sceneState.svelte.ts'
  import type { ProjectionItem } from '@/lib/types.ts'
  import type { SplatScaleFilter } from '@/lib/splatScaleFilter.ts'
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
  let projectionPlaneVisible = $state(true)

  $effect(() => {
    if (sel?.kind !== 'projection') return
    const p = sel.projection
    cam.fov = p.fov
    cam.near = p.near
    cam.far = p.far
    projectionPlaneVisible = p.projectionPlane?.visible ?? true
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

  // ── Splat scale filter ──

  /** True when the selected object is a gaussian splat with a filter attached */
  const isSplat = $derived(
    sel?.kind === 'object' && sel.source.kind === 'imported' && sel.source.objectType === 'splat'
  )

  // Mirror the filter's current threshold into reactive state so the DragInput
  // updates when the selection changes.
  let maxSplatScale = $state(1e9)

  $effect(() => {
    if (!isSplat || sel?.kind !== 'object') return
    const filter = sel.object.userData?.splatScaleFilter as SplatScaleFilter | undefined
    maxSplatScale = filter?.getMaxScale() ?? 1e9
  })

  let splatScaleStart = 0

  const splatScaleHandler = {
    onstart: () => {
      if (sel?.kind !== 'object') return
      const filter = sel.object.userData?.splatScaleFilter as SplatScaleFilter | undefined
      splatScaleStart = filter?.getMaxScale() ?? 1e9
    },
    onchange: (v: number) => {
      if (sel?.kind !== 'object') return
      maxSplatScale = v
      const filter = sel.object.userData?.splatScaleFilter as SplatScaleFilter | undefined
      filter?.setMaxScale(v)
    },
    onend: (v: number) => {
      if (sel?.kind !== 'object' || splatScaleStart === v) return
      const before = splatScaleStart
      const filter = sel.object.userData?.splatScaleFilter as SplatScaleFilter | undefined
      if (!filter) return
      pushCommand({
        undo: () => {
          filter.setMaxScale(before)
          maxSplatScale = before
        },
        redo: () => {
          filter.setMaxScale(v)
          maxSplatScale = v
        },
      })
    },
  }
</script>

<aside class="ui-container pointer-events-auto col-start-4 row-span-2 self-start">
  {#if sel?.kind === 'object' || sel?.kind === 'projection'}
    <div class="flex h-10 items-center px-3 tracking-wider">
      {sel.kind === 'object' ? 'Transform' : 'Projection'}
    </div>
    <div class="border-b"></div>

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

      {#if isSplat}
        <div class="border-b border-black text-xs">
          <div class="px-3 py-1.5">Filter</div>
          <div class="flex">
            <div class="flex-1 px-3 py-1.5">
              <DragInput
                label="max size"
                step={0.01}
                value={maxSplatScale}
                {...splatScaleHandler}
              />
            </div>
          </div>
        </div>
      {/if}
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
      <label class="ui-button w-full gap-3">
        <input
          checked={projectionPlaneVisible}
          onchange={(e) => {
            const p = (sel as ProjectionItem).projection
            const plane = p.projectionPlane
            if (!plane) return
            const was = projectionPlaneVisible
            projectionPlaneVisible = (e.target as HTMLInputElement).checked
            plane.visible = projectionPlaneVisible
            const now = projectionPlaneVisible
            pushCommand({
              undo: () => {
                projectionPlaneVisible = was
                plane.visible = was
              },
              redo: () => {
                projectionPlaneVisible = now
                plane.visible = now
              },
            })
          }}
          type="checkbox"
        />
        Projection Plane
      </label>
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
