import { describe, expect, it } from 'vitest'
import { allScenes } from './scenes'
import { createSceneState, sceneReducer } from './sceneEngine'
import { completeMission, loadProgress, type StorageLike } from './progress'
import type { Experiment } from './scenes/types'

function assessmentRoute(experiment: Experiment): string[] {
  const queue = [{ nodeId: experiment.initial, actions: [] as string[], evidence: new Set<string>() }]
  const visited = new Set<string>()
  while (queue.length) {
    const current = queue.shift()!
    const node = experiment.nodes[current.nodeId]
    for (const evidence of node.evidence) current.evidence.add(evidence.id)
    const key = `${current.nodeId}:${[...current.evidence].sort().join(',')}`
    if (visited.has(key)) continue
    visited.add(key)
    if (node.assess && experiment.investigation.requiredEvidence.every(id => current.evidence.has(id))) return current.actions
    for (const action of node.actions) {
      queue.push({ nodeId: action.next, actions: [...current.actions, action.id], evidence: new Set(current.evidence) })
    }
  }
  throw new Error('No evidence-supported assessment route')
}

describe('playable campaign journeys', () => {
  for (const scene of allScenes) {
    it(`${scene.id} requires two completed evidence investigations despite incorrect predictions`, () => {
      let state = createSceneState(scene)
      const blocked = sceneReducer(scene, state, { type: 'act', actionId: 'not-available' })
      expect(blocked.phase).toBe('predict')
      for (const experiment of [scene.guided, scene.transfer]) {
        const prediction = (experiment.prediction.correct + 1) % experiment.prediction.options.length
        state = sceneReducer(scene, state, { type: 'predict', choice: prediction })
        expect(state.phase).toBe('experiment')
        expect(state.prediction).toBe(prediction)
        const early = sceneReducer(scene, state, {
          type: 'explain', choice: experiment.investigation.correct,
          evidenceIds: experiment.investigation.requiredEvidence,
        })
        expect(early.phase).toBe('experiment')
        for (const actionId of assessmentRoute(experiment)) {
          state = sceneReducer(scene, state, { type: 'act', actionId })
          expect(state.phase).toBe('experiment')
        }
        state = sceneReducer(scene, state, { type: 'assess' })
        expect(state.phase).toBe('explain')
        const unsupported = sceneReducer(scene, state, {
          type: 'explain', choice: experiment.investigation.correct, evidenceIds: [],
        })
        expect(unsupported.phase).toBe('explain')
        const wrong = sceneReducer(scene, state, {
          type: 'explain', choice: (experiment.investigation.correct + 1) % experiment.investigation.options.length,
          evidenceIds: experiment.investigation.requiredEvidence,
        })
        expect(wrong.phase).toBe('explain')
        state = sceneReducer(scene, state, {
          type: 'explain', choice: experiment.investigation.correct,
          evidenceIds: experiment.investigation.requiredEvidence,
        })
        if (experiment === scene.guided) {
          expect(state.mode).toBe('transfer')
          expect(state.phase).toBe('predict')
        }
      }
      expect(state.phase).toBe('complete')
      expect(sceneReducer(scene, state, { type: 'reset' }).phase).toBe('predict')
    })
  }

  it('records full mastery only after all 40 complete guided and transfer journeys', () => {
    let saved: string | null = null
    const storage: StorageLike = {
      getItem: key => key === 'windows-internals.campaign.v1' ? saved : null,
      setItem: (_, value) => { saved = value },
    }
    let progress = loadProgress(storage)
    for (const scene of allScenes) {
      let state = createSceneState(scene)
      for (const experiment of [scene.guided, scene.transfer]) {
        state = sceneReducer(scene, state, { type: 'predict', choice: experiment.prediction.correct })
        for (const actionId of assessmentRoute(experiment)) state = sceneReducer(scene, state, { type: 'act', actionId })
        state = sceneReducer(scene, state, { type: 'assess' })
        state = sceneReducer(scene, state, {
          type: 'explain', choice: experiment.investigation.correct,
          evidenceIds: experiment.investigation.requiredEvidence,
        })
      }
      expect(state.phase).toBe('complete')
      progress = completeMission(progress, scene.id, storage)
      expect(progress.error).toBe('')
      progress = loadProgress(storage)
    }
    expect(progress.completed).toHaveLength(40)
  })
})
