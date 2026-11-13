import { describe, expect, it } from 'vitest'
import { levels12 } from './levels12'
import type { Evidence, Experiment, SceneNode } from './types'

const titles = [
  'First Contact', 'Who Does the Work?', 'A Private Address Book',
  'Crossing the Boundary', 'Inside the Machine', 'Explain the Workstation',
  'Birth of a Process', 'Anatomy of a Process', 'Keeping Work Together',
  'One Processor, Many Threads', 'More Cores, Different Results', 'A Clean Exit',
]

function experiment(id: string, variant: 'guided' | 'transfer' = 'guided'): Experiment {
  return levels12.find(scene => scene.id === id)![variant]
}

function walk(model: Experiment, ...actions: string[]): SceneNode {
  let node = model.nodes[model.initial]
  for (const id of actions) {
    const action = node.actions.find(item => item.id === id)
    expect(action, `Action ${id} at ${node.title}`).toBeDefined()
    node = model.nodes[action!.next]
  }
  return node
}

function value(node: SceneNode, id: string): string {
  const evidence = node.evidence.find(item => item.id === id)
  expect(evidence, `Missing observation ${id}`).toBeDefined()
  return evidence!.value
}

// Carry snapshots just as a runner would, but do not depend on the shared engine.
function assessmentReachable(model: Experiment, from = model.initial): boolean {
  const pending: { node: string; history: Evidence[] }[] = [{ node: from, history: [] }]
  const visited = new Set<string>()
  while (pending.length) {
    const { node: key, history } = pending.shift()!
    const node = model.nodes[key]
    const observations = new Map(history.map(item => [item.id, item]))
    for (const item of node.evidence) observations.set(item.id, item)
    const signature = `${key}:${[...observations.keys()].sort().join(',')}`
    if (visited.has(signature)) continue
    visited.add(signature)
    if (node.assess && model.investigation.requiredEvidence.every(id => observations.has(id))) {
      return true
    }
    for (const action of node.actions) {
      pending.push({ node: action.next, history: [...observations.values()] })
    }
  }
  return false
}

describe('Level 1 and 2 content graph contract', () => {
  it('covers the literal ordered curriculum and both experiments', () => {
    expect(levels12.map(scene => scene.title)).toEqual(titles)
    expect(levels12.map(scene => scene.id)).toEqual([
      'l1-1', 'l1-2', 'l1-3', 'l1-4', 'l1-5', 'l1-6',
      'l2-1', 'l2-2', 'l2-3', 'l2-4', 'l2-5', 'l2-6',
    ])
    levels12.forEach((scene, index) => {
      expect(scene.level).toBe(index < 6 ? 1 : 2)
      expect(scene.icon).toMatch(/^[A-Za-z0-9]+$/)
      expect(scene.hints.length).toBeGreaterThanOrEqual(3)
      expect(scene.concepts.length).toBeGreaterThan(0)
      expect(scene.simplification).toBeTruthy()
      scene.sources.forEach(source => {
        const url = new URL(source.url)
        expect(url.hostname).toBe('learn.microsoft.com')
        expect(url.hash).not.toBe('')
      })
      for (const model of [scene.guided, scene.transfer]) {
        expect(Object.keys(model.nodes).length).toBeGreaterThanOrEqual(3)
        expect(model.nodes[model.initial].assess).not.toBe(true)
        expect(model.nodes[model.initial].actions.length).toBeGreaterThan(0)
        for (const check of [model.prediction, model.investigation]) {
          expect(check.correct).toBeGreaterThanOrEqual(0)
          expect(check.correct).toBeLessThan(check.options.length)
          expect(check.explanation).toBeTruthy()
        }
        expect(model.investigation.requiredEvidence).toHaveLength(2)
        const initialIds = model.nodes[model.initial].evidence.map(item => item.id)
        expect(model.investigation.requiredEvidence.some(id => initialIds.includes(id))).toBe(false)
        const reachable = new Set<string>()
        const pending = [model.initial]
        while (pending.length) {
          const key = pending.shift()!
          if (reachable.has(key)) continue
          reachable.add(key)
          for (const action of model.nodes[key].actions) pending.push(action.next)
        }
        expect([...reachable].sort()).toEqual(Object.keys(model.nodes).sort())
        for (const [key, node] of Object.entries(model.nodes)) {
          expect(new Set(node.actions.map(action => action.id)).size).toBe(node.actions.length)
          expect(new Set(node.evidence.map(item => item.id)).size).toBe(node.evidence.length)
          for (const action of node.actions) {
            expect(model.nodes[action.next], `${scene.id}: ${key} -> ${action.next}`).toBeDefined()
            expect(action.log).toBeTruthy()
          }
          expect(assessmentReachable(model, key), `${scene.id}: stranded at ${key}`).toBe(true)
        }
        expect(assessmentReachable(model)).toBe(true)
      }
      expect(scene.transfer.briefing).not.toBe(scene.guided.briefing)
    })
  })
})

describe('Foundations and execution outcomes', () => {
  it('launches independent PIDs, then leaves precisely the unclosed instance', () => {
    const model = experiment('l1-1')
    expect(value(walk(model, 'launch-first'), 'instances')).toBe('1: PID 4100')
    expect(value(walk(model, 'launch-first', 'launch-second'), 'two-pids')).toBe('2: PIDs 4100, 4104')
    const survivor = walk(model, 'launch-first', 'launch-second', 'close-second')
    expect(value(survivor, 'survivor')).toBe('1: PID 4100; PID 4104 exited')
    expect(value(walk(model, 'launch-first', 'close-only'), 'instances')).toBe('0: no live PIDs')
    const transfer = experiment('l1-1', 'transfer')
    expect(value(walk(transfer, 'close-last'), 'remaining')).toBe('0: PID 5100 exited')
    expect(value(walk(transfer, 'close-last', 'relaunch'), 'reuse')).toBe('1: PID 5100, generation B')
  })

  it('keeps a responsive UI by sharing one CPU, not by running two threads at once', () => {
    const model = experiment('l1-2')
    expect(value(walk(model, 'block-ui'), 'ui-branch')).toBe('UI busy: input queued')
    const checked = walk(model, 'dispatch-worker', 'send-input')
    expect(value(checked, 'ui-response')).toBe('Input handled; calculation unfinished')
    expect(value(checked, 'cpu-slices')).toBe('1 logical CPU: worker -> UI -> worker')
  })

  it('keeps identical virtual addresses private, including after a write', () => {
    const model = experiment('l1-3')
    const checked = walk(model, 'write-a', 'read-b')
    expect(value(checked, 'a-mapping')).toBe('PID 6100: VA 0x1000 -> private A; value 8')
    expect(value(checked, 'b-mapping')).toBe('PID 6104: VA 0x1000 -> private B; value 3')
    // Copy-on-write belongs to Level 4, not an invented prerequisite here.
    expect(model.briefing.toLowerCase()).not.toContain('copy-on-write')
  })

  it('crosses privilege mode without inventing another process or thread', () => {
    const checked = walk(experiment('l1-4'), 'request-service', 'return-user')
    expect(value(checked, 'service-route')).toBe('PID 7100 / TID 7101: user -> kernel service -> user')
    expect(value(checked, 'service-result')).toBe('Access checked; file handle returned')
    const denied = walk(experiment('l1-4', 'transfer'), 'open-protected')
    expect(value(denied, 'denied-service')).toBe('PID 7200 / TID 7201: user -> kernel check -> user; access denied')
  })

  it('changes architecture routing when cached data removes the need for new device work', () => {
    const model = experiment('l1-5', 'transfer')
    expect(value(walk(model, 'read-missing'), 'cache-miss')).toBe('Cache miss -> driver/device; device work 1')
    const checked = walk(model, 'read-cached', 'inspect-cache-result')
    expect(value(checked, 'cache-result')).toBe('Buffer 4 bytes; new device work 0')
  })

  it('integrates a surviving private draft, CPU turns and a checked save service', () => {
    const model = experiment('l1-6', 'transfer')
    const checked = walk(model, 'close-a-and-input', 'save-b')
    expect(value(checked, 'integrated-survivor')).toBe('A exited; B 7704 alive; private draft 20 bytes; UI input handled')
    expect(value(checked, 'integrated-save')).toBe('B thread: user -> kernel save -> user; 20 bytes saved')
  })

  it('distinguishes a created suspended process from a runnable initial thread', () => {
    const model = experiment('l2-1')
    expect(value(walk(model, 'create-suspended'), 'creation')).toBe('Image mapped; PID 8100; TID 8101 suspended')
    const checked = walk(model, 'create-suspended', 'resume')
    expect(value(checked, 'readiness')).toBe('TID 8101 ready; application initialization not yet executed')
    const transfer = experiment('l2-1', 'transfer')
    expect(value(walk(transfer, 'launch-missing'), 'missing-launch')).toBe('Image not found; no child PID/TID')
    expect(value(walk(transfer, 'launch-missing', 'repair-image', 'schedule-initial'), 'initialization-turn'))
      .toBe('TID 8111 executed one turn; initialization begun, not completed')
  })

  it('labels prepared ownership records as synthetic instead of fixed offsets', () => {
    const checked = walk(experiment('l2-2'), 'inspect-process', 'inspect-thread')
    expect(value(checked, 'process-record')).toBe('Synthetic EPROCESS view: PID 8200 owns address space and handles')
    expect(value(checked, 'thread-record')).toBe('Synthetic ETHREAD view: TID 8201 belongs to PID 8200')
    const transfer = walk(experiment('l2-2', 'transfer'), 'follow-thread-owner', 'resolve-both')
    expect(value(transfer, 'handle-resolution')).toBe('PID 8210: 0x40 -> file A; PID 8214: 0x40 -> event B')
  })

  it('rejects job admission at the configured active-process limit, then frees a slot', () => {
    const model = experiment('l2-3')
    expect(value(walk(model, 'admit-third'), 'job-rejection')).toBe('Rejected: 2 active members / limit 2')
    expect(value(walk(model, 'admit-third'), 'rejected-worker')).toBe('PID 8308 terminated; all its process handles closed')
    const recovered = walk(model, 'admit-third', 'finish-member')
    expect(value(recovered, 'job-members')).toBe('1 active member: PID 8300')
    const checked = walk(model, 'admit-third', 'finish-member', 'retry-admission')
    expect(value(checked, 'job-admission')).toBe('2 active members: PIDs 8300, 8312; outsider 8399 unchanged')
    const transfer = experiment('l2-3', 'transfer')
    expect(value(walk(transfer, 'launch-outside'), 'unassigned-worker')).toBe('8318 and 8320 outside; J2 active membership still 1')
    const assigned = walk(transfer, 'assign-outsider', 'raise-limit-retry')
    expect(value(walk(transfer, 'assign-outsider'), 'assignment-rejected'))
      .toBe('Limit 1: 8318 terminated on failed assignment; 8310 remains sole member')
    expect(value(assigned, 'assignment-allowed')).toBe('Limit 2: active members 8310, 8324; member count 2')
  })

  it('never schedules a waiting thread until its wait condition is satisfied', () => {
    const model = experiment('l2-4')
    expect(value(walk(model, 'try-waiter'), 'wait-attempt')).toBe('TID 8402 waiting: not eligible to run')
    const waiting = walk(model, 'run-ready')
    expect(value(waiting, 'lanes')).toBe('8401 running; 8403 ready; 8402 waiting')
    const checked = walk(model, 'run-ready', 'complete-io')
    expect(value(checked, 'wake')).toBe('8402 waiting -> ready; 8403 running; 8401 ready')
    const transfer = experiment('l2-4', 'transfer')
    expect(value(walk(transfer, 'schedule-empty'), 'idle-attempt')).toBe('CPU remains idle; both threads waiting')
    expect(value(walk(transfer, 'schedule-empty', 'signal-event'), 'event-ready')).toBe('8411 ready; 8412 waiting; CPU idle')
  })

  it('more CPUs help independent work but do not remove serial dependencies', () => {
    const guided = walk(experiment('l2-5'), 'use-two-cpus', 'measure')
    expect(value(guided, 'parallel-work')).toBe('2 independent tasks x 4 units; 2 CPUs; elapsed 4 units')
    const transfer = experiment('l2-5', 'transfer')
    expect(value(walk(transfer, 'use-two-cpus'), 'serial-work')).toBe('B waits for A: 4 + 4 units; elapsed 8 units')
    expect(value(walk(transfer, 'use-two-cpus', 'measure'), 'serial-completion')).toBe('2 CPUs: elapsed 8 units; no overlap between A and B')
  })

  it('OS cleanup occurs in both exits, but forced exit skips application finalization', () => {
    const model = experiment('l2-6')
    const orderly = walk(model, 'orderly-exit', 'inspect-cleanup')
    expect(value(orderly, 'orderly-resources')).toBe('0 live threads; address space released; process handles closed')
    expect(value(orderly, 'orderly-output')).toBe('Draft saved; application finalization ran')
    const forced = walk(model, 'force-exit')
    expect(value(forced, 'forced-resources')).toBe('0 live threads; address space released; process handles closed')
    expect(value(forced, 'forced-output')).toBe('Unsaved draft lost; application finalization skipped')
    const transfer = walk(experiment('l2-6', 'transfer'), 'terminate-parent', 'inspect-child')
    expect(value(transfer, 'child-survivor')).toBe('Parent 8600 exited; child 8604 alive; no kill-on-close job')
    const jobContrast = walk(experiment('l2-6', 'transfer'), 'close-kill-job')
    expect(value(jobContrast, 'job-kill-contrast')).toBe('Last job handle closed; configured member processes both terminated')
  })
})
