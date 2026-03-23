<script lang="ts">
  import Logo from '@/assets/icons/Vantage.svg'
  import { projectState } from '@/lib/project/projectState.svelte.ts'
  import {
    saveProject,
    openProject,
    newProject,
    openRecentProject,
    exampleProjects,
    loadDemoProject,
  } from '@/lib/project/projectActions.ts'
  import {
    toggleSelectedVisibility,
    toggleSelectedLock,
    renameSelected,
  } from '@/lib/editActions.ts'
  import { sceneState } from '@/lib/sceneState.svelte.ts'
  import MenuDropdown from './menu/MenuDropdown.svelte'
  import type { MenuItem } from './menu/types.ts'

  let activeMenu = $state<number | null>(null)

  function close() {
    activeMenu = null
  }

  const fileOptions = $derived<MenuItem[]>([
    { label: 'New', shortcut: 'Cmd+N', action: newProject },
    { label: 'Open', shortcut: 'Cmd+O', action: openProject },
    {
      label: 'Open Recent',
      disabled: projectState.recentProjects.length === 0,
      options: projectState.recentProjects.map((p) => ({
        label: p.name,
        action: () => openRecentProject(p.handle),
      })),
    },
    {
      label: 'Examples',
      options: exampleProjects.map((ex) => ({
        label: ex.label,
        action: () => loadDemoProject(ex.basePath),
      })),
    },
    { label: 'Save', shortcut: 'Cmd+S', action: saveProject },
  ])

  const editOptions = $derived<MenuItem[]>([
    {
      label: 'Rename',
      disabled: sceneState.selected === null,
      action: renameSelected,
    },
    {
      label: sceneState.selected?.visible === false ? 'Show' : 'Hide',
      shortcut: 'Cmd+H',
      disabled: sceneState.selected === null,
      action: toggleSelectedVisibility,
    },
    {
      label: sceneState.selected?.locked ? 'Unlock' : 'Lock',
      shortcut: 'Cmd+L',
      disabled: sceneState.selected === null,
      action: toggleSelectedLock,
    },
  ])

  const menus = $derived<{ label: string; options: MenuItem[] }[]>([
    { label: 'File', options: fileOptions },
    { label: 'Edit', options: editOptions },
    { label: 'View', options: [] },
  ])
</script>

<svelte:window onclick={close} />

<nav class="ui-container flex items-center justify-self-start">
  <div class="ui-button"><Logo /></div>

  {#each menus as menu, i (menu.label)}
    <div
      style="anchor-name: --menu-{i}"
      class="relative ui-button cursor-pointer select-none"
      class:dirty={i === 0 && projectState.dirty}
      onclick={(e) => {
        e.stopPropagation()
        activeMenu = activeMenu === i ? null : i
      }}
      onkeydown={(e) => e.key === 'Enter' && (activeMenu = activeMenu === i ? null : i)}
      role="button"
      tabindex="0"
    >
      {menu.label}
      {#if activeMenu === i && menu.options.length > 0}
        <MenuDropdown anchorName="--menu-{i}" items={menu.options} onclose={close} />
      {/if}
    </div>
  {/each}
</nav>

<style>
  @reference "@/app.css";

  .dirty {
    @apply after:absolute after:right-1.5 after:h-1 after:w-1 after:-translate-y-1 after:rounded-full after:bg-brand after:content-[''];
  }
</style>
