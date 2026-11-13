import { useEffect, useRef, useState } from 'react'
import briefing from './briefing/level1.json'
import './LevelBriefing.css'

function assetUrl(path: string) {
  return `${import.meta.env.BASE_URL.replace(/\/?$/, '/')}${path.replace(/^\//, '')}`
}

function timestamp(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

const transcript = [
  `Level ${briefing.level}: ${briefing.title}`,
  briefing.production,
  ...briefing.chapters.map(chapter => [
    `${timestamp(chapter.startSeconds)} — ${chapter.title}`,
    ...chapter.narration,
  ].join('\n\n')),
  'Sources',
  ...briefing.sources.map(source => `${source.label}: ${source.url}`),
].join('\n\n')

export function LevelBriefing() {
  const [open, setOpen] = useState(false)
  const [playbackRate, setPlaybackRate] = useState(1)
  const watchRef = useRef<HTMLButtonElement>(null)

  function close() {
    setOpen(false)
    // The watch button mounts again when the player closes.
    requestAnimationFrame(() => watchRef.current?.focus())
  }

  return (
    <section className="level-briefing panel" aria-labelledby="level-1-briefing-title">
      <div className="level-briefing-heading">
        <div>
          <div className="eyebrow">OPTIONAL VIDEO PILOT · {briefing.durationSeconds / 60} min</div>
          <h2 id="level-1-briefing-title">{briefing.subtitle}</h2>
        </div>
        {!open && <button ref={watchRef} className="button secondary" aria-expanded={false} aria-controls="level-1-briefing-player" onClick={() => setOpen(true)}>Watch Level 1 briefing</button>}
      </div>
      <p className="level-briefing-notice">Optional: watching does not unlock mastery or replace the investigations.</p>
      <p className="level-briefing-disclosure">{briefing.production}</p>
      {open && <LevelBriefingPlayer playbackRate={playbackRate} onPlaybackRateChange={setPlaybackRate} onClose={close} />}
    </section>
  )
}

type PlayerProps = {
  playbackRate: number
  onPlaybackRateChange: (rate: number) => void
  onClose: () => void
}

export function LevelBriefingPlayer({ playbackRate, onPlaybackRateChange, onClose }: PlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const captionRef = useRef<HTMLTrackElement>(null)
  const [metadataReady, setMetadataReady] = useState(false)
  const [mediaError, setMediaError] = useState(false)
  const [captionError, setCaptionError] = useState(false)
  const speedOptions = [...new Set([0.75, 1, 1.25, 1.5, playbackRate])].sort((a, b) => a - b)

  useEffect(() => {
    const video = videoRef.current
    return () => { video?.pause() }
  }, [])

  useEffect(() => {
    const track = captionRef.current
    if (!track) return
    function captionFailed(event: Event) {
      event.stopPropagation()
      setCaptionError(true)
    }
    function captionLoaded() {
      setCaptionError(false)
    }
    track.addEventListener('error', captionFailed)
    track.addEventListener('load', captionLoaded)
    // A cached failure may finish before this effect subscribes.
    setCaptionError(track.readyState === track.ERROR)
    return () => {
      track.removeEventListener('error', captionFailed)
      track.removeEventListener('load', captionLoaded)
    }
  }, [])

  function mediaFailed() {
    setMediaError(true)
    setMetadataReady(false)
  }

  return (
    <div id="level-1-briefing-player" className="level-briefing-player">
      <div className="level-briefing-toolbar">
        <div className="level-briefing-speed">
          <label htmlFor="level-1-briefing-speed">Playback speed</label>
          <select id="level-1-briefing-speed" value={playbackRate} onChange={event => {
            const rate = Number(event.target.value)
            onPlaybackRateChange(rate)
            if (videoRef.current) videoRef.current.playbackRate = rate
          }}>
            {speedOptions.map(rate => <option value={rate} key={rate}>{rate}×</option>)}
          </select>
        </div>
        <button className="button secondary" aria-expanded={true} aria-controls="level-1-briefing-player" onClick={() => {
          videoRef.current?.pause()
          onClose()
        }}>Close Level 1 briefing</button>
      </div>
      <video
        ref={videoRef}
        controls
        playsInline
        preload="metadata"
        poster={assetUrl(briefing.poster)}
        aria-label={`Level 1 briefing: ${briefing.title}`}
        aria-describedby="level-1-briefing-help"
        onRateChange={event => onPlaybackRateChange(event.currentTarget.playbackRate)}
        onLoadedMetadata={() => {
          if (videoRef.current) videoRef.current.playbackRate = playbackRate
          setMetadataReady(true)
          setMediaError(false)
        }}
        onError={mediaFailed}
      >
        <source src={assetUrl(briefing.video)} type="video/mp4" onError={mediaFailed} />
        <track ref={captionRef} kind="captions" src={assetUrl(briefing.captions)} srcLang="en" label="English" default />
        Your browser does not support this video. <a href={assetUrl(briefing.video)}>Download the video</a> or read the transcript below.
      </video>
      <p id="level-1-briefing-help" className="level-briefing-help">Use the native player controls to play, pause, seek, or enable English captions. Chapter buttons become available when video metadata loads; selecting a chapter does not start playback.</p>
      {mediaError && <div className="notice error" role="alert">The briefing video could not load. Read the full transcript below or download it; the missions remain available.</div>}
      {captionError && <div className="notice error" role="alert">English captions could not load. Read the full transcript below or download it as a text alternative. This caption error does not prevent video playback.</div>}
      <nav className="level-briefing-chapters" aria-label="Briefing chapters">
        <h3>Jump to a chapter</h3>
        <ol>
          {briefing.chapters.map(chapter => <li key={chapter.startSeconds}>
            <button className="text-button" disabled={!metadataReady || mediaError} onClick={() => {
              if (videoRef.current && metadataReady && !mediaError) videoRef.current.currentTime = chapter.startSeconds
            }}><span className="level-briefing-time">{timestamp(chapter.startSeconds)}</span> {chapter.title}</button>
          </li>)}
        </ol>
      </nav>
      <details className="level-briefing-transcript" open={mediaError || captionError || undefined}>
        <summary>Read the full briefing transcript</summary>
        <p>{briefing.summary}</p>
        {briefing.chapters.map(chapter => <section key={chapter.startSeconds}>
          <h3><span className="level-briefing-time">{timestamp(chapter.startSeconds)}</span> {chapter.title}</h3>
          {chapter.narration.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
        </section>)}
        <h3>Sources and further reading</h3>
        <ul>{briefing.sources.map(source => <li key={source.url}><a href={source.url}>{source.label}</a></li>)}</ul>
      </details>
      <a className="text-button" href={`data:text/plain;charset=utf-8,${encodeURIComponent(transcript)}`} download="level-1-briefing-transcript.txt">Download transcript</a>
    </div>
  )
}
