/** @typedef {'translate'|'rotate'|'scale'} TransformMode */
/** @typedef {{ objects: any[], selected: any, transformMode: TransformMode, transformRevision: number }} SceneState */

export const sceneState = /** @type {SceneState} */ ($state({
  objects: [],
  selected: null,
  transformMode: 'translate',
  transformRevision: 0,
}))
