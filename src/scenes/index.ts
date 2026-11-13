import { levels12 } from './levels12'
import { levels34 } from './levels34'
import { level5, capstones } from './level5'

export const coreScenes = [...levels12, ...levels34, ...level5]
export const capstoneScenes = capstones
export const allScenes = [...coreScenes, ...capstoneScenes]
