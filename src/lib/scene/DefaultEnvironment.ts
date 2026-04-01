import * as THREE from 'three'
import { InfiniteGrid } from '@/lib/scene/InfiniteGrid.ts'

export class DefaultEnvironment extends THREE.Group {
  readonly grid: InfiniteGrid

  constructor() {
    super()
    this.grid = new InfiniteGrid()
    this.add(this.grid)
    this.add(new THREE.AmbientLight(0xffffff, 2.0))
    const dir = new THREE.DirectionalLight(0xffffff, 1.2)
    dir.position.set(10, 20, 10)
    this.add(dir)
  }
}
