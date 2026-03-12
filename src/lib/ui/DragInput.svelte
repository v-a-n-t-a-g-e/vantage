<script>
  import { tick } from 'svelte'

  /** @type {{ value: number, step?: number, onchange: (v: number) => void }} */
  let { value, step = 1, onchange } = $props()

  let editing = $state(false)
  let editValue = $state(0)
  let inputEl = $state(null)
  let spanEl = $state(null)

  let currentValue = 0
  let accumulated = 0

  const fmt = (v) => String(parseFloat(v.toFixed(2)))

  function onpointerdown(e) {
    if (e.button !== 0) return
    currentValue = value
    accumulated = 0
    spanEl.requestPointerLock()
    document.addEventListener('mousemove', onDocMouseMove)
    document.addEventListener('mouseup', onDocMouseUp)
  }

  /** @param {MouseEvent} e */
  function onDocMouseMove(e) {
    accumulated += Math.abs(e.movementX)
    const multiplier = e.shiftKey ? 10 : e.altKey ? 0.1 : 1
    currentValue += e.movementX * step * multiplier
    onchange(parseFloat(currentValue.toFixed(10)))
  }

  function onDocMouseUp() {
    document.removeEventListener('mousemove', onDocMouseMove)
    document.removeEventListener('mouseup', onDocMouseUp)
    document.exitPointerLock()
    if (accumulated < 3) {
      editValue = value
      editing = true
      tick().then(() => inputEl?.select())
    }
  }

  function commit() {
    const n = parseFloat(String(editValue))
    if (!isNaN(n)) onchange(n)
    editing = false
  }

  function onkeydown(e) {
    if (e.key === 'Enter') e.currentTarget.blur()
    if (e.key === 'Escape') editing = false
  }
</script>

{#if editing}
  <input
    bind:this={inputEl}
    bind:value={editValue}
    type="number"
    onblur={commit}
    onkeydown={onkeydown}
    class="w-full bg-transparent border-b border-black text-right outline-none py-0.5 tnum"
  />
{:else}
  <span
    bind:this={spanEl}
    role="spinbutton"
    aria-valuenow={value}
    tabindex="0"
    onpointerdown={onpointerdown}
    onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { editValue = value; editing = true } }}
    class="block w-full text-right py-0.5 border-b border-black cursor-ew-resize select-none tnum"
  >{fmt(value)}</span>
{/if}
