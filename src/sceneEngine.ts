import type { Evidence, Experiment, Scene } from './scenes/types'

export type ScenePhase = 'predict' | 'experiment' | 'explain' | 'complete'
export type SceneMode = 'guided' | 'transfer'
export interface SceneFeedback {
  kind: 'info' | 'success' | 'error'
  code: string
  message: string
  occurrence: number
}
export interface SceneLogEntry {
  mode: SceneMode
  from: string
  to: string
  actionId: string
  message: string
}
export interface SceneState {
  mode: SceneMode
  phase: ScenePhase
  nodeId: string
  prediction: number | null
  observed: Record<string, Evidence>
  log: SceneLogEntry[]
  feedback: SceneFeedback | null
}
export type SceneEngineAction =
  | { type: 'predict'; choice: number }
  | { type: 'act'; actionId: string }
  | { type: 'assess' }
  | { type: 'explain'; choice: number; evidenceIds: string[] }
  | { type: 'resume' }
  | { type: 'reset' }

export class SceneEngineError extends Error {
  readonly code: string
  constructor(code: string, message: string) {
    super(message)
    this.name = 'SceneEngineError'
    this.code = code
  }
}

const hasNode = (experiment: Experiment, nodeId: string) =>
  Object.hasOwn(experiment.nodes, nodeId) && Boolean(experiment.nodes[nodeId])

const snapshot = (evidence: Evidence[]) =>
  Object.fromEntries(evidence.map(item => [item.id, { ...item }]))

function initialState(scene: Scene, mode: SceneMode): SceneState {
  const experiment = scene[mode]
  if (!hasNode(experiment, experiment.initial)) {
    throw new SceneEngineError('invalid-node', `The ${mode} model has no initial state.`)
  }
  return {
    mode, phase: 'predict', nodeId: experiment.initial,
    prediction: null, observed: snapshot(experiment.nodes[experiment.initial].evidence),
    log: [], feedback: null,
  }
}

/** Start a fresh practice run. Mastery persistence is intentionally owned by the campaign. */
export function createSceneState(scene: Scene): SceneState {
  return initialState(scene, 'guided')
}

const reject = (state: SceneState, code: string, message: string): SceneState => ({
  ...state, feedback: { kind: 'error', code, message, occurrence: (state.feedback?.occurrence ?? 0) + 1 },
})

const validChoice = (options: string[], choice: number) =>
  Number.isInteger(choice) && choice >= 0 && choice < options.length

/** Pure, immutable gates: predict → act/assess → explain, repeated for transfer.
 * Rejections preserve model state and return a structured error in feedback.
 * Feedback occurrences advance even for identical messages, enabling live-region updates.
 * `explain` submits the mechanism index and exact selected observation IDs together.
 */
export function sceneReducer(
  scene: Scene,
  state: SceneState,
  action: SceneEngineAction,
): SceneState {
  if (action.type === 'reset') return createSceneState(scene)
  const experiment = scene[state.mode]
  if (!hasNode(experiment, state.nodeId)) {
    return reject(state, 'invalid-node', 'The current model state is unavailable. Reset practice to recover.')
  }
  const node = experiment.nodes[state.nodeId]
  switch (action.type) {
    case 'predict': {
      if (state.phase !== 'predict') return reject(state, 'wrong-stage', 'Record a prediction only at the prediction step.')
      if (!validChoice(experiment.prediction.options, action.choice)) {
        return reject(state, 'invalid-choice', 'Choose one of the available predictions.')
      }
      return {
        ...state, phase: 'experiment', prediction: action.choice,
        feedback: {
          kind: 'info', code: 'hypothesis-recorded',
          message: 'Hypothesis recorded. Test it against the model; a changed prediction costs nothing.',
          occurrence: (state.feedback?.occurrence ?? 0) + 1,
        },
      }
    }
    case 'act': {
      if (state.phase !== 'experiment' || state.prediction === null) {
        return reject(state, 'wrong-stage', 'Record a prediction before changing the model.')
      }
      const selected = node.actions.find(item => item.id === action.actionId)
      if (!selected) return reject(state, 'unavailable-action', 'That action is not available in the current state.')
      if (!hasNode(experiment, selected.next)) {
        return reject(state, 'invalid-node', 'That action has an unavailable destination. Try another route or reset practice.')
      }
      const next = experiment.nodes[selected.next]
      return {
        ...state, nodeId: selected.next,
        observed: { ...state.observed, ...snapshot(next.evidence) },
        log: [...state.log, {
          mode: state.mode, from: state.nodeId, to: selected.next,
          actionId: selected.id, message: selected.log,
        }],
        feedback: {
          kind: 'info', code: 'prediction-comparison',
          message: `${selected.log} Compare with your hypothesis: ${experiment.prediction.explanation}`,
          occurrence: (state.feedback?.occurrence ?? 0) + 1,
        },
      }
    }
    case 'assess': {
      if (state.phase !== 'experiment' || state.prediction === null) {
        return reject(state, 'wrong-stage', 'Predict and investigate before explaining.')
      }
      if (!node.assess) return reject(state, 'not-assessable', 'Follow the model to an investigation checkpoint first.')
      const missing = experiment.investigation.requiredEvidence.filter(id => !Object.hasOwn(state.observed, id))
      if (missing.length) {
        return reject(state, 'missing-observations', 'The evidence trail is incomplete. Explore another available route before explaining.')
      }
      return {
        ...state, phase: 'explain',
        feedback: {
          kind: 'info', code: 'ready-to-explain',
          message: 'Select the observations that support your explanation, then identify the mechanism.',
          occurrence: (state.feedback?.occurrence ?? 0) + 1,
        },
      }
    }
    case 'resume':
      if (state.phase !== 'explain') return reject(state, 'wrong-stage', 'Return to the model from the explanation step.')
      return { ...state, phase: 'experiment', feedback: null }
    case 'explain': {
      if (state.phase !== 'explain' || state.prediction === null) {
        return reject(state, 'wrong-stage', 'Reach the explanation checkpoint before submitting a mechanism.')
      }
      if (!node.assess) return reject(state, 'not-assessable', 'An investigation checkpoint is required.')
      if (!validChoice(experiment.investigation.options, action.choice)) {
        return reject(state, 'invalid-choice', 'Choose one of the available mechanisms.')
      }
      const ids = action.evidenceIds
      if (!Array.isArray(ids) || ids.some(id => typeof id !== 'string') || new Set(ids).size !== ids.length) {
        return reject(state, 'invalid-evidence', 'Select each evidence card only once.')
      }
      if (ids.some(id => !Object.hasOwn(state.observed, id))) {
        return reject(state, 'unobserved-evidence', 'Use only evidence you have actually observed in this experiment.')
      }
      const required = new Set(experiment.investigation.requiredEvidence)
      if (ids.length !== required.size || ids.some(id => !required.has(id))) {
        const missingSupport = [...required].filter(id => !ids.includes(id)).map(id => {
          const evidence = state.observed[id]
          return evidence ? `${evidence.label}: ${evidence.detail}` : id
        })
        return reject(state, 'incorrect-evidence', [
          `Revisit the causal support: ${experiment.investigation.explanation}`,
          missingSupport.length ? `Missing support from your selected case: ${missingSupport.join(' ')}` : '',
          'Include the relevant observations and leave out unrelated cards. You can retry without penalty.',
        ].filter(Boolean).join(' '))
      }
      if (action.choice !== experiment.investigation.correct) {
        return reject(state, 'incorrect-mechanism', `Revisit the causal link: ${experiment.investigation.explanation} You can retry without penalty.`)
      }
      if (state.mode === 'guided') {
        try {
          return {
            ...initialState(scene, 'transfer'),
            feedback: {
              kind: 'success', code: 'guided-passed',
              message: `${experiment.investigation.explanation} Now test the idea in a changed scenario.`,
              occurrence: (state.feedback?.occurrence ?? 0) + 1,
            },
          }
        } catch (error) {
          if (error instanceof SceneEngineError) return reject(state, error.code, error.message)
          throw error
        }
      }
      return {
        ...state, phase: 'complete',
        feedback: {
          kind: 'success', code: 'scene-complete', message: experiment.investigation.explanation,
          occurrence: (state.feedback?.occurrence ?? 0) + 1,
        },
      }
    }
    default:
      return reject(state, 'invalid-action', 'The requested operation is not supported.')
  }
}
