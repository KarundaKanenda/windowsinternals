import { useReducer, useState } from 'react'
import { campaign } from './campaign'
import { createMission, missionReducer, questions } from './simulation'
import './App.css'

const progressKey = 'windows-internals.first-contact.v1'

function readProgress() {
  try {
    const value = localStorage.getItem(progressKey)
    if (value !== null && value !== 'complete') {
      return { completed: false, error: 'Saved progress is not valid. Starting a fresh mission; your saved record has not been changed.' }
    }
    return { completed: value === 'complete', error: '' }
  } catch (error) {
    return { completed: false, error: `Cannot read saved progress. ${error instanceof Error ? error.message : String(error)}` }
  }
}

type IconName = 'grid' | 'play' | 'file' | 'process' | 'book' | 'check' | 'arrow'

function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, React.ReactNode> = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
    play: <path d="m8 5 11 7-11 7Z" />,
    file: <><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Z" /><path d="M14 3v6h6M8 13h8M8 17h5" /></>,
    process: <><rect x="3" y="4" width="18" height="14" rx="2" /><path d="M8 22h8M12 18v4M7 9h10M7 13h6" /></>,
    book: <><path d="M12 6c-3-3-7-3-10-2v15c3-1 7-1 10 2 3-3 7-3 10-2V4c-3-1-7-1-10 2Z" /><path d="M12 6v15" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
  }
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}

const steps = ['Discover', 'Launch', 'Compare', 'Close', 'Explain']
const guidance = [
  {
    title: 'Start with the program, not the process.',
    text: 'Your workstation has Atlas Notes installed. Before opening it, inspect the executable in the program library. Is anything running yet?',
    objective: 'Inspect atlas-notes.exe in the program library.',
    hint: 'A file can exist on disk without executing. Look at the running-instance count, then select "Inspect executable".',
  },
  {
    title: 'Bring the program to life.',
    text: 'Launch Atlas Notes. A running instance appears in the process explorer. Inspect it and look for its process ID.',
    objective: 'Launch the app, then inspect its process.',
    hint: 'Launching creates a process. Select its row to inspect the PID and the executable it came from.',
  },
  {
    title: 'Same program. Another instance.',
    text: 'Launch a second Atlas Notes instance and inspect it. Compare the image names and PIDs. What stayed the same? What changed?',
    objective: 'Have two instances running and inspect a process.',
    hint: 'Both processes use atlas-notes.exe, but have different PIDs. This demo explicitly supports independent instances.',
  },
  {
    title: 'An instance can finish independently.',
    text: 'Close one of the running instances. Watch the process list and check the program library. Does closing an app uninstall it?',
    objective: 'Close one process while another remains running.',
    hint: 'Select a process, then choose "Close this instance". It exits normally; this is not a forced termination.',
  },
  {
    title: 'Now explain a different application.',
    text: 'You have seen the mechanism. Apply it to PhotoBatch, another program that supports independent instances. No timer, and no penalty for thinking it through.',
    objective: 'Complete the three-question transfer challenge below.',
    hint: 'Separate three things: the executable file, a running instance, and the identifier of that instance.',
  },
  {
    title: 'A foundation you can build on.',
    text: 'You can distinguish a program from a process, reason about independent instances, and identify them by PID. Threads are the next concept, not a prerequisite for this mission.',
    objective: 'Mission complete. Replay the lab or explore the curriculum.',
    hint: 'A process is more than an application window. This first scene deliberately uses a simple one-instance-to-one-process model.',
  },
]

function FirstContact({ onExit }: { onExit: () => void }) {
  const [progress, setProgress] = useState(readProgress)
  const [state, dispatch] = useReducer(missionReducer, progress.completed, createMission)
  const [view, setView] = useState<'mission' | 'campaign'>('mission')
  const [level, setLevel] = useState(0)
  const [showLab, setShowLab] = useState(false)
  const selected = state.processes.find(p => p.pid === state.selectedPid)
  const guide = guidance[state.stage]

  function answer(choice: number) {
    const action = { type: 'answer', choice } as const
    const nextState = missionReducer(state, action)
    dispatch(action)
    if (nextState.stage !== 5 || progress.completed) return
    setProgress({ completed: true, error: '' })
  }

  function openMission() {
    setLevel(0)
    setView('mission')
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#main" onClick={openMission}>
          <span className="brand-mark"><Icon name="grid" size={24} /></span>
          <span>Inside the Machine<small>WINDOWS INTERNALS</small></span>
        </a>
        <div className="sidebar-section-label">YOUR LEARNING PATH</div>
        <nav aria-label="Campaign levels">
          {campaign.map((item, index) => (
            <button key={item.title} className={`level-nav ${level === index ? 'active' : ''}`} onClick={onExit}>
              <span className="level-number">{String(index + 1).padStart(2, '0')}</span>
              <span>{item.title}<small>Return to the browser campaign</small></span>
            </button>
          ))}
        </nav>
        <div className="sidebar-note">
          <Icon name="book" />
          <strong>Understanding before debugging.</strong>
          <p>One concept at a time. No Windows experience required to begin.</p>
        </div>
        <div className="sidebar-footer"><span className="status-dot" /> Local browser simulation<span>Free practice / Chapter 01</span></div>
      </aside>

      <div className="main-shell">
        <header className="topbar">
          <span>LEARNING WORKSPACE <span className="topbar-divider">/</span> LEVEL {String(level + 1).padStart(2, '0')}</span>
          <div className="topbar-right"><span className="pill">SIMULATION MODE</span><span className="avatar" aria-label="Learner">L</span></div>
        </header>
        <main id="main">
          <div className="notice"><button className="text-button" onClick={onExit}>Return to campaign</button><p>Free practice sandbox. Complete the campaign scene's prediction and transfer investigation to earn new mastery.</p></div>
          {progress.error && <div className="notice error" role="alert">{progress.error}</div>}
          {view === 'campaign' ? (
            <section className="campaign-view">
              <div className="eyebrow">CAMPAIGN / CHAPTER {String(level + 1).padStart(2, '0')}</div>
              <h1>{campaign[level].title}</h1>
              <p className="intro">{campaign[level].description}</p>
              <div className="learning-pattern">Discover <span>/</span> Predict <span>/</span> Experiment <span>/</span> Investigate <span>/</span> Optional field lab</div>
              <div className="panel mission-list">
                <div className="panel-heading"><h2>Mission sequence</h2><span>{campaign[level].missions.length} learning scenes</span></div>
                {campaign[level].missions.map(([title, description], index) => (
                  <div className="mission-list-row" key={title}>
                    <span className="scene-number">{String(index + 1).padStart(2, '0')}</span>
                    <div><h3>{title}</h3><p>{description}</p></div>
                    {level === 0 && index === 0
                      ? <button className="button primary" onClick={openMission}>{progress.completed ? 'Replay / review' : 'Enter mission'}<Icon name="arrow" size={16} /></button>
                      : <span className="pill muted">IN DESIGN</span>}
                  </div>
                ))}
              </div>
              <div className="panel field-preview">
                <Icon name="process" size={28} />
                <div><h2>From simulation to Windows</h2><p>{campaign[level].lab}</p><small>VM integration is not implemented. Future labs will specify a tested build, prerequisites, bounded exercises, and recovery instructions.</small></div>
              </div>
              <p className="scope-note">The campaign is the roadmap. Only Level 1 / First Contact is playable in this prototype.</p>
            </section>
          ) : (
            <>
              <section className="mission-hero">
                <div>
                  <div className="eyebrow">CHAPTER 01 <span>/</span> MEET THE OPERATING SYSTEM</div>
                  <h1>First Contact<span className="hero-period">.</span></h1>
                  <p className="intro">A program is on disk. A process is in execution.<br />Make that distinction visible, one experiment at a time.</p>
                </div>
                <div className="mission-meta"><span className="pill teal">{state.stage === 5 ? 'COMPLETED' : 'FOUNDATIONS'}</span><span>Mission 01 of 06</span><span>Self-paced / no timer</span></div>
              </section>

              <ol className="stepper" aria-label="Mission progression">
                {steps.map((step, index) => (
                  <li key={step} className={index < state.stage ? 'done' : index === state.stage ? 'current' : ''} aria-current={index === state.stage ? 'step' : undefined}>
                    <span className="step-circle">{index < state.stage ? <Icon name="check" size={14} /> : index + 1}</span><span>{step}</span>
                  </li>
                ))}
              </ol>

              <div className="workspace-grid">
                <section className="panel workstation" aria-label="Simulated workstation">
                  <div className="panel-heading"><div className="heading-with-icon"><Icon name="process" /><h2>Training workstation</h2></div><span><span className="status-dot" /> ONLINE</span></div>
                  <div className="workstation-summary"><span>LAB-WS01 <span>/</span> application sandbox</span><span>{state.processes.length} running instance{state.processes.length !== 1 ? 's' : ''}</span></div>
                  <div className="program-library">
                    <div className="section-label">PROGRAM LIBRARY <span>DISK</span></div>
                    <div className="program-card">
                      <div className="app-icon"><Icon name="file" size={28} /></div>
                      <div className="program-info"><h3>Atlas Notes</h3><code>atlas-notes.exe</code><span className="installed"><span className="status-dot" /> Installed</span></div>
                      <div className="program-actions">
                        <button className="button secondary" onClick={() => dispatch({ type: 'inspect-program' })}>Inspect executable</button>
                        <button className="button primary" disabled={state.stage === 0 || state.processes.length >= 4} onClick={() => dispatch({ type: 'launch' })}><Icon name="play" size={15} />Launch instance</button>
                      </div>
                    </div>
                    {state.stage >= 1 && <div className="file-facts"><span>FILE LOCATION</span><code>C:\Lab\AtlasNotes\atlas-notes.exe</code><p>This executable remains on disk whether zero, one, or several instances are running.</p></div>}
                    {state.processes.length >= 4 && <p className="limit-note" role="status">This teaching sandbox allows four instances. Close one to launch another.</p>}
                  </div>

                  <div className="process-section">
                    <div className="section-label">PROCESS EXPLORER <span>EXECUTION</span></div>
                    <p className="section-description">Select a row to inspect a running instance.</p>
                    {state.processes.length === 0 ? (
                      <div className="empty-processes"><Icon name="process" size={32} /><strong>No Atlas Notes process is running</strong><p>The program is installed. It has not been started{state.nextPid > 4100 ? ', or its instances have exited' : ''}.</p></div>
                    ) : (
                      <div className="process-table-wrap"><table className="process-table"><caption className="sr-only">Atlas Notes running processes. Inspect a process to see its identity.</caption><thead><tr><th>Image name</th><th>PID</th><th>State</th><th><span className="sr-only">Action</span></th></tr></thead><tbody>
                        {state.processes.map(process => (
                          <tr key={process.pid} className={selected?.pid === process.pid ? 'selected' : ''}>
                            <td><span className="process-image"><Icon name="file" size={16} /><code>{process.image}</code></span></td><td><code>{process.pid}</code></td><td><span className="ready-tag">Active</span></td>
                            <td><button className="text-button" aria-label={`Inspect process ${process.pid}`} onClick={() => dispatch({ type: 'inspect-process', pid: process.pid })}>Inspect <Icon name="arrow" size={14} /></button></td>
                          </tr>
                        ))}
                      </tbody></table></div>
                    )}
                    {selected && <div className="process-inspector">
                      <div><span className="section-label">SELECTED INSTANCE</span><h3>Process {selected.pid}</h3><p>Image: <code>{selected.image}</code></p></div>
                      <button className="button secondary close-button" onClick={() => dispatch({ type: 'close', pid: selected.pid })}>Close this instance</button>
                      <p className="inspector-note">Requests a normal exit in this model. It does not uninstall Atlas Notes. "Active" means the process exists, not that a thread is currently running on a CPU.</p>
                    </div>}
                  </div>
                  <div className="simulation-disclaimer">Teaching model, not live Windows data. Atlas Notes supports independent instances; real applications may reuse a process or create several processes.</div>
                </section>

                <aside className="coach-column" aria-label="Learning guidance">
                  <section className="coach-card">
                    <div className="coach-label"><span className="coach-avatar">M</span><span>YOUR FIELD GUIDE<small>Mechanism before terminology</small></span></div>
                    <h2>{guide.title}</h2><p>{guide.text}</p>
                    <div className="objective"><span>CURRENT OBJECTIVE</span><p>{guide.objective}</p></div>
                    <details key={state.stage} className="hint"><summary>Need a nudge?</summary><p>{guide.hint}</p></details>
                  </section>
                  <section className="panel notebook">
                    <div className="heading-with-icon"><Icon name="book" /><h2>Your mental model</h2></div>
                    {state.stage === 0 ? <p className="muted-copy">Concepts appear here as you encounter them.</p> : <>
                      <div className="concept"><span className="concept-label">PROGRAM</span><p>An executable file containing instructions, stored on disk.</p></div>
                      {state.stage >= 2 && <div className="concept"><span className="concept-label">PROCESS</span><p>A running instance with its own execution context and resources.</p></div>}
                      {state.stage >= 3 && <div className="concept"><span className="concept-label">PID</span><p>An identifier unique among existing processes. It may be reused after a process exits.</p></div>}
                    </>}
                  </section>
                </aside>
              </div>

              {state.stage === 4 && <section className="panel challenge" aria-label="Transfer challenge">
                <div className="eyebrow">TRANSFER CHALLENGE <span>/</span> QUESTION {state.question + 1} OF {questions.length}</div>
                <h2>{questions[state.question].prompt}</h2>
                <div className="answer-options">{questions[state.question].options.map((option, index) => <button key={option} className="answer-option" onClick={() => answer(index)}><span>{String.fromCharCode(65 + index)}</span>{option}</button>)}</div>
                {state.feedback && <p className={`answer-feedback ${state.feedback.startsWith('Correct') ? 'correct' : ''}`} role="status">{state.feedback}</p>}
              </section>}

              {state.stage === 5 && <section className="completion panel" aria-label="Mission complete">
                <span className="completion-icon"><Icon name="check" size={28} /></span>
                <div><div className="eyebrow">MISSION COMPLETE</div><h2>You can now tell a program from a process.</h2><p>You applied the idea to a new scenario, not just the app you practised with. Next in the roadmap: threads and who actually executes the instructions.</p></div>
                <button className="button primary" onClick={onExit}>Return to campaign<Icon name="arrow" size={16} /></button>
              </section>}

              <div className="lower-grid">
                <section className="panel activity-log"><div className="panel-heading"><h2>Observation log</h2><span>LATEST FIRST</span></div><ol aria-live="polite" aria-label="Recent simulation actions">{state.events.map((event, index) => <li key={`${event}-${index}`}><span className="log-dot" /><span>{event}</span></li>)}</ol></section>
                <section className="panel field-lab">
                  <span className="eyebrow">OPTIONAL FIELD OBSERVATION</span><h2>Find a process on real Windows.</h2><p>Connect the simulation to Task Manager. This is a manual, read-only exercise; no VM is launched by this browser.</p>
                  <button className="text-button" aria-expanded={showLab} onClick={() => setShowLab(!showLab)}>{showLab ? 'Hide observation guide' : 'Read observation guide'}<Icon name="arrow" size={16} /></button>
                  {showLab && <div className="lab-instructions"><p><strong>Prerequisite:</strong> A Windows 11 machine or disposable VM you are allowed to use. Save your work first. Labels may vary by Windows build.</p><ol><li>Open Task Manager and select Details.</li><li>Launch a harmless application you recognise.</li><li>Find its executable name and PID. Some applications use several processes; do not assume one window equals one process.</li><li>Close the application using its own normal Close command. Observe what changes. Do not use End task on unfamiliar processes.</li></ol><p>Write down one observation that agrees with the simulation and any behaviour that differs.</p></div>}
                </section>
              </div>
              <footer className="mission-footer">
                <span>Grounded in <a href="https://learn.microsoft.com/en-us/windows/win32/procthread/about-processes-and-threads" target="_blank" rel="noreferrer">Microsoft's process and thread documentation</a>.</span>
                <button className="text-button" onClick={() => dispatch({ type: 'reset' })}>Reset practice{progress.completed ? ' (completion retained)' : ''}</button>
              </footer>
            </>
          )}
        </main>
      </div>
    </div>
  )
}

export default FirstContact
