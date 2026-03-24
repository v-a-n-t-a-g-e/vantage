<script lang="ts">
  import { onMount } from 'svelte'
  import Interface from '@/lib/Interface.svelte'
  import Renderer from '@/lib/Renderer.svelte'
  import { registerAllShortcuts } from '@/lib/shortcutRegistry.ts'
  import { projectState } from '@/lib/project/projectState.svelte.ts'
  import { loadRecentProjects, autoLoadLastProject } from '@/lib/project/projectActions.ts'

  onMount(() => {
    const cleanup = registerAllShortcuts()

    loadRecentProjects().then(() => autoLoadLastProject())

    return cleanup
  })

  $effect(() => {
    document.title = projectState.projectName
      ? `${projectState.dirty ? '* ' : ''}${projectState.projectName} - Vantage`
      : 'Vantage'
  })

  $effect(() => {
    if (projectState.dirty) {
      const handler = (e: BeforeUnloadEvent) => {
        e.preventDefault()
      }
      window.addEventListener('beforeunload', handler)
      return () => window.removeEventListener('beforeunload', handler)
    }
  })
</script>

<main class="relative h-screen w-screen overflow-hidden">
  <Renderer />
  <Interface />
</main>
