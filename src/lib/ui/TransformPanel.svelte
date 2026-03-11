<script>
  import { sceneState } from '@/lib/sceneState.svelte.js'

  let pos = $state({ x: 0, y: 0, z: 0 })
  let rot = $state({ x: 0, y: 0, z: 0 })
  let scale = $state({ x: 1, y: 1, z: 1 })

  $effect(() => {
    const obj = sceneState.selected?.object
    if (!obj) return
    pos = { x: obj.position.x, y: obj.position.y, z: obj.position.z }
    rot = { x: obj.rotation.x, y: obj.rotation.y, z: obj.rotation.z }
    scale = { x: obj.scale.x, y: obj.scale.y, z: obj.scale.z }
  })

  function setPos(axis) {
    sceneState.selected.object.position[axis] = pos[axis]
  }

  function setRot(axis) {
    sceneState.selected.object.rotation[axis] = rot[axis]
  }

  function setScale(axis) {
    sceneState.selected.object.scale[axis] = scale[axis]
  }
</script>

<aside class="col-start-3 row-start-2 pointer-events-auto min-w-40">
  <div class="px-2 py-1 text-xs font-bold uppercase tracking-wider opacity-60">Transform</div>

  <div class="px-2 pb-1">
    <div class="text-xs opacity-60 mb-0.5">Position</div>
    {#each ['x', 'y', 'z'] as axis (axis)}
      <label class="flex items-center gap-1 text-xs">
        <span class="w-3 uppercase">{axis}</span>
        <input
          type="number"
          step="0.1"
          bind:value={pos[axis]}
          oninput={() => setPos(axis)}
          class="w-full bg-transparent border-b border-white/20 text-right outline-none py-0.5"
        />
      </label>
    {/each}
  </div>

  <div class="px-2 pb-1">
    <div class="text-xs opacity-60 mb-0.5">Rotation (rad)</div>
    {#each ['x', 'y', 'z'] as axis (axis)}
      <label class="flex items-center gap-1 text-xs">
        <span class="w-3 uppercase">{axis}</span>
        <input
          type="number"
          step="0.01"
          bind:value={rot[axis]}
          oninput={() => setRot(axis)}
          class="w-full bg-transparent border-b border-white/20 text-right outline-none py-0.5"
        />
      </label>
    {/each}
  </div>

  <div class="px-2 pb-1">
    <div class="text-xs opacity-60 mb-0.5">Scale</div>
    {#each ['x', 'y', 'z'] as axis (axis)}
      <label class="flex items-center gap-1 text-xs">
        <span class="w-3 uppercase">{axis}</span>
        <input
          type="number"
          step="0.1"
          bind:value={scale[axis]}
          oninput={() => setScale(axis)}
          class="w-full bg-transparent border-b border-white/20 text-right outline-none py-0.5"
        />
      </label>
    {/each}
  </div>
</aside>
