<script>
  import { pushCommand } from '@/lib/history.svelte.js'
  import { sceneState } from '@/lib/sceneState.svelte.js'
  import DragInput from '@/lib/ui/DragInput.svelte'

  /** @type {{ title: string, object: any, prop: string, labels?: [string,string,string], step?: number, toDisplay?: (v: number) => number, fromDisplay?: (v: number) => number }} */
  let {
    title,
    object,
    prop,
    labels = ['x', 'y', 'z'],
    step = 1,
    toDisplay = (v) => v,
    fromDisplay = (v) => v,
  } = $props()

  let values = $state({ x: 0, y: 0, z: 0 })
  let startObj = /** @type {any} */ (null)
  let startSnapshot = { x: 0, y: 0, z: 0 }

  $effect(() => {
    sceneState.transformRevision // subscribe to external transform changes
    if (!object) return
    values.x = toDisplay(object[prop].x)
    values.y = toDisplay(object[prop].y)
    values.z = toDisplay(object[prop].z)
  })

  /** @param {'x'|'y'|'z'} axis */
  function onstart(axis) {
    startObj = object
    startSnapshot[axis] = startObj[prop][axis]
  }

  /**
   * @param {'x'|'y'|'z'} axis
   * @param {number} v display-unit value
   */
  function onchange(axis, v) {
    values[axis] = v
    if (object) object[prop][axis] = fromDisplay(v)
  }

  /**
   * @param {'x'|'y'|'z'} axis
   * @param {number} v display-unit value
   */
  function onend(axis, v) {
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
          value={values[axis]}
          {step}
          {axis}
          onstart={() => onstart(axis)}
          onchange={(v) => onchange(axis, v)}
          onend={(v) => onend(axis, v)}
        />
      </div>
    {/each}
  </div>
</div>
