export const progressKey = 'windows-internals.campaign.v1'
const legacyKey = 'windows-internals.first-contact.v1'
const coreIds = [6, 6, 6, 7, 11].flatMap((count, level) =>
  Array.from({ length: count }, (_, mission) => `l${level + 1}-${mission + 1}`))
export const campaignIds = [...coreIds, 'capstone-waits', 'capstone-memory', 'capstone-io', 'capstone-access']

export interface StorageLike {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
}

export interface Progress {
  completed: string[]
  error: string
  writable: boolean
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export function isUnlocked(id: string, completed: readonly string[]): boolean {
  if (!campaignIds.includes(id)) return false
  if (completed.includes(id)) return true
  const index = coreIds.indexOf(id)
  return index >= 0
    ? coreIds.slice(0, index).every(previous => completed.includes(previous))
    : coreIds.every(previous => completed.includes(previous))
}

function validRecord(value: unknown): value is { version: 1; completed: string[] } {
  if (typeof value !== 'object' || value === null || !('version' in value) || value.version !== 1
    || !('completed' in value) || !Array.isArray(value.completed)) return false
  const completed: unknown[] = value.completed
  if (!completed.every(id => typeof id === 'string' && campaignIds.includes(id))) return false
  const ids = completed.filter((id): id is string => typeof id === 'string')
  return ids.every(id => isUnlocked(id, ids.filter(other => other !== id)))
}

export function loadProgress(storage?: StorageLike): Progress {
  let saved: string | null
  let legacy: string | null
  try {
    const source = storage ?? localStorage
    saved = source.getItem(progressKey)
    legacy = source.getItem(legacyKey)
  } catch (error) {
    return { completed: [], writable: false, error: `Cannot read saved progress: ${message(error)}. Session progress will not be saved.` }
  }
  let completed: string[] = legacy === 'complete' ? ['l1-1'] : []
  if (saved !== null) {
    let parsed: unknown
    try {
      parsed = JSON.parse(saved)
    } catch (error) {
      return { completed, writable: false, error: `Saved progress is invalid: ${message(error)}. The record is preserved; session progress will not be saved.` }
    }
    if (!validRecord(parsed)) {
      return { completed, writable: false, error: 'Saved progress has an unsupported version, mission, or prerequisite sequence. The record is preserved; session progress will not be saved.' }
    }
    completed = campaignIds.filter(id => parsed.completed.includes(id))
  }
  if (legacy !== null && legacy !== 'complete') {
    return { completed, writable: false, error: 'The legacy First Contact record is invalid. Saved records are preserved; session progress will not be saved.' }
  }
  if (legacy === 'complete' && !completed.includes('l1-1')) completed = ['l1-1', ...completed]
  return { completed, writable: true, error: '' }
}

export function completeMission(progress: Progress, id: string, storage?: StorageLike): Progress {
  if (!campaignIds.includes(id)) return { ...progress, error: `Unknown mission "${id}"; no mastery was recorded.` }
  if (!isUnlocked(id, progress.completed)) return { ...progress, error: 'This mission is locked. Complete its prerequisites first.' }
  if (progress.completed.includes(id)) return progress.error && progress.writable ? saveProgress(progress, storage) : progress
  const completed = campaignIds.filter(mission => mission === id || progress.completed.includes(mission))
  return saveProgress({ ...progress, completed }, storage)
}

export function saveProgress(progress: Progress, storage?: StorageLike): Progress {
  if (!progress.writable) {
    const notice = 'New mastery is available this session but not saved.'
    return { ...progress, error: progress.error.includes(notice) ? progress.error : `${progress.error} ${notice}` }
  }
  try {
    const destination = storage ?? localStorage
    destination.setItem(progressKey, JSON.stringify({ version: 1, completed: progress.completed }))
    return { ...progress, error: '' }
  } catch (error) {
    return { ...progress, error: `Mastery recorded for this session, but progress could not be saved: ${message(error)}.` }
  }
}
