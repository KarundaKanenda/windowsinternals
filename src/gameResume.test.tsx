import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import App from './App'
import { gameSaveKey, type GameSave } from './gameSave'

afterEach(() => vi.unstubAllGlobals())

describe('saved investigation rendering', () => {
  it('offers portable saves even without browser storage', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => { throw new Error('Storage disabled') },
    })
    const html = renderToStaticMarkup(<App />)
    expect(html).toContain('Export save')
    expect(html).toContain('Import save')
    expect(html).toContain('Storage disabled')
    expect(html).toContain('Maximum 2 MB')
  })

  it('reopens the saved mission with partial answer and hints selected', () => {
    const save: GameSave = {
      version: 1, contentVersion: 1, completed: [],
      checkpoint: {
        sceneId: 'l1-1', hintCount: 2,
        actions: [
          { type: 'predict', choice: 1 },
          { type: 'act', actionId: 'launch-first' },
          { type: 'act', actionId: 'launch-second' },
          { type: 'act', actionId: 'close-second' },
          { type: 'assess' },
        ],
        draft: { choice: 1, evidenceIds: ['two-pids'] },
      },
    }
    vi.stubGlobal('localStorage', { getItem: (key: string) => key === gameSaveKey ? JSON.stringify(save) : null })
    const html = renderToStaticMarkup(<App />)
    expect(html).toContain('Guided investigation: explain')
    expect(html).toContain('1 evidence card selected')
    expect(html).toMatch(/type="radio"[^>]*checked=""[^>]*value="1"/)
    expect(html).toContain('Reveal hint 3 of 3')
    expect(html).not.toContain('Watch Level 1 briefing')
    expect(html).toContain('Export save')
    expect(html).toContain('Import save')
  })
})
