import { useEffect, useId, useMemo, useRef, useState } from 'react'
import type { Check, Evidence, Scene } from './scenes/types'
import {
  type SceneEngineAction, type SceneState,
} from './sceneEngine'
import { advanceCheckpoint, restoreCheckpoint, type CheckDraft, type RunCheckpoint } from './gameSave'
import './ScenePlayer.css'

export interface ScenePlayerProps {
  scene: Scene
  mastered: boolean
  checkpoint: RunCheckpoint
  onCheckpointChange: (checkpoint: RunCheckpoint) => void
  onExit: () => void
}

const steps = [
  'Predict', 'Experiment', 'Explain',
  'Transfer: predict', 'Transfer: experiment', 'Transfer: explain', 'Verified',
]

const phaseIndex = (state: SceneState) =>
  state.phase === 'complete' ? 6
    : (state.mode === 'transfer' ? 3 : 0) + ['predict', 'experiment', 'explain'].indexOf(state.phase)

function EvidenceCard({ evidence }: { evidence: Evidence }) {
  return (
    <article className="scene-evidence-card">
      <span className="scene-card-label">{evidence.label}</span>
      <strong>{evidence.value}</strong>
      <p>{evidence.detail}</p>
    </article>
  )
}

function CheckForm({
  check, evidence, draft, onDraftChange, onSubmit,
}: {
  check: Check
  evidence?: Evidence[]
  draft: CheckDraft
  onDraftChange: (draft: CheckDraft) => void
  onSubmit: (choice: number, evidenceIds: string[]) => void
}) {
  const groupId = useId()
  const { choice, evidenceIds: selected } = draft
  return (
    <form className="scene-check" onSubmit={event => {
      event.preventDefault()
      if (choice !== null) onSubmit(choice, selected)
    }}>
      {evidence && (
        <fieldset className="scene-evidence-selection">
          <legend>Build your evidence case</legend>
          <p>Select only the observed cards that support the mechanism. Earlier observations remain here; revisited cards show their latest snapshot.</p>
          <div className="scene-evidence-grid">
            {evidence.map(item => (
              <label className={`scene-select-card${selected.includes(item.id) ? ' selected' : ''}`} key={item.id}>
                <input
                  type="checkbox"
                  checked={selected.includes(item.id)}
                  onChange={event => onDraftChange({
                    ...draft, evidenceIds: event.target.checked
                      ? [...selected, item.id] : selected.filter(id => id !== item.id),
                  })}
                />
                <span>
                  <span className="scene-card-label">{item.label}</span>
                  <strong>{item.value}</strong>
                  <span className="scene-evidence-detail">{item.detail}</span>
                </span>
              </label>
            ))}
          </div>
          <p className="scene-selection-count">{selected.length} evidence {selected.length === 1 ? 'card' : 'cards'} selected</p>
        </fieldset>
      )}
      <fieldset className="scene-options">
        <legend>{check.prompt}</legend>
        {check.options.map((option, index) => (
          <label className={`scene-option${choice === index ? ' selected' : ''}`} key={`${index}-${option}`}>
            <input
              type="radio" name={groupId} value={index}
              checked={choice === index}
              onChange={() => onDraftChange({ ...draft, choice: index })}
              required
            />
            <span>{option}</span>
          </label>
        ))}
      </fieldset>
      <button className="scene-button primary" disabled={choice === null} type="submit">
        {evidence ? 'Submit evidence + mechanism' : 'Record hypothesis →'}
      </button>
      {choice === null && <span className="scene-form-note">Choose an option to continue.</span>}
    </form>
  )
}

function SceneRun({ scene, mastered, checkpoint, onCheckpointChange, onExit }: ScenePlayerProps) {
  const state = useMemo(() => restoreCheckpoint(checkpoint), [checkpoint])
  const currentCheckpoint = useRef(checkpoint)
  const hintCount = checkpoint.hintCount
  const [attempt, setAttempt] = useState(0)
  const stepHeading = useRef<HTMLHeadingElement>(null)
  const experiment = scene[state.mode]
  const node = experiment.nodes[state.nodeId]
  const currentStep = phaseIndex(state)
  const isComplete = state.phase === 'complete'
  const label = state.mode === 'guided' ? 'Guided investigation' : 'Changed-condition transfer'

  useEffect(() => {
    currentCheckpoint.current = checkpoint
  }, [checkpoint])

  useEffect(() => {
    stepHeading.current?.focus()
  }, [state.mode, state.phase, attempt])

  function update(next: RunCheckpoint) {
    currentCheckpoint.current = next
    onCheckpointChange(next)
  }

  function send(action: SceneEngineAction) {
    update(advanceCheckpoint(currentCheckpoint.current, action))
    if (action.type === 'reset') {
      setAttempt(current => current + 1)
    }
  }

  return (
    <section className="scene-player" aria-label={`${scene.title} mission`}>
      <header className="scene-header">
        <div>
          <p className="scene-kicker">Level {scene.level} · Evidence trail <span aria-hidden="true">{scene.icon}</span></p>
          <h1>{scene.title}<span className="scene-title-dot">.</span></h1>
          <p className="scene-objective">{scene.objective}</p>
        </div>
        <div className="scene-header-actions">
          {(mastered || isComplete) && <span className="scene-mastery">✓ Mastered · replay still requires every gate</span>}
          <div className="scene-button-row">
            <button className="scene-button" onClick={() => send({ type: 'reset' })}>Reset practice</button>
            <button className="scene-button" onClick={onExit}>← Campaign</button>
          </div>
        </div>
      </header>

      <ol className="scene-stepper" aria-label="Mission progress">
        {steps.map((step, index) => (
          <li
            key={step}
            className={index === currentStep ? 'current' : index < currentStep ? 'done' : ''}
            aria-current={index === currentStep ? 'step' : undefined}
          >
            <span className="scene-step-number" aria-hidden="true">{index < currentStep ? '✓' : index + 1}</span>
            <span>{step}</span>
            {index < currentStep && <span className="sr-only"> — completed</span>}
          </li>
        ))}
      </ol>

      <div className="scene-feedback-slot" aria-live="polite" aria-atomic="true">
        {state.feedback && (
          <p className={`scene-feedback ${state.feedback.kind}`}>
            <span className="sr-only">Feedback update {state.feedback.occurrence}. </span>
            <strong>{state.feedback.kind === 'error' ? 'Try another explanation or route. ' : state.feedback.kind === 'success' ? 'Verified! ' : 'Coach: '}</strong>
            {state.feedback.message}
          </p>
        )}
      </div>

      {isComplete ? (
        <section className="scene-celebration">
          <span className="scene-celebration-mark" aria-hidden="true">✓</span>
          <div>
            <p className="scene-kicker">Mechanism verified · transfer passed</p>
            <h2 ref={stepHeading} tabIndex={-1}>You followed the evidence, not just a guess.</h2>
            <p>{scene.objective} Your guided investigation and changed-condition explanation are complete.</p>
            <div className="scene-button-row">
              <button className="scene-button primary" onClick={onExit}>Return to campaign →</button>
              <button className="scene-button" onClick={() => send({ type: 'reset' })}>Run a fresh investigation</button>
            </div>
          </div>
        </section>
      ) : (
        <div className="scene-workspace">
          <div className="scene-main-column">
            <section className="scene-panel">
              <div className="scene-panel-heading">
                <h2 ref={stepHeading} tabIndex={-1}>{label}: {state.phase === 'predict' ? 'predict' : state.phase === 'experiment' ? 'experiment' : 'explain'}</h2>
                <span>Fictional model · {state.phase}</span>
              </div>
              <p className="scene-briefing">{experiment.briefing}</p>
              {state.phase === 'predict' && (
                <div className="scene-panel-body">
                  <p className="scene-instruction">First, make a prediction. The controls unlock after you record it. A wrong prediction is useful evidence about your assumptions, not a penalty.</p>
                  <CheckForm
                    key={`${attempt}-${state.mode}-predict`}
                    check={experiment.prediction}
                    draft={checkpoint.draft}
                    onDraftChange={draft => update({ ...currentCheckpoint.current, draft })}
                    onSubmit={choice => send({ type: 'predict', choice })}
                  />
                </div>
              )}
              {state.prediction !== null && (
                <div className="scene-hypothesis">
                  <span className="scene-card-label">Your recorded hypothesis</span>
                  <p>{experiment.prediction.options[state.prediction]}</p>
                  {(state.log.length > 0 || state.phase === 'explain') && (
                    <p className="scene-comparison">
                      <strong>{state.prediction === experiment.prediction.correct ? 'Prediction aligned. ' : 'Compare and revise — no penalty. '}</strong>
                      {experiment.prediction.explanation}
                    </p>
                  )}
                </div>
              )}
              {state.phase === 'explain' && (
                <div className="scene-panel-body">
                  <CheckForm
                    key={`${attempt}-${state.mode}-explain`}
                    check={experiment.investigation}
                    draft={checkpoint.draft}
                    onDraftChange={draft => update({ ...currentCheckpoint.current, draft })}
                    evidence={Object.values(state.observed)}
                    onSubmit={(choice, evidenceIds) => send({ type: 'explain', choice, evidenceIds })}
                  />
                  <button className="scene-button scene-return" onClick={() => send({ type: 'resume' })}>← Return to experiment</button>
                </div>
              )}
            </section>

            <section className="scene-panel" aria-label="Current model state">
              <div className="scene-panel-heading">
                <h2>{node.title}</h2>
                <span>Current state · {state.nodeId}</span>
              </div>
              <div className="scene-panel-body">
                <p>{node.description}</p>
                <div className="scene-evidence-grid" aria-live="polite" aria-atomic="true">
                  {node.evidence.map(item => <EvidenceCard key={item.id} evidence={item} />)}
                </div>
                <div className="scene-action-area">
                  <h3>Available model actions</h3>
                  {state.phase === 'predict' && <p>Record your hypothesis above before changing this state.</p>}
                  {state.phase === 'explain' && <p>Return to the experiment to explore another route.</p>}
                  <div className="scene-button-row">
                    {node.actions.map(action => (
                      <button
                        key={action.id}
                        className="scene-button action"
                        disabled={state.phase !== 'experiment'}
                        onClick={() => send({ type: 'act', actionId: action.id })}
                      >{action.label} <span aria-hidden="true">→</span></button>
                    ))}
                  </div>
                  {!node.actions.length && <p>This branch has no further actions.</p>}
                  {state.phase === 'experiment' && (
                    <div className="scene-checkpoint">
                      <button className="scene-button primary" onClick={() => send({ type: 'assess' })} disabled={!node.assess}>
                        Build an evidence-backed explanation →
                      </button>
                      <p>{node.assess
                        ? 'At a checkpoint. The engine will check that you have observed the required evidence.'
                        : 'Follow an available route to an investigation checkpoint.'}</p>
                    </div>
                  )}
                </div>
              </div>
            </section>

            <section className="scene-panel scene-trail">
              <div className="scene-panel-heading">
                <h2>Investigation trail</h2>
                <span>{state.log.length} transitions</span>
              </div>
              {!state.log.length ? <p className="scene-panel-body">Your first model action will start the trail. This is not live Windows telemetry.</p> : (
                <ol>
                  {state.log.map((entry, index) => (
                    <li key={index}>
                      <span className="scene-trail-number" aria-hidden="true">{index + 1}</span>
                      <div><p>{entry.message}</p><small>{experiment.nodes[entry.from].title} → {experiment.nodes[entry.to].title}</small></div>
                    </li>
                  ))}
                </ol>
              )}
              {state.phase !== 'explain' && (
                <details className="scene-observations">
                  <summary>Evidence notebook · {Object.keys(state.observed).length} observed cards</summary>
                  <p>All observations from this experiment, with the latest snapshot for each card. Transfer starts a new notebook.</p>
                  <div className="scene-evidence-grid">
                    {Object.values(state.observed).map(item => <EvidenceCard key={item.id} evidence={item} />)}
                  </div>
                </details>
              )}
            </section>
          </div>

          <aside className="scene-coach">
            <section className="scene-coach-card">
              <p className="scene-kicker">Field coach · no timer, no penalties</p>
              <h2>{state.phase === 'predict' ? 'A hypothesis opens the trail.' : state.phase === 'experiment' ? 'Change one thing. Watch the evidence.' : 'Connect observations to a cause.'}</h2>
              <p>{state.mode === 'transfer'
                ? 'The condition has changed. Test the mechanism again rather than reusing the previous answer blindly.'
                : 'Explore contrasting routes if you need to. Completion depends on observations and a supported explanation, not clicking every button.'}</p>
              {scene.hints.length > 0 && (
                <div className="scene-hints">
                  <button className="scene-button" onClick={() => update({
                    ...currentCheckpoint.current, hintCount: Math.min(currentCheckpoint.current.hintCount + 1, scene.hints.length),
                  })} disabled={hintCount >= scene.hints.length}>
                    {hintCount >= scene.hints.length ? 'All hints revealed' : `Reveal hint ${hintCount + 1} of ${scene.hints.length}`}
                  </button>
                  <ol aria-live="polite">
                    {scene.hints.slice(0, hintCount).map((hint, index) => <li key={index}>{hint}</li>)}
                  </ol>
                </div>
              )}
            </section>
            <ConceptNotebook scene={scene} />
          </aside>
        </div>
      )}
      {isComplete && <ConceptNotebook scene={scene} />}

      <footer className="scene-model-note">
        <strong>Fictional training model — not live OS evidence.</strong>
        <p>This branching scenario is a bounded, deterministic teaching model, not a full Windows emulator. It does not inspect or change your computer. {scene.simplification}</p>
        {scene.sources.length > 0 && (
          <nav aria-label="Mission source references">
            <span>Reference reading:</span>
            {scene.sources.map(source => <a key={source.url} href={source.url} target="_blank" rel="noreferrer">{source.label} <span className="sr-only">(opens in a new tab)</span>↗</a>)}
          </nav>
        )}
      </footer>
    </section>
  )
}

function ConceptNotebook({ scene }: { scene: Scene }) {
  return (
    <section className="scene-panel scene-concepts">
      <h2>Mechanism notebook</h2>
      {scene.concepts.map(concept => (
        <article key={concept.term}>
          <h3>{concept.term}</h3>
          <p>{concept.explanation}</p>
          <details><summary>Go deeper: {concept.term}</summary><p>{concept.depth}</p></details>
        </article>
      ))}
    </section>
  )
}

/** A scene ID change starts a fresh run; persisted mastery never bypasses its gates. */
export function ScenePlayer(props: ScenePlayerProps) {
  return <SceneRun key={props.scene.id} {...props} />
}
