import { describe, expect, it } from 'vitest'
import { createMission, missionReducer, questions, type MissionState } from './simulation'

function atComparison(): MissionState {
  let state = missionReducer(createMission(), { type: 'inspect-program' })
  state = missionReducer(state, { type: 'launch' })
  state = missionReducer(state, { type: 'inspect-process', pid: 4100 })
  state = missionReducer(state, { type: 'launch' })
  return missionReducer(state, { type: 'inspect-process', pid: 4104 })
}

describe('First Contact progression', () => {
  it('requires discovery and inspection, rather than progressing from launches alone', () => {
    const initial = createMission()
    expect(missionReducer(initial, { type: 'launch' })).toBe(initial)
    let state = missionReducer(initial, { type: 'inspect-program' })
    state = missionReducer(state, { type: 'launch' })
    expect(state.stage).toBe(1)
    expect(state.processes).toEqual([{ pid: 4100, image: 'atlas-notes.exe' }])
    expect(missionReducer(state, { type: 'inspect-process', pid: 9999 })).toBe(state)
    state = missionReducer(state, { type: 'inspect-process', pid: 4100 })
    expect(state.stage).toBe(2)
    expect(missionReducer(state, { type: 'inspect-process', pid: 4100 }).stage).toBe(2)
  })

  it('creates independent instances and closes only the chosen process', () => {
    const state = atComparison()
    expect(state.stage).toBe(3)
    expect(state.processes.map(p => p.pid)).toEqual([4100, 4104])
    const closed = missionReducer(state, { type: 'close', pid: 4104 })
    expect(closed.stage).toBe(4)
    expect(closed.processes).toEqual([{ pid: 4100, image: 'atlas-notes.exe' }])
    expect(closed.selectedPid).toBe(4100)
    expect(missionReducer(closed, { type: 'close', pid: 4104 })).toBe(closed)
    const relaunched = missionReducer(closed, { type: 'launch' })
    expect(relaunched.processes.map(p => p.pid)).toEqual([4100, 4108])
  })

  it('does not allow premature or wrong answers to complete the mission', () => {
    const early = atComparison()
    expect(missionReducer(early, { type: 'answer', choice: 1 })).toBe(early)
    let state = missionReducer(early, { type: 'close', pid: 4104 })
    const wrong = missionReducer(state, { type: 'answer', choice: 0 })
    expect(wrong.stage).toBe(4)
    expect(wrong.question).toBe(0)
    expect(wrong.feedback).toContain('Not quite')
    for (const question of questions) {
      state = missionReducer(state, { type: 'answer', choice: question.correct })
    }
    expect(state.stage).toBe(5)
    expect(missionReducer(state, { type: 'reset' })).toEqual(createMission())
  })
})
