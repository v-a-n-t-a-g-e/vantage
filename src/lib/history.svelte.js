/** @typedef {{ undo: () => void, redo: () => void }} Command */

const state = $state({ past: /** @type {Command[]} */ ([]), future: /** @type {Command[]} */ ([]) })

/** @param {Command} cmd */
export function pushCommand(cmd) {
  if (state.past.length >= 100) state.past.shift()
  state.past.push(cmd)
  state.future = []
}

export function undo() {
  const cmd = state.past.pop()
  if (cmd) { cmd.undo(); state.future.push(cmd) }
}

export function redo() {
  const cmd = state.future.pop()
  if (cmd) { cmd.redo(); state.past.push(cmd) }
}
