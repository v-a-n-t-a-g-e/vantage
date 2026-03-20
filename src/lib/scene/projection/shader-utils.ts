import type { Texture, PerspectiveCamera } from 'three'

interface PatchOptions {
  defines?: string
  header?: string
  main?: string
  [find: string]: string | undefined
}

export function patchShader(
  shader: string,
  { defines = '', header = '', main = '', ...replaces }: PatchOptions
): string {
  let patched = shader

  for (const [find, rep] of Object.entries(replaces)) {
    if (rep !== undefined) patched = patched.split(find).join(rep)
  }

  patched = patched.replace(
    'void main() {',
    `
    ${header}
    void main() {
      ${main}
    `
  )

  return `
    ${defines}
    ${patched}
  `
}

export function addLoadListener(texture: Texture, callback: (texture: Texture) => void): void {
  function isLoaded(): boolean {
    if (!texture.image) return false
    const img = texture.image as HTMLImageElement | HTMLVideoElement
    const isVideo = 'videoWidth' in img
    if (!isVideo) return true
    const video = img as HTMLVideoElement
    return video.videoWidth > 0 && video.videoHeight > 0
  }

  if (isLoaded()) return

  const interval = setInterval(() => {
    if (isLoaded()) {
      clearInterval(interval)
      callback(texture)
    }
  }, 16)
}

export function computeScaledDimensions(
  texture: Texture,
  camera: PerspectiveCamera
): [number, number] {
  if (!texture.image) return [1, 1]

  const img = texture.image as HTMLImageElement | HTMLVideoElement
  if ('videoWidth' in img) {
    const video = img as HTMLVideoElement
    if (video.videoWidth === 0 && video.videoHeight === 0) return [1, 1]
  }

  const sourceWidth =
    (img as HTMLImageElement).naturalWidth ?? (img as HTMLVideoElement).videoWidth ?? img.width
  const sourceHeight =
    (img as HTMLImageElement).naturalHeight ?? (img as HTMLVideoElement).videoHeight ?? img.height

  const ratio = sourceWidth / sourceHeight
  const ratioCamera = camera.aspect

  if (ratio < ratioCamera) {
    return [ratioCamera / ratio, 1]
  } else {
    return [1, ratio / ratioCamera]
  }
}
