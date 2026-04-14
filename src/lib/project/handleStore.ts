const STORE_NAME = 'project-handles'
const RECENTS_KEY = 'recent-projects'
const MAX_RECENTS = 10

export interface RecentProject {
  name: string
  handle: FileSystemDirectoryHandle
}

function openDB(dbName: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(dbName, 1)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function addRecent(dbName: string, handle: FileSystemDirectoryHandle): Promise<void> {
  try {
    const current = await getRecents(dbName)
    const filtered = current.filter((p) => p.name !== handle.name)
    const updated = [{ name: handle.name, handle }, ...filtered].slice(0, MAX_RECENTS)
    const db = await openDB(dbName)
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      tx.objectStore(STORE_NAME).put(updated, RECENTS_KEY)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } catch {
    // ignore
  }
}

async function getRecents(dbName: string): Promise<RecentProject[]> {
  try {
    const db = await openDB(dbName)
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const req = tx.objectStore(STORE_NAME).get(RECENTS_KEY)
      req.onsuccess = () => resolve(req.result ?? [])
      req.onerror = () => reject(req.error)
    })
  } catch {
    return []
  }
}

/**
 * Create a recent projects store backed by IndexedDB.
 * Each app should use a unique `appName` so recent project lists don't collide.
 *
 * ```ts
 * const recents = createRecentProjects('my-transition-tool')
 * const list = await recents.get()
 * await recents.add(directoryHandle)
 * ```
 */
export function createRecentProjects(appName: string) {
  return {
    /** Get the list of recent projects (most recent first). */
    get: () => getRecents(appName),
    /** Add or move a directory handle to the front of the recent list. */
    add: (handle: FileSystemDirectoryHandle) => addRecent(appName, handle),
  }
}

// ── Vantage app convenience (pre-bound to 'vantage' DB) ──

export const addRecentHandle = (handle: FileSystemDirectoryHandle) => addRecent('vantage', handle)
export const getRecentHandles = () => getRecents('vantage')
