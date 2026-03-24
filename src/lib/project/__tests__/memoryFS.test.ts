import { describe, it, expect } from 'vitest'
import { createMemoryFS, exportAsZip } from '@/lib/project/memoryFS.ts'

describe('memoryFS', () => {
  it('creates an empty filesystem', () => {
    const fs = createMemoryFS()
    expect(fs.store.size).toBe(0)
  })

  it('writeFile and readFile round-trip', async () => {
    const fs = createMemoryFS()
    await fs.writeFile('test.txt', 'hello world')

    const file = await fs.readFile('test.txt')
    expect(await file.text()).toBe('hello world')
  })

  it('writeFile accepts Blob data', async () => {
    const fs = createMemoryFS()
    const blob = new Blob([JSON.stringify({ key: 'value' })], { type: 'application/json' })
    await fs.writeFile('data.json', blob)

    const file = await fs.readFile('data.json')
    const content = JSON.parse(await file.text())
    expect(content).toEqual({ key: 'value' })
  })

  it('readFile throws for missing files', async () => {
    const fs = createMemoryFS()
    await expect(fs.readFile('missing.txt')).rejects.toThrow('File not found: missing.txt')
  })

  it('mkdir is a no-op', async () => {
    const fs = createMemoryFS()
    // Should not throw
    await fs.mkdir('some/dir')
    expect(fs.store.size).toBe(0)
  })

  it('creates from File[] stripping root directory', async () => {
    const files = [
      Object.assign(new File(['content-a'], 'a.txt'), {
        webkitRelativePath: 'project/a.txt',
      }),
      Object.assign(new File(['content-b'], 'b.txt'), {
        webkitRelativePath: 'project/sub/b.txt',
      }),
    ]

    const fs = createMemoryFS(files)
    expect(fs.store.size).toBe(2)

    const a = await fs.readFile('a.txt')
    expect(await a.text()).toBe('content-a')

    const b = await fs.readFile('sub/b.txt')
    expect(await b.text()).toBe('content-b')
  })

  it('writeFile overwrites existing data', async () => {
    const fs = createMemoryFS()
    await fs.writeFile('test.txt', 'first')
    await fs.writeFile('test.txt', 'second')

    const file = await fs.readFile('test.txt')
    expect(await file.text()).toBe('second')
  })

  it('exportAsZip produces a valid zip blob', async () => {
    const fs = createMemoryFS()
    await fs.writeFile('scene.json', '{"version": 1}')
    await fs.writeFile('models/test.glb', new Blob([new Uint8Array([1, 2, 3])]))

    const zip = await exportAsZip(fs)
    expect(zip).toBeInstanceOf(Blob)
    expect(zip.type).toBe('application/zip')
    expect(zip.size).toBeGreaterThan(0)
  })
})
