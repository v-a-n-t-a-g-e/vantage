import * as THREE from 'three'

export class DefaultEnvironment extends THREE.Group {
  constructor() {
    super()
    this.add(new THREE.PolarGridHelper(20, 8, 8, 64))
    this.add(new THREE.AmbientLight(0xffffff, 0.6))
    const dir = new THREE.DirectionalLight(0xffffff, 1.2)
    dir.position.set(10, 20, 10)
    this.add(dir)
  }
}
