import { projectState } from '@/lib/project/projectState.svelte.ts'

type Command = { undo: () => void; redo: () => void }

const state = $state({ past: [] as Command[], future: [] as Command[] })

export function pushCommand(cmd: Command) {
  if (state.past.length >= 100) state.past.shift()
  state.past.push(cmd)
  state.future = []
  projectState.dirty = true
}

export function undo() {
  const cmd = state.past.pop()
  if (cmd) {
    cmd.undo()
    state.future.push(cmd)
    projectState.dirty = true
  }
}

export function redo() {
  const cmd = state.future.pop()
  if (cmd) {
    cmd.redo()
    state.past.push(cmd)
    projectState.dirty = true
  }
}

export function clearHistory() {
  state.past = []
  state.future = []
}
