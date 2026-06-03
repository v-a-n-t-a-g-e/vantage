<script lang="ts">
  import { sceneState, sceneActions } from '@/lib/sceneState.svelte.ts'
  import type { ProjectionItem } from '@/lib/types.ts'
  import { pushCommand } from '@/lib/history.svelte.ts'
  import Vec3Controls from '@/lib/ui/Vec3Controls.svelte'
  import UniformScaleControl from '@/lib/ui/UniformScaleControl.svelte'
  import PointCloudControls from '@/lib/ui/PointCloudControls.svelte'
  import DragInput from '@/lib/ui/DragInput.svelte'
  import DeleteIcon from '@/assets/icons/Delete.svg'

  const sel = $derived(sceneState.selected)

  // A live SplatMesh only honors uniform scale; once rendered as points it's a
  // regular THREE.Points and supports per-axis scale.
  const isSplatMesh = $derived(sel?.kind === 'object' && sel.object.userData?.isSplat === true)
  // Whether the selected object is currently a point cloud (native, or a splat
  // toggled to point-cloud rendering).
  const isPointCloud = $derived(sel?.kind === 'object' && sel.object.userData?.isPointCloud === true)
  // Splat-sourced objects can be toggled between splat and point-cloud rendering.
  const isSplatSource = $derived(
    sel?.kind === 'object' && sel.source.kind === 'imported' && sel.source.format === 'splat'
  )

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
      {#if isSplatMesh}
        <UniformScaleControl object={sel.object} step={0.01} />
      {:else}
        <Vec3Controls
          labels={['x', 'y', 'z']}
          object={sel.object}
          prop="scale"
          step={0.01}
          title="Scale"
        />
      {/if}

      {#if isSplatSource}
        <label class="ui-button w-full gap-3">
          <input
            checked={isPointCloud}
            onchange={(e) =>
              sceneActions.value?.setObjectRenderMode(
                sel,
                (e.target as HTMLInputElement).checked ? 'pointcloud' : 'splat'
              )}
            type="checkbox"
          />
          Render as point cloud
        </label>
      {/if}

      {#if isPointCloud}
        <PointCloudControls item={sel} />
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
      <label class="ui-button w-full justify-between gap-3">
        Coupled model
        <select
          class="min-w-0 flex-1 cursor-pointer truncate border border-black bg-white px-1 py-0.5 text-right"
          onchange={(e) => {
            const p = sel as ProjectionItem
            const before = p.coupledObjectId
            const after = (e.target as HTMLSelectElement).value || undefined
            if (before === after) return
            p.coupledObjectId = after
            pushCommand({
              undo: () => {
                p.coupledObjectId = before
              },
              redo: () => {
                p.coupledObjectId = after
              },
            })
          }}
          value={(sel as ProjectionItem).coupledObjectId ?? ''}
        >
          <option value="">None</option>
          {#each sceneState.objects as obj (obj.id)}
            <option value={obj.id}>{obj.name}</option>
          {/each}
        </select>
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
