import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import type { Group } from 'three'

const loader = new GLTFLoader()

export async function loadGLTF(file: File): Promise<Group> {
  const url = URL.createObjectURL(file)
  try {
    const gltf = await loader.loadAsync(url)
    return gltf.scene
  } finally {
    URL.revokeObjectURL(url)
  }
}
