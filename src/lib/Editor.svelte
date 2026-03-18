<script lang="ts">
  import { onMount } from 'svelte'
  import Interface from '@/lib/Interface.svelte'
  import Renderer from '@/lib/Renderer.svelte'
  import { undo, redo } from '@/lib/history.svelte.ts'
  import { sceneState } from '@/lib/sceneState.svelte.ts'
  import { registerShortcuts } from '@/lib/shortcuts.ts'
  import { projectState } from '@/lib/project/projectState.svelte.ts'
  import {
    saveProject,
    openProject,
    newProject,
    loadRecentProjects,
    autoLoadLastProject,
  } from '@/lib/project/projectActions.ts'

  onMount(async () => {
    const cleanup = registerShortcuts([
      { key: 'z', meta: true, action: undo },
      { key: 'z', meta: true, shift: true, action: redo },
      { key: 'y', meta: true, action: redo },
      {
        key: 'Escape',
        action: () => {
          sceneState.selected = null
        },
      },
      {
        key: 's',
        meta: true,
        action: () => {
          saveProject()
        },
      },
      {
        key: 'o',
        meta: true,
        action: () => {
          openProject()
        },
      },
      {
        key: 'n',
        meta: true,
        action: () => {
          newProject()
        },
      },
    ])

    await loadRecentProjects()
    await autoLoadLastProject()

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

<main class="relative w-screen h-screen overflow-hidden">
  <Renderer />
  <Interface />
</main>
