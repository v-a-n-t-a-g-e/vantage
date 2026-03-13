<script lang="ts">
  import { onMount } from 'svelte'
  import Interface from '@/lib/Interface.svelte'
  import Renderer from '@/lib/Renderer.svelte'
  import { undo, redo } from '@/lib/history.svelte.ts'
  import { sceneState } from '@/lib/sceneState.svelte.ts'
  import { registerShortcuts } from '@/lib/shortcuts.ts'

  onMount(() => registerShortcuts([
    { key: 'z', meta: true,              action: undo },
    { key: 'z', meta: true, shift: true, action: redo },
    { key: 'y', meta: true,              action: redo },
    { key: 'Escape',                     action: () => { sceneState.selected = null } },
  ]))
</script>

<main class="relative w-screen h-screen overflow-hidden">
  <Renderer />
  <Interface />
</main>
