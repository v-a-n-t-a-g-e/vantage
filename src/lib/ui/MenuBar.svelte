<script>
  let fileOpen = $state(false)
</script>

<nav class="flex pointer-events-auto col-start-1 row-start-1">
  <div
    class="relative px-2.5 py-1 cursor-pointer select-none"
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
  <div class="px-2.5 py-1 cursor-pointer select-none">View</div>
</nav>
