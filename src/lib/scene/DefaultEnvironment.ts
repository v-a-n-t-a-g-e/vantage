import * as THREE from 'three'
import { InfiniteGrid } from '@/lib/scene/InfiniteGrid.ts'

export class DefaultEnvironment extends THREE.Group {
  readonly grid: InfiniteGrid

  constructor() {
    super()
    this.grid = new InfiniteGrid()
    this.add(this.grid)
    this.add(new THREE.AmbientLight(0xffffff, 0.8))
    const dir1 = new THREE.DirectionalLight(0xffffff, 3)
    const dir2 = new THREE.DirectionalLight(0xffffff, 3)
    dir1.position.set(1, 1, 1)
    dir2.position.set(-1, -1, -1)
    this.add(dir1, dir2)
  }
}
