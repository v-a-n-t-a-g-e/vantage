<script lang="ts">
  import { onMount } from 'svelte'
  import { SceneEditor } from '@/lib/scene/SceneEditor.ts'
  import { setGetCameraState } from '@/lib/project/projectActions.ts'

  let canvas: HTMLCanvasElement

  onMount(() => {
    const editor = new SceneEditor(canvas)
    setGetCameraState(() => editor.getCameraState())
    return () => {
      setGetCameraState(null)
      editor.dispose()
    }
  })
</script>

<canvas class="w-full h-full block" bind:this={canvas}></canvas>
