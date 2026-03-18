<script lang="ts">
  import type { MenuItem } from './types.ts'
  import ArrowRight from '@/assets/icons/Arrow-Right.svg'
  import MenuDropdown from './MenuDropdown.svelte'

  interface Props {
    items: MenuItem[]
    anchorName: string
    isSubmenu?: boolean
    onclose: () => void
  }

  let { items, anchorName, isSubmenu = false, onclose }: Props = $props()

  let activeIndex = $state<number | null>(null)
</script>

<div
  style="position-anchor: {anchorName}"
  class="ui-container fixed z-50 flex min-w-40 flex-col"
  class:dropdown={!isSubmenu}
  class:submenu={isSubmenu}
  onclick={(e) => e.stopPropagation()}
  role="presentation"
>
  {#each items as item, i (i)}
    {#if item.options}
      <div
        onmouseenter={() => !item.disabled && (activeIndex = i)}
        onmouseleave={() => (activeIndex = null)}
      >
        <button
          style="anchor-name: {anchorName}-{i}"
          class="ui-button w-full items-center justify-between gap-4"
          class:cursor-pointer={!item.disabled}
          class:opacity-40={item.disabled}
          disabled={item.disabled}
        >
          <span>{item.label}</span>
          <ArrowRight />
        </button>
        {#if activeIndex === i}
          <MenuDropdown
            anchorName="{anchorName}-{i}"
            isSubmenu={true}
            items={item.options}
            {onclose}
          />
        {/if}
      </div>
    {:else}
      <button
        class="ui-button w-full cursor-pointer items-center justify-between gap-4"
        class:opacity-40={item.disabled}
        disabled={item.disabled}
        onclick={() => {
          item.action?.()
          onclose()
        }}
      >
        <span>{item.label}</span>
        {#if item.shortcut}
          <span class="text-xs opacity-40">{item.shortcut}</span>
        {/if}
      </button>
    {/if}
  {/each}
</div>

<style>
  @reference "@/app.css";

  .dropdown {
    position: fixed;
    top: anchor(bottom);
    left: anchor(left);
    position-try-fallbacks: --dropdown-above, --dropdown-right, --dropdown-above-right;
  }

  @position-try --dropdown-above {
    top: auto;
    bottom: anchor(top);
    left: anchor(left);
  }

  @position-try --dropdown-right {
    top: anchor(bottom);
    left: auto;
    right: anchor(right);
  }

  @position-try --dropdown-above-right {
    top: auto;
    bottom: anchor(top);
    left: auto;
    right: anchor(right);
  }

  .submenu {
    position: fixed;
    top: anchor(top);
    left: anchor(right);
    position-try-fallbacks: --submenu-left;
  }

  @position-try --submenu-left {
    top: anchor(top);
    left: auto;
    right: anchor(left);
  }
</style>
