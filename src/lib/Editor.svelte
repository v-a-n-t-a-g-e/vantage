<script lang="ts">
  import { onMount } from 'svelte'
  import Interface from '@/lib/Interface.svelte'
  import Renderer from '@/lib/Renderer.svelte'
  import { undo, redo } from '@/lib/history.svelte.ts'
  import { sceneState } from '@/lib/sceneState.svelte.ts'
  import { registerShortcuts } from '@/lib/shortcuts.ts'
  import { projectState } from '@/lib/project/projectState.svelte.ts'
  import { saveProject, openProject, newProject, resumeProject, checkForStoredProject } from '@/lib/project/projectActions.ts'

  let resumeHandle: FileSystemDirectoryHandle | null = $state(null)
  let showResume = $state(false)

  onMount(() => {
    const cleanup = registerShortcuts([
      { key: 'z', meta: true,              action: undo },
      { key: 'z', meta: true, shift: true, action: redo },
      { key: 'y', meta: true,              action: redo },
      { key: 'Escape',                     action: () => { sceneState.selected = null } },
      { key: 's', meta: true,              action: () => { saveProject() } },
      { key: 'o', meta: true,              action: () => { openProject() } },
      { key: 'n', meta: true,              action: () => { newProject() } },
    ])

    checkForStoredProject().then((handle) => {
      if (handle) {
        resumeHandle = handle
        showResume = true
      }
    })

    return cleanup
  })

  $effect(() => {
    document.title = projectState.projectName
      ? `${projectState.dirty ? '* ' : ''}${projectState.projectName} - Vantage`
      : 'Vantage'
  })

  $effect(() => {
    if (projectState.dirty) {
      const handler = (e: BeforeUnloadEvent) => { e.preventDefault() }
      window.addEventListener('beforeunload', handler)
      return () => window.removeEventListener('beforeunload', handler)
    }
  })

  async function handleResume() {
    if (!resumeHandle) return
    showResume = false
    try {
      await resumeProject(resumeHandle)
    } catch {
      // Permission denied or load error
    }
    resumeHandle = null
  }

  function dismissResume() {
    showResume = false
    resumeHandle = null
  }
</script>

<main class="relative w-screen h-screen overflow-hidden">
  <Renderer />
  <Interface />

  {#if showResume}
    <div class="absolute top-12 left-1/2 -translate-x-1/2 z-50 ui-container flex items-center gap-3 px-4 py-2">
      <span class="text-sm">Resume <strong>{resumeHandle?.name}</strong>?</span>
      <button class="ui-button px-3 py-1 text-sm bg-brand text-white" onclick={handleResume}>Resume</button>
      <button class="ui-button px-3 py-1 text-sm" onclick={dismissResume}>Dismiss</button>
    </div>
  {/if}
</main>
