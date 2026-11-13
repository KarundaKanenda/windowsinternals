import { describe, expect, it } from 'vitest'
import { allScenes, coreScenes, capstoneScenes } from './index'
import { campaign } from '../campaign'
import { campaignIds } from '../progress'
import type { Experiment } from './types'

function reachableAssessment(experiment: Experiment): boolean {
  const pending = [{ node: experiment.initial, observed: new Set<string>() }]
  const visited = new Set<string>()
  while (pending.length) {
    const current = pending.shift()!
    const node = experiment.nodes[current.node]
    for (const item of node.evidence) current.observed.add(item.id)
    const key = `${current.node}:${[...current.observed].sort().join(',')}`
    if (visited.has(key)) continue
    visited.add(key)
    if (node.assess && experiment.investigation.requiredEvidence.every(id => current.observed.has(id))) return true
    for (const action of node.actions) {
      pending.push({ node: action.next, observed: new Set(current.observed) })
    }
  }
  return false
}

describe('complete browser campaign', () => {
  it('provides the complete planned curriculum in prerequisite order', () => {
    expect(allScenes.map(scene => scene.id)).toEqual(campaignIds)
    expect(coreScenes).toHaveLength(36)
    expect(capstoneScenes).toHaveLength(4)
    for (let level = 1; level <= 5; level++) {
      expect(coreScenes.filter(scene => scene.level === level).map(scene => scene.title))
        .toEqual(campaign[level - 1].missions.map(([title]) => title))
    }
  })

  for (const scene of allScenes) {
    it(`${scene.id} can complete both experiments, including detour recovery`, () => {
      for (const experiment of [scene.guided, scene.transfer]) {
        expect(experiment.nodes[experiment.initial]).toBeDefined()
        for (const check of [experiment.prediction, experiment.investigation]) {
          expect(check.options.length).toBeGreaterThanOrEqual(2)
          expect(check.correct).toBeGreaterThanOrEqual(0)
          expect(check.correct).toBeLessThan(check.options.length)
          expect(check.explanation.length).toBeGreaterThan(0)
        }
        expect(experiment.investigation.requiredEvidence.length).toBeGreaterThan(0)
        for (const node of Object.values(experiment.nodes)) {
          for (const action of node.actions) expect(experiment.nodes[action.next]).toBeDefined()
        }
        expect(reachableAssessment(experiment)).toBe(true)
        for (const start of Object.keys(experiment.nodes)) {
          expect(reachableAssessment({
            ...experiment,
            initial: start,
            investigation: { ...experiment.investigation, requiredEvidence: [] },
          })).toBe(true)
        }
      }
      expect(scene.guided).not.toEqual(scene.transfer)
      expect(scene.sources.every(source => source.url.startsWith('https://learn.microsoft.com/'))).toBe(true)
      expect(scene.simplification.length).toBeGreaterThan(0)
    })
  }
})
