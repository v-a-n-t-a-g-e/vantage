<script lang="ts">
  import Logo from '@/assets/icons/Vantage.svg'
  import { projectState } from '@/lib/project/projectState.svelte.ts'
  import { saveProject, openProject, newProject } from '@/lib/project/projectActions.ts'

  let fileOpen = $state(false)

  async function handleNew() {
    await newProject()
  }

  async function handleOpen() {
    await openProject()
  }

  async function handleSave() {
    await saveProject()
  }
</script>

<svelte:window
  onclick={() => {
    if (fileOpen) fileOpen = false
  }}
/>

<nav class="ui-container flex items-center justify-self-start">
  <div class="ui-button"><Logo /></div>
  <div
    class="relative ui-button cursor-pointer select-none"
    onclick={(e) => {
      e.stopPropagation()
      fileOpen = !fileOpen
    }}
    onkeydown={(e) => e.key === 'Enter' && (fileOpen = !fileOpen)}
    role="button"
    tabindex="0"
  >
    File
    {#if projectState.dirty}
      <span class="ml-0.5 text-brand">*</span>
    {/if}
    {#if fileOpen}
      <div class="ui-container absolute top-full left-0 z-10 flex min-w-40 flex-col">
        <button
          class="ui-button flex cursor-pointer items-center justify-between text-left"
          onclick={handleNew}
        >
          <span>New</span>
          <span class="ml-4 text-xs opacity-40">Cmd+N</span>
        </button>
        <button
          class="ui-button flex cursor-pointer items-center justify-between text-left"
          onclick={handleOpen}
        >
          <span>Open</span>
          <span class="ml-4 text-xs opacity-40">Cmd+O</span>
        </button>
        <button
          class="ui-button flex cursor-pointer items-center justify-between text-left"
          onclick={handleSave}
        >
          <span>Save</span>
          <span class="ml-4 text-xs opacity-40">Cmd+S</span>
        </button>
      </div>
    {/if}
  </div>
  <div class="ui-button cursor-pointer select-none">View</div>
</nav>
