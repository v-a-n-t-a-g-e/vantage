<script lang="ts">
  import Logo from '@/lib/Logo.svg'

  let fileOpen = $state(false)
</script>

<nav class="ui-container flex justify-self-start items-center">
  <div class="ui-button text-brand hover:text-white"><Logo /></div>
  <div
    class="relative cursor-pointer select-none ui-button"
    role="button"
    tabindex="0"
    onclick={() => (fileOpen = !fileOpen)}
    onkeydown={(e) => e.key === 'Enter' && (fileOpen = !fileOpen)}
  >
    File
    {#if fileOpen}
      <ul class="absolute top-full left-0 min-w-30 list-none m-0 p-0 z-10">
        <li class="px-2.5 py-1 cursor-pointer">New</li>
        <li class="px-2.5 py-1 cursor-pointer">Open</li>
        <li class="px-2.5 py-1 cursor-pointer">Save</li>
      </ul>
    {/if}
  </div>
  <div class="cursor-pointer select-none ui-button">View</div>
</nav>
