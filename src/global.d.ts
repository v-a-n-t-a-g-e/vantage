declare module '*.svg' {
  import type { Component } from 'svelte'
  const component: Component
  export default component
}

// File System Access API (Chromium)
interface FileSystemDirectoryHandle {
  requestPermission(descriptor: {
    mode: 'read' | 'readwrite'
  }): Promise<'granted' | 'denied' | 'prompt'>
}

interface Window {
  showDirectoryPicker(options?: { mode?: 'read' | 'readwrite' }): Promise<FileSystemDirectoryHandle>
}

// webkitdirectory attribute for directory picker fallback
interface HTMLInputElement {
  webkitdirectory: boolean
}
