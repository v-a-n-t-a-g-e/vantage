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

<nav class="ui-container flex justify-self-start items-center">
  <div class="ui-button"><Logo /></div>
  <div
    class="relative cursor-pointer select-none ui-button"
    role="button"
    tabindex="0"
    onclick={(e) => {
      e.stopPropagation()
      fileOpen = !fileOpen
    }}
    onkeydown={(e) => e.key === 'Enter' && (fileOpen = !fileOpen)}
  >
    File
    {#if projectState.dirty}
      <span class="text-brand ml-0.5">*</span>
    {/if}
    {#if fileOpen}
      <div class="absolute ui-container top-full left-0 min-w-40 z-10 flex flex-col">
        <button
          class="ui-button cursor-pointer flex justify-between items-center text-left"
          onclick={handleNew}
        >
          <span>New</span>
          <span class="opacity-40 text-xs ml-4">Cmd+N</span>
        </button>
        <button
          class="ui-button cursor-pointer flex justify-between items-center text-left"
          onclick={handleOpen}
        >
          <span>Open</span>
          <span class="opacity-40 text-xs ml-4">Cmd+O</span>
        </button>
        <button
          class="ui-button cursor-pointer flex justify-between items-center text-left"
          onclick={handleSave}
        >
          <span>Save</span>
          <span class="opacity-40 text-xs ml-4">Cmd+S</span>
        </button>
      </div>
    {/if}
  </div>
  <div class="cursor-pointer select-none ui-button">View</div>
</nav>
