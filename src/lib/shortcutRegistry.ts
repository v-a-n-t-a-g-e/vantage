import { undo, redo } from '@/lib/history.svelte.ts'
import { sceneState } from '@/lib/sceneState.svelte.ts'
import { toggleSelectedVisibility, toggleSelectedLock } from '@/lib/editActions.ts'
import { saveProject, openProject, newProject } from '@/lib/project/projectActions.ts'
import { registerShortcuts } from '@/lib/shortcuts.ts'

/**
 * Centralized shortcut definitions. Each entry describes the key binding,
 * human-readable label (for future help/cheatsheet), and action.
 */
export const SHORTCUT_DEFS = [
  { id: 'undo', key: 'z', meta: true, label: 'Undo', action: undo },
  { id: 'redo', key: 'z', meta: true, shift: true, label: 'Redo', action: redo },
  { id: 'redo-alt', key: 'y', meta: true, label: 'Redo (alt)', action: redo },
  {
    id: 'deselect',
    key: 'Escape',
    label: 'Deselect',
    action: () => { sceneState.selected = null },
  },
  { id: 'save', key: 's', meta: true, label: 'Save', action: () => { saveProject() } },
  { id: 'open', key: 'o', meta: true, label: 'Open', action: () => { openProject() } },
  { id: 'new', key: 'n', meta: true, label: 'New Project', action: () => { newProject() } },
  {
    id: 'toggle-visibility',
    key: 'h',
    meta: true,
    label: 'Toggle Visibility',
    action: toggleSelectedVisibility,
  },
  {
    id: 'toggle-lock',
    key: 'l',
    meta: true,
    label: 'Toggle Lock',
    action: toggleSelectedLock,
  },
] as const

/**
 * Register all application shortcuts. Returns a cleanup function.
 */
export function registerAllShortcuts(): () => void {
  return registerShortcuts(
    SHORTCUT_DEFS.map(({ key, meta, shift, alt, action }) => ({
      key,
      meta: meta as boolean | undefined,
      shift: shift as boolean | undefined,
      alt: alt as boolean | undefined,
      action,
    }))
  )
}
