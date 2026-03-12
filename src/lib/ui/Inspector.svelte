<script>
  import { onMount } from 'svelte'
  import { sceneState } from '@/lib/sceneState.svelte.js'
  import { pushCommand } from '@/lib/history.svelte.js'
  import DragInput from '@/lib/ui/DragInput.svelte'

  const RAD2DEG = 180 / Math.PI
  const DEG2RAD = Math.PI / 180

  let panel
  let pos = $state({ x: 0, y: 0, z: 0 })
  let rot = $state({ x: 0, y: 0, z: 0 })
  let scale = $state({ x: 1, y: 1, z: 1 })

  let startObj = /** @type {any} */ (null)
  let posStart = { x: 0, y: 0, z: 0 }
  let rotStart = { x: 0, y: 0, z: 0 }
  let scaleStart = { x: 1, y: 1, z: 1 }

  /** @param {number} v */
  const round2 = (v) => Math.round(v * 100) / 100

  onMount(() => {
    let animId
    const sync = () => {
      animId = requestAnimationFrame(sync)
      const obj = sceneState.selected?.object
      if (!obj || panel?.contains(document.activeElement)) return
      pos.x = round2(obj.position.x)
      pos.y = round2(obj.position.y)
      pos.z = round2(obj.position.z)
      rot.x = round2(obj.rotation.x * RAD2DEG)
      rot.y = round2(obj.rotation.y * RAD2DEG)
      rot.z = round2(obj.rotation.z * RAD2DEG)
      scale.x = round2(obj.scale.x)
      scale.y = round2(obj.scale.y)
      scale.z = round2(obj.scale.z)
    }
    sync()
    return () => cancelAnimationFrame(animId)
  })
</script>

<aside
  bind:this={panel}
  class="ui-container row-span-2 flex-1 min-h-0 overflow-auto pointer-events-auto"
>
  <div class="px-3 flex items-center tracking-wider h-10 border-b">Transform</div>

  <div class="border-b border-black text-xs">
    <div class="px-3 py-1.5">Position</div>
    <div class="flex divide-x divide-black">
      {#each ['x', 'y', 'z'] as axis (axis)}
        <div class="flex-1 px-3 py-1.5">
          <DragInput
            label={axis}
            value={pos[axis]}
            step={0.1}
            onstart={() => {
              startObj = sceneState.selected?.object ?? null
              if (startObj) posStart[axis] = startObj.position[axis]
            }}
            onchange={(v) => {
              pos[axis] = v
              sceneState.selected.object.position[axis] = v
            }}
            onend={(v) => {
              const obj = startObj
              if (!obj) return
              const before = posStart[axis]
              if (before !== v)
                pushCommand({
                  undo: () => {
                    obj.position[axis] = before
                    pos[axis] = round2(before)
                  },
                  redo: () => {
                    obj.position[axis] = v
                    pos[axis] = round2(v)
                  },
                })
            }}
          />
        </div>
      {/each}
    </div>
  </div>

  <div class="border-b border-black text-xs">
    <div class="px-3 py-1.5">Rotation</div>
    <div class="flex divide-x divide-black">
      {#each ['x', 'y', 'z'] as axis (axis)}
        <div class="flex-1 px-3 py-1.5">
          <DragInput
            label={axis}
            value={rot[axis]}
            step={1}
            onstart={() => {
              startObj = sceneState.selected?.object ?? null
              if (startObj) rotStart[axis] = startObj.rotation[axis]
            }}
            onchange={(v) => {
              rot[axis] = v
              sceneState.selected.object.rotation[axis] = v * DEG2RAD
            }}
            onend={(v) => {
              const obj = startObj
              if (!obj) return
              const before = rotStart[axis]
              const after = v * DEG2RAD
              if (before !== after)
                pushCommand({
                  undo: () => {
                    obj.rotation[axis] = before
                    rot[axis] = round2(before * RAD2DEG)
                  },
                  redo: () => {
                    obj.rotation[axis] = after
                    rot[axis] = round2(v)
                  },
                })
            }}
          />
        </div>
      {/each}
    </div>
  </div>

  <div class="border-b border-black text-xs">
    <div class="px-3 py-1.5">Scale</div>
    <div class="flex divide-x divide-black">
      {#each ['x', 'y', 'z'] as axis (axis)}
        <div class="flex-1 px-3 py-1.5">
          <DragInput
            label={axis}
            value={scale[axis]}
            step={0.1}
            onstart={() => {
              startObj = sceneState.selected?.object ?? null
              if (startObj) scaleStart[axis] = startObj.scale[axis]
            }}
            onchange={(v) => {
              scale[axis] = v
              sceneState.selected.object.scale[axis] = v
            }}
            onend={(v) => {
              const obj = startObj
              if (!obj) return
              const before = scaleStart[axis]
              if (before !== v)
                pushCommand({
                  undo: () => {
                    obj.scale[axis] = before
                    scale[axis] = round2(before)
                  },
                  redo: () => {
                    obj.scale[axis] = v
                    scale[axis] = round2(v)
                  },
                })
            }}
          />
        </div>
      {/each}
    </div>
  </div>
</aside>
