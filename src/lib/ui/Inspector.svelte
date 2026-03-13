<script lang="ts">
  import { sceneState, sceneActions } from '@/lib/sceneState.svelte.ts'
  import Vec3Controls from '@/lib/ui/Vec3Controls.svelte'
</script>

<aside class="ui-container row-span-2 flex-1 min-h-0 overflow-auto pointer-events-auto">
  <div class="px-3 flex items-center tracking-wider h-10 border-b">Transform</div>
  <Vec3Controls
    title="Position"
    object={sceneState.selected?.object}
    prop="position"
    labels={['x', 'y', 'elevation']}
    step={0.1}
  />
  <Vec3Controls
    title="Rotation"
    object={sceneState.selected?.object}
    prop="rotation"
    labels={['pitch', 'yaw', 'roll']}
    step={1}
    toDisplay={(v) => v * (180 / Math.PI)}
    fromDisplay={(v) => v * (Math.PI / 180)}
  />
  <Vec3Controls
    title="Scale"
    object={sceneState.selected?.object}
    prop="scale"
    labels={['x', 'y', 'z']}
    step={0.1}
  />
  <button
    class="ui-button w-full border-t text-red-400"
    onclick={() => sceneActions.value?.removeObject(sceneState.selected!)}
  >Delete</button>
</aside>
