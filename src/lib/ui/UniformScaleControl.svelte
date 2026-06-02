<script lang="ts">
  import type { Object3D } from 'three'
  import { pushCommand } from '@/lib/history.svelte.ts'
  import { sceneState } from '@/lib/sceneState.svelte.ts'
  import DragInput from '@/lib/ui/DragInput.svelte'

  interface Props {
    object: Object3D
    step?: number
  }

  let { object, step = 0.01 }: Props = $props()

  // SplatMesh only honors uniform scale, so a single factor drives all axes.
  let value = $state(1)
  let start = 1

  $effect(() => {
    sceneState.transformRevision // subscribe to external transform changes
    if (!object) return
    value = object.scale.x
  })

  function onstart() {
    start = object.scale.x
  }

  function onchange(v: number) {
    value = v
    object.scale.setScalar(v)
  }

  function onend(v: number) {
    const before = start
    if (before === v) return
    pushCommand({
      undo: () => {
        object.scale.setScalar(before)
        value = before
      },
      redo: () => {
        object.scale.setScalar(v)
        value = v
      },
    })
  }
</script>

<div class="border-b border-black text-xs">
  <div class="px-3 py-1.5">Scale</div>
  <div class="flex divide-x">
    <div class="flex-1 px-3 py-1.5">
      <DragInput label="uniform" {onchange} {onend} {onstart} {step} {value} />
    </div>
  </div>
</div>
