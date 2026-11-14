import { describe, expect, it } from 'vitest'
import { allScenes } from './scenes'
import { sceneReducer, createSceneState, type SceneEngineAction } from './sceneEngine'
import { parseGameSave, restoreCheckpoint, loadGameSave, persistGameSave, gameSaveKey, type GameSave, type RunCheckpoint } from './gameSave'
import { progressKey, type StorageLike } from './progress'

const guided: SceneEngineAction[] = [
  { type: 'predict', choice: 0 },
  { type: 'act', actionId: 'launch-first' },
  { type: 'act', actionId: 'launch-second' },
  { type: 'act', actionId: 'close-second' },
  { type: 'assess' },
]
const transfer: SceneEngineAction[] = [
  ...guided,
  { type: 'explain', choice: 1, evidenceIds: ['two-pids', 'survivor'] },
]
function checkpoint(actions = guided): RunCheckpoint {
  return {
    sceneId: 'l1-1', actions,
    draft: { choice: 0, evidenceIds: actions === guided ? ['two-pids'] : [] },
    hintCount: 2,
  }
}
function save(run: RunCheckpoint | null = checkpoint()): GameSave {
  return { version: 1, contentVersion: 1, completed: [], checkpoint: run }
}
function memoryStorage(values: Record<string, string> = {}): StorageLike {
  return { getItem: key => values[key] ?? null, setItem: (key, value) => { values[key] = value } }
}

describe('portable game saves', () => {
  it('restores observations, partial selections and hints at guided explain', () => {
    const restored = parseGameSave(JSON.stringify(save()))
    expect(restored.checkpoint?.draft).toEqual({ choice: 0, evidenceIds: ['two-pids'] })
    expect(restored.checkpoint?.hintCount).toBe(2)
    const state = restoreCheckpoint(restored.checkpoint!)
    expect(state.phase).toBe('explain')
    expect(state.nodeId).toBe('survivor')
    expect(state.observed['two-pids'].value).toBe('2: PIDs 4100, 4104')
    expect(state.observed['survivor'].value).toBe('1: PID 4100; PID 4104 exited')
  })

  it('survives deleted storage by importing a transfer checkpoint and continuing', () => {
    const exported = JSON.stringify(save(checkpoint(transfer)))
    const freshBrowser = memoryStorage()
    expect(loadGameSave(freshBrowser).save.checkpoint).toBeNull()
    persistGameSave(parseGameSave(exported), freshBrowser)
    const loaded = loadGameSave(freshBrowser)
    expect(loaded.error).toBe('')
    let state = restoreCheckpoint(loaded.save.checkpoint!)
    expect(state.mode).toBe('transfer')
    expect(state.phase).toBe('predict')
    expect(state.observed['two-pids']).toBeUndefined()
    state = sceneReducer(allScenes[0], state, { type: 'predict', choice: 0 })
    expect(state.phase).toBe('experiment')
  })

  it('permits a wrong explanation attempt without granting mastery', () => {
    const run = checkpoint([...guided, { type: 'explain', choice: 0, evidenceIds: ['two-pids', 'survivor'] }])
    const loaded = parseGameSave(JSON.stringify(save(run)))
    expect(restoreCheckpoint(loaded.checkpoint!).feedback?.code).toBe('incorrect-mechanism')
    expect(loaded.completed).toEqual([])
  })

  it('migrates existing mastery, but an imported replacement is authoritative over legacy records', () => {
    const storage = memoryStorage({
      [progressKey]: JSON.stringify({ version: 1, completed: ['l1-1'] }),
      'windows-internals.first-contact.v1': 'complete',
    })
    expect(loadGameSave(storage).save.completed).toEqual(['l1-1'])
    persistGameSave(save(null), storage)
    expect(loadGameSave(storage).save.completed).toEqual([])
    expect(storage.getItem(progressKey)).not.toBeNull()
  })

  it('keeps damaged saves untouched and surfaces unavailable storage', () => {
    for (const corrupt of ['{', '{"version":99}', 'null']) {
      const storage = memoryStorage({ [gameSaveKey]: corrupt })
      const loaded = loadGameSave(storage)
      expect(loaded.error).not.toBe('')
      expect(loaded.writable).toBe(false)
      expect(storage.getItem(gameSaveKey)).toBe(corrupt)
    }
    const denied: StorageLike = {
      getItem: () => { throw new Error('read denied') },
      setItem: () => { throw new Error('quota reached') },
    }
    expect(loadGameSave(denied).error).toContain('read denied')
    expect(() => persistGameSave(save(), denied)).toThrow('quota reached')
    expect(parseGameSave(JSON.stringify(save())).checkpoint).not.toBeNull()
  })

  it.each([
    ['unsupported schema', { ...save(), version: 2 }],
    ['incompatible content', { ...save(), contentVersion: 99 }],
    ['unknown mastery', { ...save(), completed: ['nonexistent'] }],
    ['duplicate mastery', { ...save(), completed: ['l1-1', 'l1-1'] }],
    ['broken prerequisites', { ...save(), completed: ['l1-2'] }],
    ['locked checkpoint', save({ ...checkpoint(), sceneId: 'l2-1' })],
    ['unknown scene', save({ ...checkpoint(), sceneId: 'unknown' })],
    ['unavailable action', save(checkpoint([{ type: 'act', actionId: 'invented' }]))],
    ['out-of-stage action', save(checkpoint([{ type: 'assess' }]))],
    ['invalid prediction', save(checkpoint([{ type: 'predict', choice: 40 }]))],
    ['invalid hints', save({ ...checkpoint(), hintCount: 999 })],
    ['unsupported action field', save(checkpoint([{ type: 'predict', choice: 0, forged: true } as SceneEngineAction]))],
    ['forged observations', save({ ...checkpoint(), observed: { survivor: 'forged' } } as RunCheckpoint)],
    ['unobserved draft', save({ ...checkpoint(), draft: { choice: 0, evidenceIds: ['invented'] } })],
    ['duplicate draft', save({ ...checkpoint(), draft: { choice: 0, evidenceIds: ['two-pids', 'two-pids'] } })],
    ['invalid draft option', save({ ...checkpoint(), draft: { choice: 40, evidenceIds: [] } })],
    ['reset in history', save(checkpoint([{ type: 'reset' }]))],
    ['forged complete', save({ ...checkpoint(), phase: 'complete' } as RunCheckpoint)],
  ])('rejects %s without modifying the input', (_, input) => {
    const before = JSON.stringify(input)
    expect(() => parseGameSave(before)).toThrow()
    expect(JSON.stringify(input)).toBe(before)
  })

  it('rejects oversized saves and excessive histories explicitly', () => {
    expect(() => parseGameSave(' '.repeat(2_000_001))).toThrow(/large/i)
    expect(() => parseGameSave(JSON.stringify(save(checkpoint(Array.from({ length: 10_001 }, () => ({ type: 'assess' }))))))).toThrow()
  })

  it('allows a fresh replay without clearing prior mastery', () => {
    const loaded = parseGameSave(JSON.stringify({
      ...save({ sceneId: 'l1-1', actions: [], draft: { choice: null, evidenceIds: [] }, hintCount: 0 }),
      completed: ['l1-1'],
    }))
    expect(restoreCheckpoint(loaded.checkpoint!).phase).toBe('predict')
    expect(loaded.completed).toEqual(['l1-1'])
  })

  it('replays a fresh checkpoint identically to the engine', () => {
    const run: RunCheckpoint = { sceneId: 'l1-1', actions: [], draft: { choice: null, evidenceIds: [] }, hintCount: 0 }
    expect(restoreCheckpoint(run)).toEqual(createSceneState(allScenes[0]))
  })
})
