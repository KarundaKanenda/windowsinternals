import { useId, useRef, useState } from 'react'
import { allScenes } from './scenes'
import { maxSaveBytes, parseGameSave, restoreCheckpoint, type GameSave } from './gameSave'

export function SaveControls({ save, onRestore }: { save: GameSave; onRestore: (save: GameSave) => void }) {
  const input = useRef<HTMLInputElement>(null)
  const request = useRef(0)
  const helpId = useId()
  const previewHeading = useRef<HTMLHeadingElement>(null)
  const importButton = useRef<HTMLButtonElement>(null)
  const [candidate, setCandidate] = useState<GameSave | null>(null)
  const [reading, setReading] = useState(false)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const active = candidate?.checkpoint
  const state = active ? restoreCheckpoint(active) : null
  const mission = allScenes.find(scene => scene.id === active?.sceneId)

  function exportSave() {
    setError('')
    try {
      const validated = parseGameSave(JSON.stringify(save))
      const blob = new Blob([JSON.stringify(validated)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      try {
        link.href = url
        link.download = `windows-internals-save-${new Date().toISOString().slice(0, 10)}.json`
        document.body.append(link)
        link.click()
      } finally {
        link.remove()
        setTimeout(() => URL.revokeObjectURL(url), 1000)
      }
      setStatus('Backup download started. Keep the file outside browser storage; export again after making more progress.')
    } catch (cause) {
      setError(`Could not export save: ${cause instanceof Error ? cause.message : String(cause)}`)
    }
  }

  async function readFile(file: File) {
    const id = ++request.current
    setCandidate(null)
    setError('')
    setStatus('')
    setReading(true)
    try {
      if (file.size > maxSaveBytes) throw new Error('File is too large. Maximum 2 MB.')
      const parsed = parseGameSave(await file.text())
      if (id !== request.current) return
      setCandidate(parsed)
      setStatus('Save validated. Review the replacement before confirming.')
      requestAnimationFrame(() => previewHeading.current?.focus())
    } catch (cause) {
      if (id === request.current) setError(`Could not import save: ${cause instanceof Error ? cause.message : String(cause)}`)
    } finally {
      if (id === request.current) setReading(false)
    }
  }

  function cancelImport() {
    request.current++
    setCandidate(null)
    setReading(false)
    setStatus('Import cancelled. Your game was not changed.')
    importButton.current?.focus()
  }

  return (
    <section className="save-controls panel" aria-label="Game backups">
      <div className="save-actions">
        <strong>Keep a portable backup</strong>
        <button className="button secondary" onClick={exportSave}>Export save</button>
        <button ref={importButton} className="button secondary" aria-describedby={helpId} onClick={() => input.current?.click()}>Import save</button>
        <input ref={input} type="file" accept=".json,application/json" aria-label="Choose a game save" hidden onChange={event => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (file) void readFile(file)
        }} />
      </div>
      <p id={helpId}>Completed missions and your current campaign investigation. JSON only. Maximum 2 MB. No account or cloud upload.</p>
      {reading && <p role="status">Reading save file...</p>}
      {error && <p role="alert">{error} Your current game was not changed.</p>}
      {status && <p role="status">{status}</p>}
      {candidate && (
        <div className="save-preview">
          <h2 ref={previewHeading} tabIndex={-1}>Replace your current game?</h2>
          <p>This backup contains {candidate.completed.length} / 40 completed missions.</p>
          <p>{active && state
            ? `Resume ${mission?.title}: ${state.phase === 'complete' ? 'Verified' : `${state.mode === 'transfer' ? 'Transfer' : 'Guided investigation'}: ${state.phase}`}.`
            : 'No investigation in progress.'}</p>
          <p>Confirming replaces current mastery and the investigation checkpoint. Export your current game first if you want to keep both.</p>
          <div className="save-actions">
            <button className="button primary" onClick={() => {
              request.current++
              onRestore(candidate)
              setCandidate(null)
              setStatus('Save restored.')
            }}>Confirm replacement</button>
            <button className="button secondary" onClick={cancelImport}>Cancel import</button>
          </div>
        </div>
      )}
      {reading && <button className="button secondary" onClick={cancelImport}>Cancel import</button>}
    </section>
  )
}
