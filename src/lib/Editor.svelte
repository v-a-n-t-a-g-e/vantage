<script lang="ts">
  import Interface from '@/lib/Interface.svelte'
  import Renderer from '@/lib/Renderer.svelte'
  import { undo, redo } from '@/lib/history.svelte.ts'
</script>

<svelte:window
  onkeydown={(e) => {
    if (!(e.metaKey || e.ctrlKey)) return
    if (e.key === 'z') {
      e.preventDefault()
      e.shiftKey ? redo() : undo()
    }
    if (e.key === 'y') {
      e.preventDefault()
      redo()
    }
  }}
/>

<main class="relative w-screen h-screen overflow-hidden">
  <Renderer />
  <Interface />
</main>
