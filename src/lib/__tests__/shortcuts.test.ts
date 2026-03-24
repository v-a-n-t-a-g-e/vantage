import { describe, it, expect, vi, afterEach } from 'vitest'
import { registerShortcuts } from '@/lib/shortcuts.ts'

function fireKey(
  key: string,
  opts: { metaKey?: boolean; ctrlKey?: boolean; shiftKey?: boolean; altKey?: boolean } = {}
) {
  const event = new KeyboardEvent('keydown', {
    key,
    metaKey: opts.metaKey ?? false,
    ctrlKey: opts.ctrlKey ?? false,
    shiftKey: opts.shiftKey ?? false,
    altKey: opts.altKey ?? false,
    bubbles: true,
    cancelable: true,
  })
  window.dispatchEvent(event)
  return event
}

describe('registerShortcuts', () => {
  let cleanup: () => void

  afterEach(() => {
    cleanup?.()
  })

  it('fires action on matching key', () => {
    const action = vi.fn()
    cleanup = registerShortcuts([{ key: 'a', action }])

    fireKey('a')
    expect(action).toHaveBeenCalledOnce()
  })

  it('does not fire on non-matching key', () => {
    const action = vi.fn()
    cleanup = registerShortcuts([{ key: 'a', action }])

    fireKey('b')
    expect(action).not.toHaveBeenCalled()
  })

  it('matches meta key (Cmd/Ctrl)', () => {
    const action = vi.fn()
    cleanup = registerShortcuts([{ key: 's', meta: true, action }])

    // Without meta — should not fire
    fireKey('s')
    expect(action).not.toHaveBeenCalled()

    // With meta — should fire
    fireKey('s', { metaKey: true })
    expect(action).toHaveBeenCalledOnce()
  })

  it('matches ctrlKey as meta alternative', () => {
    const action = vi.fn()
    cleanup = registerShortcuts([{ key: 's', meta: true, action }])

    fireKey('s', { ctrlKey: true })
    expect(action).toHaveBeenCalledOnce()
  })

  it('matches shift modifier', () => {
    const action = vi.fn()
    cleanup = registerShortcuts([{ key: 'z', meta: true, shift: true, action }])

    fireKey('z', { metaKey: true })
    expect(action).not.toHaveBeenCalled()

    fireKey('z', { metaKey: true, shiftKey: true })
    expect(action).toHaveBeenCalledOnce()
  })

  it('matches alt modifier', () => {
    const action = vi.fn()
    cleanup = registerShortcuts([{ key: 'x', alt: true, action }])

    fireKey('x')
    expect(action).not.toHaveBeenCalled()

    fireKey('x', { altKey: true })
    expect(action).toHaveBeenCalledOnce()
  })

  it('is case-insensitive', () => {
    const action = vi.fn()
    cleanup = registerShortcuts([{ key: 'a', action }])

    fireKey('A')
    expect(action).toHaveBeenCalledOnce()
  })

  it('cleanup removes the listener', () => {
    const action = vi.fn()
    cleanup = registerShortcuts([{ key: 'a', action }])

    cleanup()
    fireKey('a')
    expect(action).not.toHaveBeenCalled()
  })

  it('skips shortcuts when focus is in an input', () => {
    const action = vi.fn()
    cleanup = registerShortcuts([{ key: 'a', action }])

    const input = document.createElement('input')
    document.body.appendChild(input)
    input.focus()

    // Dispatch on the input element
    const event = new KeyboardEvent('keydown', {
      key: 'a',
      bubbles: true,
      cancelable: true,
    })
    input.dispatchEvent(event)

    // Action should not fire because target is an input
    expect(action).not.toHaveBeenCalled()
    document.body.removeChild(input)
  })
})
