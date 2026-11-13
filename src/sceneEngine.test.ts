import { describe, expect, it } from 'vitest'
import type { Experiment, Scene } from './scenes/types'
import { createSceneState, sceneReducer, type SceneState } from './sceneEngine'

const graph: Experiment = {
  briefing: 'Investigate a fictional worker.',
  prediction: {
    prompt: 'What happens?',
    options: ['It waits', 'It runs'],
    correct: 1,
    explanation: 'An available worker can run.',
  },
  initial: 'start',
  nodes: {
    start: {
      title: 'Ready', description: 'Choose a route.',
      evidence: [{ id: 'worker', label: 'Worker', value: 'ready', detail: 'Ready to run.' }],
      actions: [
        { id: 'run', label: 'Run', next: 'done', log: 'Worker ran.' },
        { id: 'detour', label: 'Wait', next: 'wait', log: 'Worker waited.' },
      ],
    },
    wait: {
      title: 'Waiting', description: 'Recover.',
      evidence: [
        { id: 'worker', label: 'Worker', value: 'waiting', detail: 'Waiting for work.' },
        { id: 'wait-record', label: 'Wait record', value: 'one wait', detail: 'Observed only on the detour.' },
      ],
      actions: [{ id: 'recover', label: 'Recover', next: 'start', log: 'Worker recovered.' }],
      assess: true,
    },
    done: {
      title: 'Finished', description: 'Explain the observation.',
      evidence: [
        { id: 'worker', label: 'Worker', value: 'finished', detail: 'Ran to completion.' },
        { id: 'result', label: 'Output', value: 'saved', detail: 'The worker produced output.' },
      ],
      actions: [],
      assess: true,
    },
  },
  investigation: {
    prompt: 'Which mechanism explains this?',
    options: ['Workers execute tasks', 'Images execute themselves'],
    correct: 0,
    explanation: 'A worker executed the task and saved output.',
    requiredEvidence: ['worker', 'result'],
  },
}

const scene: Scene = {
  id: 'fixture', level: 1, title: 'Worker trail', objective: 'Explain execution.',
  icon: '◇', guided: graph,
  transfer: {
    ...graph,
    initial: 'start',
    nodes: {
      ...graph.nodes,
      start: {
        ...graph.nodes.start,
        evidence: [{ id: 'transfer-only', label: 'New workload', value: 'ready', detail: 'A changed task.' }],
      },
    },
  },
  concepts: [], hints: [], sources: [], simplification: 'Bounded fictional model.',
}

const reduce = (state: SceneState, action: Parameters<typeof sceneReducer>[2]) =>
  sceneReducer(scene, state, action)
const predicted = () => reduce(createSceneState(scene), { type: 'predict', choice: 1 })
const observed = () => reduce(predicted(), { type: 'act', actionId: 'run' })
const explaining = () => reduce(observed(), { type: 'assess' })
const pass = (state: SceneState) =>
  reduce(state, { type: 'explain', choice: 0, evidenceIds: ['result', 'worker'] })

describe('scene gates', () => {
  it('blocks actions and explanations until a valid prediction is recorded', () => {
    const initial = createSceneState(scene)
    expect(reduce(initial, { type: 'act', actionId: 'run' }).feedback?.code).toBe('wrong-stage')
    expect(reduce(initial, { type: 'explain', choice: 0, evidenceIds: [] }).phase).toBe('predict')
    for (const choice of [-1, 2, NaN, 0.5]) {
      const rejected = reduce(initial, { type: 'predict', choice })
      expect(rejected.feedback?.code).toBe('invalid-choice')
      expect(rejected.prediction).toBeNull()
      expect(rejected.phase).toBe('predict')
    }
  })

  it('keeps a wrong prediction as a hypothesis and lets the learner experiment without penalty', () => {
    const state = reduce(createSceneState(scene), { type: 'predict', choice: 0 })
    expect(state.prediction).toBe(0)
    expect(state.phase).toBe('experiment')
    const next = reduce(state, { type: 'act', actionId: 'run' })
    expect(next.feedback?.kind).toBe('info')
    expect(next.feedback?.message).toContain(graph.prediction.explanation)
    expect(next.nodeId).toBe('done')
  })

  it('executes only current actions and rejects broken graph targets explicitly', () => {
    const state = predicted()
    const invalid = reduce(state, { type: 'act', actionId: 'recover' })
    expect(invalid.feedback?.code).toBe('unavailable-action')
    expect(invalid.nodeId).toBe('start')
    expect(invalid.log).toEqual([])
    const brokenScene = {
      ...scene,
      guided: { ...graph, nodes: { ...graph.nodes, done: undefined } },
    } as unknown as Scene
    const broken = sceneReducer(brokenScene, state, { type: 'act', actionId: 'run' })
    expect(broken.feedback?.code).toBe('invalid-node')
    expect(broken.nodeId).toBe('start')
  })

  it('requires an assessment node and all required observations; detours can recover', () => {
    const state = predicted()
    expect(reduce(state, { type: 'assess' }).feedback?.code).toBe('not-assessable')
    const detour = reduce(state, { type: 'act', actionId: 'detour' })
    expect(reduce(detour, { type: 'assess' }).feedback?.code).toBe('missing-observations')
    const recovered = reduce(detour, { type: 'act', actionId: 'recover' })
    const finished = reduce(recovered, { type: 'act', actionId: 'run' })
    expect(reduce(finished, { type: 'assess' }).phase).toBe('explain')
    expect(finished.observed['wait-record'].value).toBe('one wait')
    expect(finished.observed.worker.value).toBe('finished')
    expect(finished.log.map(entry => entry.actionId)).toEqual(['detour', 'recover', 'run'])
    expect(finished.log[0]).toMatchObject({ from: 'start', to: 'wait', message: 'Worker waited.' })
  })

  it('keeps all observations by ID and updates snapshots without mutating old states or content', () => {
    const initial = createSceneState(scene)
    const before = JSON.stringify(initial)
    const contentBefore = JSON.stringify(scene)
    const next = reduce(reduce(initial, { type: 'predict', choice: 1 }), { type: 'act', actionId: 'run' })
    expect(next.observed.worker.value).toBe('finished')
    expect(next.observed.result.value).toBe('saved')
    expect(initial.observed.worker.value).toBe('ready')
    expect(JSON.stringify(initial)).toBe(before)
    expect(JSON.stringify(scene)).toBe(contentBefore)
    expect(next.observed.worker).not.toBe(graph.nodes.done.evidence[0])
  })

  it('rejects invalid mechanism choices, missing, extra, duplicate and unobserved evidence', () => {
    const state = explaining()
    const cases = [
      { choice: 2, evidenceIds: ['worker', 'result'], code: 'invalid-choice' },
      { choice: 0, evidenceIds: ['worker'], code: 'incorrect-evidence' },
      { choice: 0, evidenceIds: ['worker', 'result', 'unknown'], code: 'unobserved-evidence' },
      { choice: 0, evidenceIds: ['worker', 'result', 'worker'], code: 'invalid-evidence' },
      { choice: 1, evidenceIds: ['worker', 'result'], code: 'incorrect-mechanism' },
    ]
    for (const { choice, evidenceIds, code } of cases) {
      const rejected = reduce(state, { type: 'explain', choice, evidenceIds })
      expect(rejected.feedback?.code).toBe(code)
      expect(rejected.phase).toBe('explain')
      expect(rejected.feedback?.kind).toBe('error')
    }
    const extraObserved = {
      ...state,
      observed: { ...state.observed, extra: { id: 'extra', label: 'Extra', value: 'x', detail: 'Not relevant.' } },
    }
    expect(reduce(extraObserved, {
      type: 'explain', choice: 0, evidenceIds: ['worker', 'result', 'extra'],
    }).feedback?.code).toBe('incorrect-evidence')
    expect(pass(state).mode).toBe('transfer')
  })

  it('allows returning to experimentation for more observations after an explanation retry', () => {
    const state = reduce(explaining(), { type: 'explain', choice: 1, evidenceIds: ['worker', 'result'] })
    const returned = reduce(state, { type: 'resume' })
    expect(returned.phase).toBe('experiment')
    expect(returned.observed).toEqual(state.observed)
    expect(returned.prediction).toBe(1)
    expect(reduce(returned, { type: 'assess' }).phase).toBe('explain')
  })

  it('explains the scene-specific causal support when a correct mechanism omits evidence', () => {
    const state = explaining()
    const rejected = reduce(state, {
      type: 'explain', choice: 0, evidenceIds: ['worker'],
    })
    expect(rejected.feedback).toMatchObject({ kind: 'error', code: 'incorrect-evidence' })
    expect(rejected.feedback?.message).toContain(graph.investigation.explanation)
    expect(rejected.feedback?.message).toContain(state.observed.result.label)
    expect(rejected.feedback?.message).toContain(state.observed.result.detail)
    expect(rejected.phase).toBe('explain')
    expect(rejected.observed).toEqual(state.observed)
    expect(pass(rejected).mode).toBe('transfer')
  })

  it('gives identical rejected submissions distinct announcement occurrences without advancing gates', () => {
    const state = explaining()
    const action = { type: 'explain', choice: 0, evidenceIds: ['worker'] } as const
    const first = reduce(state, { ...action, evidenceIds: [...action.evidenceIds] })
    const repeated = reduce(first, { ...action, evidenceIds: [...action.evidenceIds] })
    expect(first.feedback).toHaveProperty('occurrence')
    expect(repeated.feedback?.occurrence).toBe(first.feedback!.occurrence + 1)
    expect(repeated.feedback?.message).toBe(first.feedback?.message)
    expect(repeated.feedback?.code).toBe('incorrect-evidence')
    expect(repeated).toMatchObject({
      mode: state.mode, phase: state.phase, nodeId: state.nodeId, prediction: state.prediction,
      observed: state.observed, log: state.log,
    })
    expect(first.feedback?.occurrence).toBe(state.feedback!.occurrence + 1)
    expect(pass(repeated).mode).toBe('transfer')
  })

  it('clears evidence between guided and transfer and requires every transfer gate', () => {
    const transfer = pass(explaining())
    expect(transfer).toMatchObject({ mode: 'transfer', phase: 'predict', prediction: null, log: [] })
    expect(Object.keys(transfer.observed)).toEqual(['transfer-only'])
    expect(reduce(transfer, { type: 'act', actionId: 'run' }).feedback?.code).toBe('wrong-stage')
    expect(reduce(transfer, { type: 'assess' }).phase).toBe('predict')
    const transferObserved = reduce(reduce(transfer, { type: 'predict', choice: 0 }), {
      type: 'act', actionId: 'run',
    })
    expect(transferObserved.phase).toBe('experiment')
    expect(transferObserved.observed['transfer-only'].value).toBe('ready')
    const complete = pass(reduce(transferObserved, { type: 'assess' }))
    expect(complete.phase).toBe('complete')
    expect(reduce(complete, { type: 'explain', choice: 0, evidenceIds: ['worker', 'result'] })
      .feedback?.code).toBe('wrong-stage')
  })

  it('resets the entire practice run without skipping gates', () => {
    const transfer = pass(explaining())
    const complete = pass(reduce(reduce(reduce(transfer, { type: 'predict', choice: 1 }), {
      type: 'act', actionId: 'run',
    }), { type: 'assess' }))
    expect(reduce(complete, { type: 'reset' })).toEqual(createSceneState(scene))
    expect(reduce(transfer, { type: 'reset' })).toEqual(createSceneState(scene))
  })

  it('reports malformed initial nodes and unknown operations instead of accepting them', () => {
    const invalidInitial = { ...scene, guided: { ...graph, initial: 'missing' } }
    expect(() => createSceneState(invalidInitial)).toThrow('The guided model has no initial state.')
    const invalidTransfer = { ...scene, transfer: { ...scene.transfer, initial: 'missing' } }
    const rejected = sceneReducer(invalidTransfer, explaining(), {
      type: 'explain', choice: 0, evidenceIds: ['worker', 'result'],
    })
    expect(rejected.feedback?.code).toBe('invalid-node')
    expect(rejected.phase).toBe('explain')
    const unknown = { type: 'skip-to-completion' } as unknown as Parameters<typeof sceneReducer>[2]
    expect(reduce(predicted(), unknown).feedback?.code).toBe('invalid-action')
  })
})
