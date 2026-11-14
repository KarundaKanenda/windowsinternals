import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { campaign } from './campaign'
import { allScenes, coreScenes, capstoneScenes } from './scenes'
import { isUnlocked } from './progress'
import { loadGameSave, newCheckpoint, persistGameSave, updateGameCheckpoint, type GameSave } from './gameSave'
import { ScenePlayer } from './ScenePlayer'
import { LevelBriefing } from './LevelBriefing'
import { SaveControls } from './SaveControls'
import './App.css'

const FirstContact = lazy(() => import('./FirstContact'))
const chapterTags = ['First discoveries', 'Bring work to life', 'Restore coordination', 'Make memory visible', 'Deliver safely', 'Workstation rescue']

function App() {
  const [saved, setSaved] = useState(loadGameSave)
  const currentSave = useRef(saved)
  const progress = { ...saved, completed: saved.save.completed }
  const [level, setLevel] = useState(() => {
    const active = allScenes.find(scene => scene.id === saved.save.checkpoint?.sceneId)
    if (active) return active.level
    const first = allScenes.find(scene => !progress.completed.includes(scene.id))
    return first?.level ?? 6
  })
  const [selectedId, setSelectedId] = useState<string | null>(saved.save.checkpoint?.sceneId ?? null)
  const [page, setPage] = useState<'journey' | 'notebook' | 'advanced'>('journey')
  const [practice, setPractice] = useState(false)
  const [restoration, setRestoration] = useState(0)
  const mainRef = useRef<HTMLElement>(null)
  const returnFocus = useRef<string | null>(null)
  const scene = allScenes.find(item => item.id === selectedId)
  const chapter = campaign[level - 1]
  const scenes = level === 6 ? capstoneScenes : coreScenes.filter(item => item.level === level)
  const mastered = scenes.filter(item => progress.completed.includes(item.id)).length
  const next = allScenes.find(item => !progress.completed.includes(item.id) && isUnlocked(item.id, progress.completed))
  const coreMastery = coreScenes.filter(item => progress.completed.includes(item.id)).length

  function storeGame(save: GameSave, replace = false) {
    const previous = currentSave.current
    const writable = replace || previous.writable
    let error = replace ? '' : previous.error
    if (writable) {
      try {
        persistGameSave(save)
        error = ''
      } catch (cause) {
        error = `Game updated for this session, but could not be saved: ${cause instanceof Error ? cause.message : String(cause)}. Export a backup before leaving.`
      }
    }
    const next = { save, error, writable }
    currentSave.current = next
    setSaved(next)
  }

  function restoreGame(save: GameSave) {
    storeGame(save, true)
    const checkpointScene = allScenes.find(item => item.id === save.checkpoint?.sceneId)
    const firstUnfinished = allScenes.find(item => !save.completed.includes(item.id))
    setLevel(checkpointScene?.level ?? firstUnfinished?.level ?? 6)
    setSelectedId(save.checkpoint?.sceneId ?? null)
    setPage('journey')
    setRestoration(value => value + 1)
  }

  useEffect(() => {
    if (practice || !returnFocus.current) return
    const target = mainRef.current?.querySelector<HTMLElement>(`[data-focus-id="${returnFocus.current}"]`)
    const focusTarget = target ?? mainRef.current
    focusTarget?.focus()
    returnFocus.current = null
  }, [selectedId, page, level, practice])

  function backToChapter() {
    returnFocus.current = selectedId
    setSelectedId(null)
  }

  function openChapter(number: number) {
    setLevel(number)
    setSelectedId(null)
    setPage('journey')
  }

  function openScene(id: string) {
    const target = allScenes.find(item => item.id === id)
    if (!target) return
    if (isUnlocked(id, currentSave.current.save.completed) && currentSave.current.save.checkpoint?.sceneId !== id) {
      storeGame(updateGameCheckpoint(currentSave.current.save, newCheckpoint(id)))
    }
    setLevel(target.level)
    setSelectedId(id)
    setPage('journey')
  }

  return (
    <>
    {practice && <Suspense fallback={<p className="notice" role="status">Opening the practice workstation…</p>}><FirstContact onExit={() => { returnFocus.current = 'sandbox'; setPractice(false) }} /></Suspense>}
    <div className="app-shell" hidden={practice}>
      <aside className="sidebar">
        <a className="brand" href="#main" onClick={() => openChapter(level)}>
          <span className="brand-mark campaign-brand" aria-hidden="true">IM</span>
          <span>Inside the Machine<small>WINDOWS INTERNALS</small></span>
        </a>
        <div className="sidebar-section-label">YOUR LEARNING PATH</div>
        <nav aria-label="Campaign levels">
          {[...campaign, { title: 'Workstation rescue' }].map((item, index) => {
            const count = allScenes.filter(mission => mission.level === index + 1 && progress.completed.includes(mission.id)).length
            const total = allScenes.filter(mission => mission.level === index + 1).length
            return (
              <button key={item.title} className={`level-nav ${level === index + 1 && page === 'journey' ? 'active' : ''}`} onClick={() => openChapter(index + 1)} aria-current={level === index + 1 && page === 'journey' ? 'page' : undefined}>
                <span className="level-number">{index === 5 ? 'FIN' : `0${index + 1}`}</span>
                <span>{item.title}<small>{count === total ? 'Chapter mastered' : `${count} / ${total} scenes mastered`}</small></span>
              </button>
            )
          })}
        </nav>
        <div className="campaign-tools">
          <button className={`level-nav ${page === 'notebook' ? 'active' : ''}`} onClick={() => { setSelectedId(null); setPage('notebook') }}>Your mastery notebook</button>
          <button className={`level-nav ${page === 'advanced' ? 'active' : ''}`} onClick={() => { setSelectedId(null); setPage('advanced') }}>Advanced Windows scenes <small>Optional / VM environment</small></button>
        </div>
        <div className="sidebar-note"><strong>Small discoveries. Deep understanding.</strong><p>Predict. Try it. Follow the evidence. No timer, no penalty, no VM needed.</p></div>
        <div className="sidebar-footer"><span className="status-dot" /> Browser-only campaign<span>{progress.completed.length} / 40 scenes mastered</span></div>
      </aside>

      <div className="main-shell">
        <header className="topbar">
          <span>TRAINING WORKSTATION <span className="topbar-divider">/</span> {level === 6 ? 'CAPSTONE' : `LEVEL 0${level}`}</span>
          <div className="topbar-right"><span className="pill">NO VM REQUIRED</span><span className="avatar" aria-label={`${progress.completed.length} scenes mastered`}>{progress.completed.length}</span></div>
        </header>
        <main id={practice ? 'campaign-main' : 'main'} ref={mainRef} tabIndex={-1}>
          <SaveControls save={saved.save} onRestore={restoreGame} />
          {progress.error && <div className="notice error" role="alert">{progress.error}{progress.writable && <button className="button secondary" onClick={() => storeGame(currentSave.current.save)}>Retry saving game</button>}</div>}
          {page === 'notebook' ? (
            <section className="campaign-view">
              <div className="eyebrow">YOUR EVIDENCE OF GROWTH</div>
              <h1>A mental model, not a score.</h1>
              <p className="intro">{progress.completed.length} scenes mastered. These concepts stay in your notebook when you reset practice.</p>
              {progress.completed.length === 0 && <div className="notice">Your first discovery is waiting. Complete First Contact to start your notebook.</div>}
              <div className="mastery-notebook">
                {allScenes.filter(item => progress.completed.includes(item.id)).map(item => (
                  <section className="panel journal-scene" key={item.id}>
                    <div className="eyebrow">LEVEL {item.level === 6 ? 'CAPSTONE' : item.level} / MASTERED</div><h2>{item.title}</h2>
                    {item.concepts.map(concept => <details key={concept.term}><summary>{concept.term}</summary><p>{concept.explanation}</p><p>{concept.depth}</p></details>)}
                    <button className="text-button" onClick={() => openScene(item.id)}>Replay this investigation →</button>
                  </section>
                ))}
              </div>
            </section>
          ) : page === 'advanced' ? (
            <section className="campaign-view">
              <div className="eyebrow">OPTIONAL ADVANCED SCENES</div><h1>From models to real Windows.</h1>
              <p className="intro">You can finish the entire campaign without creating a VM. Real Windows observations are a separate, advanced learning path.</p>
              <div className="notice">Environment setup and live labs are not implemented or validated here. This browser does not create VMs, inspect your host, or change protections.</div>
              {campaign.map((item, index) => (
                <section className="panel advanced-scene" key={item.title}><span className="pill muted">ADVANCED / NOT YET VALIDATED</span><h2>Level {index + 1}: {item.title}</h2><p>{item.lab}</p><p className="scope-note">Requires an authorized Windows environment, documented build and tools, bounded exercises, and recovery instructions. Never required for browser mastery.</p></section>
              ))}
              <p className="scope-note">Live kernel debugging and driver development require an isolated disposable VM. Do not disable host protections or experiment on production systems.</p>
            </section>
          ) : scene ? (
            <>
              {isUnlocked(scene.id, progress.completed) ? (
                <ScenePlayer
                  key={`${scene.id}-${restoration}`} scene={scene} mastered={progress.completed.includes(scene.id)}
                  checkpoint={saved.save.checkpoint ?? newCheckpoint(scene.id)}
                  onCheckpointChange={checkpoint => storeGame(updateGameCheckpoint(currentSave.current.save, checkpoint))}
                  onExit={backToChapter}
                />
              ) : (
                <section className="panel locked-briefing">
                  <div className="eyebrow">MISSION BRIEFING / NOT YET UNLOCKED</div><h1>{scene.title}</h1><p>{scene.guided.briefing}</p><div className="objective"><span>WHAT YOU WILL DISCOVER</span><p>{scene.objective}</p></div>
                  <p>Build the earlier concepts first. {scene.level === 6 ? 'Master all 36 core scenes to unlock this rescue.' : `Master "${allScenes[allScenes.indexOf(scene) - 1]?.title}" to unlock this scene.`}</p>
                  {next && <button className="button primary" onClick={() => openScene(next.id)}>Continue with {next.title} →</button>}
                  <button className="button secondary" onClick={backToChapter}>Back to chapter</button>
                </section>
              )}
              {progress.completed.includes(scene.id) && next && <div className="next-discovery panel"><div><span className="eyebrow">NEXT DISCOVERY UNLOCKED</span><h2>{next.title}</h2></div><button className="button primary" onClick={() => openScene(next.id)}>Continue the journey →</button></div>}
              {scene.id === 'l1-1' && <div className="sandbox-link"><button className="text-button" data-focus-id="sandbox" onClick={() => setPractice(true)}>Open the free-launch First Contact practice sandbox →</button><span>Extra experimentation; new mastery is earned in the campaign scene.</span></div>}
            </>
          ) : (
            <section className="campaign-view">
              <div className="eyebrow">WORKSTATION RESCUE / {chapterTags[level - 1]}</div>
              <h1>{chapter?.title ?? 'Put the pieces together.'}</h1>
              <p className="intro">{chapter?.description ?? 'Four unfamiliar investigations. Find the cause, justify a bounded intervention, and verify that the workstation recovers without breaking something else.'}</p>
              {level === 1 && <LevelBriefing />}
              <div className="journey-banner">
                <div><span className="eyebrow">YOUR TRAINING WORKSTATION</span><h2>{progress.completed.length === 40 ? 'The workstation is in good hands.' : 'Every discovery restores part of the machine.'}</h2><p>{coreMastery} / 36 core scenes · {progress.completed.length - coreMastery} / 4 rescue investigations</p></div>
                {next && <button className="button primary" onClick={() => openScene(next.id)}>{progress.completed.length ? 'Continue' : 'Start'}: {next.title} →</button>}
              </div>
              <div className="chapter-progress"><label htmlFor="chapter-progress">{mastered} / {scenes.length} chapter scenes mastered</label><progress id="chapter-progress" value={mastered} max={scenes.length} /></div>
              <div className="learning-pattern">Predict <span>/</span> Experiment <span>/</span> Collect evidence <span>/</span> Explain <span>/</span> Transfer</div>
              <div className="panel mission-list">
                <div className="panel-heading"><h2>{level === 6 ? 'Rescue investigations' : 'Mission sequence'}</h2><span>SELF-PACED / BROWSER ONLY</span></div>
                {scenes.map((item, index) => {
                  const done = progress.completed.includes(item.id)
                  const unlocked = isUnlocked(item.id, progress.completed)
                  return (
                    <div className={`mission-list-row ${done ? 'mastered-row' : ''}`} key={item.id}>
                      <span className="scene-number" aria-hidden="true">{done ? '✓' : String(index + 1).padStart(2, '0')}</span>
                      <div><h3>{item.title}</h3><p>{item.objective}</p><span className={`scene-status ${done ? 'mastered' : ''}`}>{done ? 'Mastered / replay anytime' : unlocked ? 'Ready for discovery' : 'Unlocks after earlier discoveries'}</span></div>
                      <button className={`button ${unlocked ? 'primary' : 'secondary'}`} data-focus-id={item.id} onClick={() => openScene(item.id)} aria-label={`${done ? 'Replay' : unlocked ? 'Enter' : 'Preview'} ${item.title}`}>{done ? 'Replay' : unlocked ? 'Enter mission' : 'View briefing'} →</button>
                    </div>
                  )
                })}
              </div>
              <p className="scope-note">All scenes use labelled teaching models, not live Windows data. Advanced VM labs are optional and never part of these unlocks. Completion records assessed concepts, not professional certification.</p>
            </section>
          )}
        </main>
      </div>
    </div>
    </>
  )
}

export default App
