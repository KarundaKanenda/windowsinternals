import { describe, expect, it } from 'vitest'
import { campaignIds, completeMission, isUnlocked, loadProgress, progressKey, saveProgress, type StorageLike } from './progress'

function memoryStorage(values: Record<string, string> = {}): StorageLike {
  return {
    getItem: key => values[key] ?? null,
    setItem: (key, value) => { values[key] = value },
  }
}

describe('campaign mastery', () => {
  it('migrates legacy mastery without unlocking later chapters', () => {
    const progress = loadProgress(memoryStorage({ 'windows-internals.first-contact.v1': 'complete' }))
    expect(progress.completed).toEqual(['l1-1'])
    expect(isUnlocked('l1-2', progress.completed)).toBe(true)
    expect(isUnlocked('l2-1', progress.completed)).toBe(false)
    expect(isUnlocked('capstone-waits', progress.completed)).toBe(false)
  })

  it('unlocks only the next core mission and saves deduplicated mastery', () => {
    const storage = memoryStorage()
    const initial = loadProgress(storage)
    expect(isUnlocked('l1-1', initial.completed)).toBe(true)
    const rejected = completeMission(initial, 'l1-2', storage)
    expect(rejected.completed).toEqual([])
    expect(rejected.error).toContain('locked')
    const complete = completeMission(initial, 'l1-1', storage)
    expect(loadProgress(storage).completed).toEqual(['l1-1'])
    expect(completeMission(complete, 'l1-1', storage).completed).toEqual(['l1-1'])
    expect(isUnlocked('l1-2', complete.completed)).toBe(true)
    expect(isUnlocked('unknown', complete.completed)).toBe(false)
  })

  it('unlocks all capstone variants after core mastery and keeps completed replay open', () => {
    const core = campaignIds.filter(id => !id.startsWith('capstone-'))
    expect(core).toHaveLength(36)
    expect(isUnlocked('capstone-access', core)).toBe(true)
    expect(isUnlocked('l1-1', core)).toBe(true)
    expect(isUnlocked('capstone-access', core.slice(0, -1))).toBe(false)
  })

  it('persists a full campaign across repeated reloads, including independent capstones', () => {
    const storage = memoryStorage()
    let progress = loadProgress(storage)
    for (const id of campaignIds.slice(0, 36)) {
      expect(isUnlocked(id, progress.completed)).toBe(true)
      progress = completeMission(progress, id, storage)
      progress = loadProgress(storage)
      expect(progress.error).toBe('')
    }
    for (const id of ['capstone-access', 'capstone-waits', 'capstone-io', 'capstone-memory']) {
      progress = completeMission(progress, id, storage)
      progress = loadProgress(storage)
    }
    expect(progress.completed).toEqual(campaignIds)
  })

  it('preserves malformed records instead of overwriting them during play', () => {
    for (const value of ['{', '{"version":2,"completed":[]}', '{"version":1,"completed":["unknown"]}', '{"version":1,"completed":["l1-2"]}']) {
      const storage = memoryStorage({ [progressKey]: value })
      const initial = loadProgress(storage)
      expect(initial.error).not.toBe('')
      const next = completeMission(initial, 'l1-1', storage)
      expect(next.completed).toEqual(['l1-1'])
      expect(storage.getItem(progressKey)).toBe(value)
      expect(next.error).toContain('not saved')
    }
  })

  it('retains grandfathered mastery even when newer campaign storage is corrupt', () => {
    for (const value of ['{', '{"version":2,"completed":[]}', '{"version":1,"completed":["unknown"]}']) {
      const storage = memoryStorage({
        [progressKey]: value,
        'windows-internals.first-contact.v1': 'complete',
      })
      const progress = loadProgress(storage)
      expect(progress.completed).toEqual(['l1-1'])
      expect(isUnlocked('l1-2', progress.completed)).toBe(true)
      expect(progress.error).not.toBe('')
      expect(progress.writable).toBe(false)
      expect(storage.getItem(progressKey)).toBe(value)
    }
  })

  it('keeps session mastery and reports denied storage writes', () => {
    const storage: StorageLike = {
      getItem: () => null,
      setItem: () => { throw new Error('quota reached') },
    }
    const next = completeMission(loadProgress(storage), 'l1-1', storage)
    expect(next.completed).toEqual(['l1-1'])
    expect(next.error).toContain('quota reached')
  })

  it('retries unsaved final mastery after storage becomes available again', () => {
    const storage = memoryStorage()
    let progress = loadProgress(storage)
    for (const id of campaignIds.slice(0, -1)) progress = completeMission(progress, id, storage)
    const failing: StorageLike = { getItem: storage.getItem, setItem: () => { throw new Error('quota reached') } }
    progress = completeMission(progress, 'capstone-access', failing)
    expect(progress.completed).toHaveLength(40)
    expect(loadProgress(storage).completed).toHaveLength(39)
    expect(completeMission(progress, 'capstone-access', storage).error).toBe('')
    expect(loadProgress(storage).completed).toHaveLength(40)
    expect(saveProgress(progress, storage).error).toBe('')
  })

  it('reports inaccessible reads, malformed legacy records and unknown completion IDs', () => {
    const denied: StorageLike = { getItem: () => { throw new Error('access denied') }, setItem: () => {} }
    expect(loadProgress(denied).error).toContain('access denied')
    const storage = memoryStorage({ 'windows-internals.first-contact.v1': 'bad' })
    expect(loadProgress(storage).error).toContain('legacy')
    expect(completeMission(loadProgress(memoryStorage()), 'unknown', storage).error).toContain('Unknown')
  })
})
