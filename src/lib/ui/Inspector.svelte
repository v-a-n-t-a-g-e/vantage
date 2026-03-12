<script>
  import { onMount } from 'svelte'
  import { sceneState } from '@/lib/sceneState.svelte.js'

  const RAD2DEG = 180 / Math.PI
  const DEG2RAD = Math.PI / 180

  let panel
  let pos = $state({ x: 0, y: 0, z: 0 })
  let rot = $state({ x: 0, y: 0, z: 0 })
  let scale = $state({ x: 1, y: 1, z: 1 })

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

  function setPos(axis) {
    sceneState.selected.object.position[axis] = pos[axis]
  }

  function setRot(axis) {
    sceneState.selected.object.rotation[axis] = rot[axis] * DEG2RAD
  }

  function setScale(axis) {
    sceneState.selected.object.scale[axis] = scale[axis]
  }
</script>

<aside
  bind:this={panel}
  class="ui-container row-span-2 flex-1 min-h-0 overflow-auto pointer-events-auto"
>
  <div class="px-3 flex items-center tracking-wider h-10 border-b">Transform</div>

  <div class="px-3 py-2">
    <div class="opacity-60 mb-1.5">Position</div>
    <div class="flex gap-2">
      {#each ['x', 'y', 'z'] as axis (axis)}
        <label class="flex-1 flex flex-col gap-0.5 text-xs">
          <span class="uppercase opacity-60">{axis}</span>
          <input
            type="number"
            step="0.1"
            bind:value={pos[axis]}
            oninput={() => setPos(axis)}
            class="w-full bg-transparent border-b border-black text-right outline-none py-0.5 tnum"
          />
        </label>
      {/each}
    </div>
  </div>

  <div class="px-3 py-2">
    <div class="opacity-60 mb-1.5">Rotation</div>
    <div class="flex gap-2">
      {#each ['x', 'y', 'z'] as axis (axis)}
        <label class="flex-1 flex flex-col gap-0.5 text-xs">
          <span class="uppercase opacity-60">{axis}</span>
          <input
            type="number"
            step="1"
            bind:value={rot[axis]}
            oninput={() => setRot(axis)}
            class="w-full bg-transparent border-b border-black text-right outline-none py-0.5 tnum"
          />
        </label>
      {/each}
    </div>
  </div>

  <div class="px-3 py-2">
    <div class="opacity-60 mb-1.5">Scale</div>
    <div class="flex gap-2">
      {#each ['x', 'y', 'z'] as axis (axis)}
        <label class="flex-1 flex flex-col gap-0.5 text-xs">
          <span class="uppercase opacity-60">{axis}</span>
          <input
            type="number"
            step="0.1"
            bind:value={scale[axis]}
            oninput={() => setScale(axis)}
            class="w-full bg-transparent border-b border-black text-right outline-none py-0.5 tnum"
          />
        </label>
      {/each}
    </div>
  </div>
</aside>
