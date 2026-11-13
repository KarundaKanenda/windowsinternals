import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import App from './App'
import briefing from './briefing/level1.json'
import { LevelBriefing, LevelBriefingPlayer } from './LevelBriefing'

afterEach(() => vi.unstubAllEnvs())

describe('optional Level 1 briefing', () => {
  it('starts collapsed without creating or eagerly loading media', () => {
    const html = renderToStaticMarkup(<LevelBriefing />)

    expect(html).toContain('Watch Level 1 briefing')
    expect(html).toContain('aria-expanded="false"')
    expect(html).toContain('5 min')
    expect(html).toContain('Optional')
    expect(html).toContain('AI-authored')
    expect(html).toContain('synthetic narration')
    expect(html).toContain('does not unlock mastery')
    expect(html).not.toMatch(/<video|<source|<track|autoPlay|autoplay|intro\.mp4/)
  })

  it('leaves the first mission available without watching', () => {
    const html = renderToStaticMarkup(<App />)

    expect(html).toContain('Watch Level 1 briefing')
    expect(html).toContain('Enter First Contact')
    expect(html.indexOf('Watch Level 1 briefing')).toBeLessThan(html.indexOf('journey-banner'))
    expect(html).not.toContain('<video')
  })

  it('uses accessible native media, captions, speed and metadata-gated chapters', () => {
    const html = renderToStaticMarkup(
      <LevelBriefingPlayer playbackRate={1.25} onPlaybackRateChange={() => {}} onClose={() => {}} />,
    )

    expect(html).toMatch(/<video[^>]*controls=""/)
    expect(html).toMatch(/<video[^>]*playsInline=""/)
    expect(html).toMatch(/<video[^>]*preload="metadata"/)
    expect(html).toMatch(/<video[^>]*aria-label="Level 1 briefing:/)
    expect(html).toContain(`poster="${briefing.poster}"`)
    expect(html).toContain(`src="${briefing.video}" type="video/mp4"`)
    expect(html).toMatch(/<track[^>]*kind="captions"[^>]*srcLang="en"[^>]*label="English"[^>]*default=""/)
    expect(html).not.toMatch(/autoPlay|autoplay/)
    expect(html).toContain('<label for="level-1-briefing-speed">Playback speed</label>')
    for (const rate of [0.75, 1, 1.25, 1.5]) expect(html).toContain(`value="${rate}"`)
    expect(html).toContain('value="1.25" selected=""')
    expect(html.match(/<button[^>]*disabled=""/g)).toHaveLength(briefing.chapters.length)
    expect(html).toContain('Download transcript')
    for (const chapter of briefing.chapters) {
      expect(html).toContain(chapter.title)
      for (const paragraph of chapter.narration) {
        expect(html).toContain(paragraph.replaceAll('&', '&amp;').replaceAll("'", '&#x27;').replaceAll('"', '&quot;'))
      }
    }
    for (const source of briefing.sources) expect(html).toContain(`href="${source.url}"`)
  })

  it('honors the deployment base for every static media asset', () => {
    vi.stubEnv('BASE_URL', '/training/')
    const html = renderToStaticMarkup(
      <LevelBriefingPlayer playbackRate={1} onPlaybackRateChange={() => {}} onClose={() => {}} />,
    )

    for (const asset of [briefing.video, briefing.poster, briefing.captions]) {
      expect(html).toContain(`/training${asset}`)
    }
    expect(html).toContain('4:35')
  })

  it('represents native playback rates outside the speed presets accurately', () => {
    for (const playbackRate of [2, 1.1]) {
      const html = renderToStaticMarkup(
        <LevelBriefingPlayer playbackRate={playbackRate} onPlaybackRateChange={() => {}} onClose={() => {}} />,
      )

      expect(html).toContain(`value="${playbackRate}" selected=""`)
      expect(html).not.toContain('value="1" selected=""')
    }
  })
})
