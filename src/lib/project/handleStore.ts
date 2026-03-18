const DB_NAME = 'vantage'
const STORE_NAME = 'project-handles'
const RECENTS_KEY = 'recent-projects'
const MAX_RECENTS = 10

export interface RecentProject {
  name: string
  handle: FileSystemDirectoryHandle
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
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

export async function addRecentHandle(handle: FileSystemDirectoryHandle): Promise<void> {
  try {
    const current = await getRecentHandles()
    const filtered = current.filter((p) => p.name !== handle.name)
    const updated = [{ name: handle.name, handle }, ...filtered].slice(0, MAX_RECENTS)
    const db = await openDB()
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

export async function getRecentHandles(): Promise<RecentProject[]> {
  try {
    const db = await openDB()
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
