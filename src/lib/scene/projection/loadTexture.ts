import { VideoTexture, TextureLoader, type Texture } from 'three'

export async function loadTexture(url: string): Promise<Texture> {
  const isVideo = /\.(mp4|webm|ogg)$/i.test(url)

  if (isVideo) {
    const video = await new Promise<HTMLVideoElement>((resolve) => {
      const el = document.createElement('video')
      el.src = url
      el.crossOrigin = 'anonymous'
      el.playsInline = true
      el.muted = true
      el.loop = false
      el.play()
      el.addEventListener(
        'playing',
        () => {
          el.pause()
          resolve(el)
        },
        { once: true }
      )
    })
    return new VideoTexture(video)
  }

  return new Promise<Texture>((resolve, reject) => {
    new TextureLoader().load(url, resolve, undefined, reject)
  })
}
