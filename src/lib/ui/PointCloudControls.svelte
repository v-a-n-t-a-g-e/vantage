<script lang="ts">
  import type { Points, PointsMaterial } from 'three'
  import { pushCommand } from '@/lib/history.svelte.ts'
  import { sceneState } from '@/lib/sceneState.svelte.ts'
  import type { SceneObject } from '@/lib/types.ts'
  import DragInput from '@/lib/ui/DragInput.svelte'

  interface Props {
    item: SceneObject
  }

  let { item }: Props = $props()

  const material = $derived((item.object as Points).material as PointsMaterial)

  let size = $state(1)
  let attenuation = $state(false)
  let startSize = 1

  $effect(() => {
    sceneState.transformRevision // subscribe to external changes
    size = material.size
    attenuation = material.sizeAttenuation
  })

  function applySize(v: number) {
    size = v
    material.size = v
    if (item.display) item.display.pointSize = v
  }

  function onstart() {
    startSize = material.size
  }

  function onchange(v: number) {
    applySize(v)
  }

  function onend(v: number) {
    const before = startSize
    if (before === v) return
    pushCommand({
      undo: () => applySize(before),
      redo: () => applySize(v),
    })
  }

  function applyAttenuation(v: boolean) {
    attenuation = v
    material.sizeAttenuation = v
    material.needsUpdate = true // sizeAttenuation is a shader define
    if (item.display) item.display.sizeAttenuation = v
  }

  function toggleAttenuation(e: Event) {
    const was = material.sizeAttenuation
    const now = (e.target as HTMLInputElement).checked
    applyAttenuation(now)
    pushCommand({
      undo: () => applyAttenuation(was),
      redo: () => applyAttenuation(now),
    })
  }
</script>

<div class="border-b border-black text-xs">
  <div class="px-3 py-1.5">Point Cloud</div>
  <div class="flex divide-x">
    <div class="flex-1 px-3 py-1.5">
      <DragInput label="size" {onchange} {onend} {onstart} step={0.1} value={size} />
    </div>
  </div>
</div>
<label class="ui-button w-full gap-3">
  <input checked={attenuation} onchange={toggleAttenuation} type="checkbox" />
  Size Attenuation
</label>
