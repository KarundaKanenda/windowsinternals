import { allScenes } from './scenes'
import { createSceneState, sceneReducer, type SceneEngineAction, type SceneState } from './sceneEngine'
import { isUnlocked, loadProgress, validRecord, type StorageLike } from './progress'

export const gameSaveKey = 'windows-internals.save.v1'
export const maxSaveBytes = 2_000_000
const maxActions = 10_000

export interface CheckDraft {
  choice: number | null
  evidenceIds: string[]
}

export interface RunCheckpoint {
  sceneId: string
  actions: SceneEngineAction[]
  draft: CheckDraft
  hintCount: number
}

export interface GameSave {
  version: 1
  contentVersion: 1
  completed: string[]
  checkpoint: RunCheckpoint | null
}

export interface SavedGame {
  save: GameSave
  error: string
  writable: boolean
}

export const emptyDraft = (): CheckDraft => ({ choice: null, evidenceIds: [] })
export const newCheckpoint = (sceneId: string): RunCheckpoint => ({
  sceneId, actions: [], draft: emptyDraft(), hintCount: 0,
})
const emptySave = (): GameSave => ({ version: 1, contentVersion: 1, completed: [], checkpoint: null })
const errorMessage = (error: unknown) => error instanceof Error ? error.message : String(error)

function fail(message: string): never {
  throw new Error(`Invalid save: ${message}`)
}

function record(value: unknown, fields: string[]): asserts value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)
    || Object.keys(value).length !== fields.length || fields.some(field => !Object.hasOwn(value, field))) {
    fail(`Expected fields: ${fields.join(', ')}.`)
  }
}

function integer(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}

function stringIds(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(id => typeof id === 'string') && new Set(value).size === value.length
}

function validateAction(value: unknown): asserts value is SceneEngineAction {
  if (typeof value !== 'object' || value === null) fail('Missing action type.')
  const action: Record<string, unknown> = { ...value }
  switch (action.type) {
    case 'predict':
      record(action, ['type', 'choice'])
      if (!integer(action.choice)) fail('Invalid prediction.')
      break
    case 'act':
      record(action, ['type', 'actionId'])
      if (typeof action.actionId !== 'string') fail('Invalid model action.')
      break
    case 'assess':
    case 'resume':
      record(action, ['type'])
      break
    case 'explain':
      record(action, ['type', 'choice', 'evidenceIds'])
      if (!integer(action.choice) || !stringIds(action.evidenceIds)) fail('Invalid explanation.')
      break
    default:
      fail('Unsupported action. Resets must start a fresh checkpoint.')
  }
}

function validateCheckpoint(value: unknown): asserts value is RunCheckpoint {
  record(value, ['sceneId', 'actions', 'draft', 'hintCount'])
  if (typeof value.sceneId !== 'string' || !Array.isArray(value.actions)
    || value.actions.length > maxActions || !integer(value.hintCount)) fail('Invalid checkpoint.')
  for (const action of value.actions) validateAction(action)
  record(value.draft, ['choice', 'evidenceIds'])
  if ((value.draft.choice !== null && !integer(value.draft.choice)) || !stringIds(value.draft.evidenceIds)) {
    fail('Invalid answer draft.')
  }
}

export function restoreCheckpoint(checkpoint: RunCheckpoint): SceneState {
  validateCheckpoint(checkpoint)
  const scene = allScenes.find(item => item.id === checkpoint.sceneId)
  if (!scene) fail('Unknown mission.')
  if (!Array.isArray(checkpoint.actions) || checkpoint.actions.length > maxActions) fail('Invalid or excessive action history.')
  if (!integer(checkpoint.hintCount) || checkpoint.hintCount > scene.hints.length) fail('Invalid hint count.')
  let state = createSceneState(scene)
  for (const action of checkpoint.actions) {
    validateAction(action)
    const next = sceneReducer(scene, state, action)
    if (next.feedback?.kind === 'error'
      && !['incorrect-evidence', 'incorrect-mechanism', 'missing-observations'].includes(next.feedback.code)) {
      fail(`Cannot replay action: ${next.feedback.message}`)
    }
    state = next
  }
  record(checkpoint.draft, ['choice', 'evidenceIds'])
  const { choice, evidenceIds } = checkpoint.draft
  if (!stringIds(evidenceIds)) fail('Invalid evidence selection.')
  if (state.phase === 'predict' || state.phase === 'explain') {
    const check = state.phase === 'predict' ? scene[state.mode].prediction : scene[state.mode].investigation
    if (choice !== null && (!integer(choice) || choice >= check.options.length)) fail('Invalid selected answer.')
    if (state.phase === 'predict' && evidenceIds.length) fail('Prediction cannot select evidence.')
    if (evidenceIds.some(id => !Object.hasOwn(state.observed, id))) fail('Selected evidence was not observed.')
  } else if (choice !== null || evidenceIds.length) {
    fail('No answer form is active at this stage.')
  }
  return state
}

export function parseGameSave(text: string): GameSave {
  if (new TextEncoder().encode(text).byteLength > maxSaveBytes) fail('File is too large (maximum 2 MB).')
  const value: unknown = JSON.parse(text)
  record(value, ['version', 'contentVersion', 'completed', 'checkpoint'])
  if (value.version !== 1 || value.contentVersion !== 1) fail('Unsupported save or campaign content version.')
  if (!validRecord({ version: value.version, completed: value.completed }) || !stringIds(value.completed)) {
    fail('Unknown, duplicate or out-of-sequence mastery.')
  }
  let checkpoint: RunCheckpoint | null = null
  if (value.checkpoint !== null) {
    validateCheckpoint(value.checkpoint)
    const candidate = value.checkpoint
    const state = restoreCheckpoint(candidate)
    if (!isUnlocked(candidate.sceneId, value.completed)) fail('The checkpoint mission is locked.')
    if (state.phase === 'complete' && !value.completed.includes(candidate.sceneId)) fail('Completed checkpoint is missing mastery.')
    checkpoint = candidate
  }
  return { version: 1, contentVersion: 1, completed: value.completed, checkpoint }
}

export function loadGameSave(storage?: StorageLike): SavedGame {
  try {
    const source = storage ?? localStorage
    const saved = source.getItem(gameSaveKey)
    if (saved !== null) {
      return { save: parseGameSave(saved), error: '', writable: true }
    }
    const legacy = loadProgress(source)
    return {
      save: { ...emptySave(), completed: legacy.completed },
      error: legacy.error, writable: legacy.writable,
    }
  } catch (error) {
    return {
      save: emptySave(), writable: false,
      error: `Cannot restore saved game: ${errorMessage(error)} Existing records are preserved; use a valid import to replace them. Session changes will not be saved.`,
    }
  }
}

export function persistGameSave(save: GameSave, storage?: StorageLike): void {
  const text = JSON.stringify(save)
  parseGameSave(text)
  const destination = storage ?? localStorage
  destination.setItem(gameSaveKey, text)
}

export function advanceCheckpoint(checkpoint: RunCheckpoint, action: SceneEngineAction): RunCheckpoint {
  if (action.type === 'reset') return newCheckpoint(checkpoint.sceneId)
  const scene = allScenes.find(item => item.id === checkpoint.sceneId)
  if (!scene) fail('Unknown mission.')
  const previous = restoreCheckpoint(checkpoint)
  const next = sceneReducer(scene, previous, action)
  return {
    ...checkpoint,
    actions: [...checkpoint.actions, action],
    draft: next.phase !== previous.phase || next.mode !== previous.mode ? emptyDraft() : checkpoint.draft,
  }
}

export function updateGameCheckpoint(save: GameSave, checkpoint: RunCheckpoint): GameSave {
  const state = restoreCheckpoint(checkpoint)
  const completed = state.phase === 'complete' && !save.completed.includes(checkpoint.sceneId)
    ? [...save.completed, checkpoint.sceneId] : save.completed
  return parseGameSave(JSON.stringify({ ...save, completed, checkpoint }))
}
