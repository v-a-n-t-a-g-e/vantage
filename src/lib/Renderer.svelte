<script lang="ts">
  import { onMount } from 'svelte'
  import { SceneEditor } from '@/lib/scene/SceneEditor.ts'

  let canvas: HTMLCanvasElement

  onMount(() => {
    const editor = new SceneEditor(canvas)
    return () => editor.dispose()
  })
</script>

<canvas class="w-full h-full block" bind:this={canvas}></canvas>
