/** Logical size of the pilasweb scene (see scene.ts): the scene keeps this proportion at any size. */
const SCENE_WIDTH = 420
const SCENE_HEIGHT = 480

export const MAX_SCENE_WIDTH = 630
/** The scene only grows while the editor keeps at least the rest of the row. */
const MAX_ROW_SHARE = 0.4

export const sceneHeightFor = (width: number) => Math.round(width * SCENE_HEIGHT / SCENE_WIDTH)

/** Widest scene that fits the available height. It never gets smaller than baseWidth. */
export const fittedSceneWidth = (baseWidth: number, availableHeight: number, rowWidth: number) =>
    Math.floor(Math.max(baseWidth, Math.min(
        MAX_SCENE_WIDTH,
        availableHeight * SCENE_WIDTH / SCENE_HEIGHT,
        rowWidth * MAX_ROW_SHARE)))
