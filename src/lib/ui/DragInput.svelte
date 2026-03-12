<script>
  import { tick } from 'svelte'

  /** @type {{ value: number, step?: number, onchange: (v: number) => void }} */
  let { value, step = 1, onchange } = $props()

  let editing = $state(false)
  let editValue = $state(0)
  let inputEl = $state(null)

  let dragging = false
  let currentValue = 0
  let accumulated = 0

  const fmt = (v) => String(parseFloat(v.toFixed(2)))

  /** @param {PointerEvent & { currentTarget: HTMLElement }} e */
  function onpointerdown(e) {
    if (e.button !== 0) return
    e.currentTarget.setPointerCapture(e.pointerId)
    currentValue = value
    accumulated = 0
    dragging = true
    document.body.style.cursor = 'ew-resize'
  }

  /** @param {PointerEvent} e */
  function onpointermove(e) {
    if (!dragging) return
    accumulated += Math.abs(e.movementX)
    const multiplier = e.shiftKey ? 10 : e.altKey ? 0.1 : 1
    currentValue += e.movementX * step * multiplier
    onchange(parseFloat(currentValue.toFixed(10)))
  }

  async function onpointerup() {
    if (!dragging) return
    dragging = false
    document.body.style.cursor = ''
    if (accumulated < 3) {
      editValue = value
      editing = true
      await tick()
      inputEl?.select()
    }
  }

  function commit() {
    const n = parseFloat(String(editValue))
    if (!isNaN(n)) onchange(n)
    editing = false
  }

  /** @param {KeyboardEvent & { currentTarget: HTMLElement }} e */
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
    {onkeydown}
    class="w-full bg-transparent border-b border-black text-right outline-none py-0.5 tnum"
  />
{:else}
  <span
    role="spinbutton"
    aria-valuenow={value}
    tabindex="0"
    {onpointerdown}
    {onpointermove}
    {onpointerup}
    onkeydown={(e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        editValue = value
        editing = true
      }
    }}
    class="block w-full text-right py-0.5 border-b border-black cursor-ew-resize select-none tnum"
    >{fmt(value)}</span
  >
{/if}

<style>
  input[type='number']::-webkit-inner-spin-button,
  input[type='number']::-webkit-outer-spin-button {
    -webkit-appearance: none;
  }
  input[type='number'] {
    -moz-appearance: textfield;
    appearance: textfield;
  }
</style>
