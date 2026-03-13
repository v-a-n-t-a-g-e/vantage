<script lang="ts">
  import { pushCommand } from '@/lib/history.svelte.ts'
  import { sceneState } from '@/lib/sceneState.svelte.ts'
  import DragInput from '@/lib/ui/DragInput.svelte'

  interface Props {
    title: string
    object: any
    prop: string
    labels?: [string, string, string]
    step?: number
    toDisplay?: (_v: number) => number
    fromDisplay?: (_v: number) => number
  }

  let {
    title,
    object,
    prop,
    labels = ['x', 'y', 'z'],
    step = 1,
    toDisplay = (_v) => _v,
    fromDisplay = (_v) => _v,
  }: Props = $props()

  type Axis = 'x' | 'y' | 'z'

  let values = $state({ x: 0, y: 0, z: 0 })
  let startObj: any = null
  let startSnapshot = { x: 0, y: 0, z: 0 }

  $effect(() => {
    sceneState.transformRevision // subscribe to external transform changes
    if (!object) return
    values.x = toDisplay(object[prop].x)
    values.y = toDisplay(object[prop].y)
    values.z = toDisplay(object[prop].z)
  })

  function onstart(axis: Axis) {
    startObj = object
    startSnapshot[axis] = startObj[prop][axis]
  }

  function onchange(axis: Axis, v: number) {
    values[axis] = v
    if (object) object[prop][axis] = fromDisplay(v)
  }

  function onend(axis: Axis, v: number) {
    const obj = startObj
    if (!obj) return
    const before = startSnapshot[axis]
    const after = fromDisplay(v)
    if (before !== after)
      pushCommand({
        undo: () => {
          obj[prop][axis] = before
          values[axis] = toDisplay(before)
        },
        redo: () => {
          obj[prop][axis] = after
          values[axis] = v
        },
      })
  }
</script>

<div class="border-b border-black text-xs">
  <div class="px-3 py-1.5">{title}</div>
  <div class="flex divide-x">
    {#each ['x', 'z', 'y'] as axis, i (axis)}
      <div class="flex-1 px-3 py-1.5">
        <DragInput
          label={labels[i]}
          value={values[axis as Axis]}
          {step}
          {axis}
          onstart={() => onstart(axis as Axis)}
          onchange={(v) => onchange(axis as Axis, v)}
          onend={(v) => onend(axis as Axis, v)}
        />
      </div>
    {/each}
  </div>
</div>
