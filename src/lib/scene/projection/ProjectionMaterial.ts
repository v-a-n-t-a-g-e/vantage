import {
  MeshPhysicalMaterial,
  PerspectiveCamera,
  Texture,
  DepthTexture,
  Matrix4,
  Vector3,
  Mesh,
  type MeshPhysicalMaterialParameters,
  type WebGLProgramParametersWithUniforms,
} from 'three'
import { patchShader, addLoadListener, computeScaledDimensions } from './shader-utils'
import {
  vertexShaderHeader,
  vertexShaderMain,
  fragmentShaderHeader,
  fragmentShaderReplace,
} from './shader-chunks'

type Uniform<T> = { value: T }

interface ProjectionUniforms {
  projectedTexture: Uniform<Texture | null>
  isTextureLoaded: Uniform<boolean>
  isTextureProjected: Uniform<boolean>
  viewMatrixCamera: Uniform<Matrix4>
  projectionMatrixCamera: Uniform<Matrix4>
  projPosition: Uniform<Vector3>
  projDirection: Uniform<Vector3>
  savedModelMatrix: Uniform<Matrix4>
  widthScaled: Uniform<number>
  heightScaled: Uniform<number>
  depthMap: Uniform<DepthTexture | null>
  [key: string]: Uniform<unknown>
}

interface ProjectionMaterialOptions extends MeshPhysicalMaterialParameters {
  camera?: PerspectiveCamera
  texture?: Texture
  depthMap?: DepthTexture | null
}

export default class ProjectionMaterial extends MeshPhysicalMaterial {
  declare isProjectionMaterial: true
  declare uniforms: ProjectionUniforms

  #camera: PerspectiveCamera

  get camera(): PerspectiveCamera {
    return this.#camera
  }
  set camera(camera: PerspectiveCamera) {
    if (!(camera as { isCamera?: boolean })?.isCamera) {
      throw new Error('Invalid camera set to the ProjectionMaterial')
    }
    this.#camera = camera
    this.#saveDimensions()
  }

  get texture(): Texture | null {
    return this.uniforms.projectedTexture.value
  }
  set texture(texture: Texture) {
    if (!(texture as { isTexture?: boolean })?.isTexture) {
      throw new Error('Invalid texture set to the ProjectionMaterial')
    }

    this.uniforms.projectedTexture.value = texture
    this.uniforms.isTextureLoaded.value = Boolean(texture.image)

    if (!this.uniforms.isTextureLoaded.value) {
      addLoadListener(texture, () => {
        this.uniforms.isTextureLoaded.value = true
        this.dispatchEvent({ type: 'textureload' } as never)
        this.#saveDimensions()
      })
    } else {
      this.#saveDimensions()
    }
  }

  get depthMap(): DepthTexture | null {
    return this.uniforms.depthMap.value
  }
  set depthMap(depthMap: DepthTexture | null) {
    if (depthMap !== null && !(depthMap as { isTexture?: boolean })?.isTexture) {
      throw new Error('Invalid texture set to the ProjectionMaterial')
    }
    this.uniforms.depthMap.value = depthMap
  }

  constructor({
    camera = new PerspectiveCamera(),
    texture = new Texture(),
    depthMap = null,
    ...options
  }: ProjectionMaterialOptions = {}) {
    super(options)

    Object.defineProperty(this, 'isProjectionMaterial', { value: true })

    this.#camera = camera

    this.uniforms = {
      projectedTexture: { value: null },
      isTextureLoaded: { value: false },
      isTextureProjected: { value: false },
      viewMatrixCamera: { value: new Matrix4() },
      projectionMatrixCamera: { value: new Matrix4() },
      projPosition: { value: new Vector3() },
      projDirection: { value: new Vector3(0, 0, -1) },
      savedModelMatrix: { value: new Matrix4() },
      widthScaled: { value: 1 },
      heightScaled: { value: 1 },
      depthMap: { value: depthMap },
    }

    this.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
      Object.assign(this.uniforms, shader.uniforms)
      shader.uniforms = this.uniforms

      if (depthMap) {
        shader.defines ??= {}
        shader.defines.STOP_PROPAGATION = ''
      }

      shader.vertexShader = patchShader(shader.vertexShader, {
        header: vertexShaderHeader,
        main: vertexShaderMain,
      })

      shader.fragmentShader = patchShader(shader.fragmentShader, {
        header: fragmentShaderHeader,
        'vec4 diffuseColor = vec4( diffuse, opacity );': fragmentShaderReplace,
      })
    }

    window.addEventListener('resize', this.#saveCameraProjectionMatrix)

    this.texture = texture
  }

  #saveCameraProjectionMatrix = () => {
    this.uniforms.projectionMatrixCamera.value.copy(this.camera.projectionMatrix)
    this.#saveDimensions()
  }

  #saveDimensions() {
    const [widthScaled, heightScaled] = computeScaledDimensions(this.texture!, this.camera)
    this.uniforms.widthScaled.value = widthScaled
    this.uniforms.heightScaled.value = heightScaled
  }

  #saveCameraMatrices() {
    this.camera.updateProjectionMatrix()
    this.camera.updateMatrixWorld()
    this.camera.updateWorldMatrix(false, false)

    this.uniforms.viewMatrixCamera.value.copy(this.camera.matrixWorldInverse)
    this.uniforms.projectionMatrixCamera.value.copy(this.camera.projectionMatrix)
    this.uniforms.projPosition.value.setFromMatrixPosition(this.camera.matrixWorld)
    this.uniforms.projDirection.value.set(0, 0, 1).transformDirection(this.camera.matrixWorld)

    this.uniforms.isTextureProjected.value = true
  }

  project(mesh: Mesh) {
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    if (!materials.some((m) => (m as ProjectionMaterial).isProjectionMaterial)) {
      throw new Error('The mesh material must be a ProjectionMaterial')
    }
    if (!materials.some((m) => m === this)) {
      throw new Error(
        "The provided mesh doesn't include this material where project() has been called from"
      )
    }

    mesh.updateWorldMatrix(true, false)
    this.uniforms.savedModelMatrix.value.copy(mesh.matrixWorld)

    this.#saveCameraMatrices()
  }

  copy(source: ProjectionMaterial): this {
    super.copy(source)
    this.camera = source.camera
    this.texture = source.texture!
    this.depthMap = source.depthMap
    return this
  }

  dispose() {
    super.dispose()
    window.removeEventListener('resize', this.#saveCameraProjectionMatrix)
  }
}
