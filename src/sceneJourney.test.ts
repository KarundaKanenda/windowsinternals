import { describe, expect, it } from 'vitest'
import { allScenes } from './scenes'
import { createSceneState, sceneReducer } from './sceneEngine'
import { completeMission, loadProgress, type StorageLike } from './progress'
import type { Experiment } from './scenes/types'
import { advanceCheckpoint, updateGameCheckpoint, newCheckpoint, parseGameSave, restoreCheckpoint, type GameSave } from './gameSave'

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
  it('resumes selected evidence and hints in both investigations and records mastery atomically', () => {
    const scene = allScenes[0]
    let save: GameSave = { version: 1, contentVersion: 1, completed: [], checkpoint: newCheckpoint(scene.id) }
    for (const experiment of [scene.guided, scene.transfer]) {
      save = updateGameCheckpoint(save, advanceCheckpoint(save.checkpoint!, { type: 'predict', choice: 0 }))
      for (const actionId of assessmentRoute(experiment)) {
        save = updateGameCheckpoint(save, advanceCheckpoint(save.checkpoint!, { type: 'act', actionId }))
      }
      save = updateGameCheckpoint(save, advanceCheckpoint(save.checkpoint!, { type: 'assess' }))
      save = updateGameCheckpoint(save, {
        ...save.checkpoint!, draft: { choice: 1, evidenceIds: [experiment.investigation.requiredEvidence[0]] }, hintCount: 2,
      })
      save = parseGameSave(JSON.stringify(save))
      expect(restoreCheckpoint(save.checkpoint!).phase).toBe('explain')
      expect(save.checkpoint!.draft.evidenceIds).toHaveLength(1)
      expect(save.checkpoint!.draft.choice).toBe(1)
      expect(save.checkpoint!.hintCount).toBe(2)
      save = updateGameCheckpoint(save, advanceCheckpoint(save.checkpoint!, {
        type: 'explain', choice: experiment.investigation.correct,
        evidenceIds: experiment.investigation.requiredEvidence,
      }))
      expect(save.checkpoint!.draft).toEqual({ choice: null, evidenceIds: [] })
      expect(save.completed).toEqual(experiment === scene.guided ? [] : ['l1-1'])
    }
    expect(restoreCheckpoint(save.checkpoint!).phase).toBe('complete')
    save = updateGameCheckpoint(save, advanceCheckpoint(save.checkpoint!, { type: 'reset' }))
    expect(save.completed).toEqual(['l1-1'])
    expect(save.checkpoint!.hintCount).toBe(0)
    expect(save.checkpoint!.actions).toEqual([])
    expect(restoreCheckpoint(save.checkpoint!).phase).toBe('predict')
  })

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
