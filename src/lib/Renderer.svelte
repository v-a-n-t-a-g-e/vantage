<script lang="ts">
  import { onMount } from 'svelte'
  import { SceneEditor } from '@/lib/scene/SceneEditor.ts'
  import { setGetCameraState } from '@/lib/project/projectActions.ts'

  let canvas: HTMLCanvasElement

  onMount(() => {
    const editor = new SceneEditor(canvas)
    setGetCameraState(() => editor.getEditorCameraState())
    return () => {
      setGetCameraState(null)
      editor.dispose()
    }
  })
</script>

<canvas bind:this={canvas} class="block h-full w-full"></canvas>
