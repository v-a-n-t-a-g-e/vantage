<script lang="ts">
  import { tick } from 'svelte'

  interface Props {
    value: number
    step?: number
    precision?: number
    label?: string
    axis?: string
    onchange: (_v: number) => void
    onstart?: () => void
    onend?: (_v: number) => void
  }

  let {
    value,
    step = 1,
    precision = 2,
    label = '',
    axis,
    onchange,
    onstart,
    onend,
  }: Props = $props()

  let inputEl = $state<HTMLInputElement | null>(null)
  let editing = $state(false)
  let editValue = $state(0)

  let dragging = false
  let currentValue = 0
  let accumulated = 0

  const fmt = (v: number) => v.toFixed(precision)

  function onpointerdown(e: PointerEvent & { currentTarget: HTMLElement }) {
    if (e.button !== 0) return
    e.currentTarget.setPointerCapture(e.pointerId)
    currentValue = value
    accumulated = 0
    dragging = true
    document.body.style.cursor = 'ew-resize'
    onstart?.()
  }

  function onpointermove(e: PointerEvent) {
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
      onstart?.()
      await tick()
      inputEl?.focus()
      inputEl?.select()
    } else {
      onend?.(value)
    }
  }

  function commit() {
    if (!editing) return
    const n = parseFloat(String(editValue))
    if (!isNaN(n)) {
      onchange(n)
      onend?.(n)
    }
    editing = false
  }

  function onkeydown(e: KeyboardEvent & { currentTarget: HTMLInputElement }) {
    if (e.key === 'Enter') e.currentTarget.blur()
    if (e.key === 'Escape') {
      editing = false
      e.currentTarget.blur()
    }
    if ((e.metaKey || e.ctrlKey) && (e.key === 'z' || e.key === 'y')) e.currentTarget.blur()
  }
</script>

<div class="relative flex flex-col">
  <div class="flex justify-between items-center flex-row gap-2">
    <span class="capitalize opacity-50">{label}</span>
    <div class="bg-current w-full h-px" style="background: var(--color-axis-{axis})"></div>
  </div>

  <span
    tabindex="-1"
    role="spinbutton"
    {onpointerdown}
    {onpointermove}
    {onpointerup}
    onkeydown={async (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        editValue = value
        editing = true
        onstart?.()
        await tick()
        inputEl?.focus()
        inputEl?.select()
      }
    }}
    class="flex items-center gap-1.5 w-full cursor-ew-resize select-none tnum"
    class:invisible={editing}
  >
    <span class="flex-1 text-right">{fmt(value)}</span>
  </span>

  <div class="absolute inset-0 flex items-center gap-1.5 tnum" class:pointer-events-none={!editing}>
    <input
      bind:this={inputEl}
      bind:value={editValue}
      type="number"
      onfocus={() => {
        if (!editing) {
          editValue = value
          editing = true
          onstart?.()
        }
      }}
      onblur={commit}
      {onkeydown}
      oninput={() => {
        const n = parseFloat(String(editValue))
        if (!isNaN(n)) onchange(n)
      }}
      class="flex-1 min-w-0 bg-transparent text-right outline-none"
      class:opacity-0={!editing}
    />
  </div>
</div>

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
