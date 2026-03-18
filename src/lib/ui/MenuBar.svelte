<script lang="ts">
  import Logo from '@/assets/icons/Vantage.svg'
  import { projectState } from '@/lib/project/projectState.svelte.ts'
  import { saveProject, openProject, newProject } from '@/lib/project/projectActions.ts'
  import MenuDropdown from './menu/MenuDropdown.svelte'
  import type { MenuItem } from './menu/types.ts'

  let activeMenu = $state<number | null>(null)

  function close() {
    activeMenu = null
  }

  const menus: { label: string; options: MenuItem[] }[] = [
    {
      label: 'File',
      options: [
        { label: 'New', shortcut: 'Cmd+N', action: newProject },
        { label: 'Open', shortcut: 'Cmd+O', action: openProject },
        { label: 'Save', shortcut: 'Cmd+S', action: saveProject },
        {
          label: 'Examples',
          options: [
            { label: 'Example 1', action: () => console.log('load example 1') },
            { label: 'Example 2', action: () => console.log('load example 2') },
          ],
        },
      ],
    },
    {
      label: 'View',
      options: [],
    },
  ]
</script>

<svelte:window onclick={close} />

<nav class="ui-container flex items-center justify-self-start">
  <div class="ui-button"><Logo /></div>

  {#each menus as menu, i (menu.label)}
    <div
      style="anchor-name: --menu-{i}"
      class="ui-button relative cursor-pointer select-none"
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
