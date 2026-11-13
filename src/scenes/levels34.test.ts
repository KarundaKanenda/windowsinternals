import { describe, expect, it } from 'vitest'
import { levels34 } from './levels34'
import type { Experiment, SceneNode } from './types'

function experiment(id: string, variant: 'guided' | 'transfer' = 'guided'): Experiment {
  const scene = levels34.find((item) => item.id === id)
  if (!scene) throw new Error(`Missing scene ${id}`)
  return scene[variant]
}

function follow(exp: Experiment, ...actions: string[]): SceneNode {
  let current = exp.nodes[exp.initial]!
  for (const id of actions) {
    const action = current.actions.find((item) => item.id === id)
    if (!action) throw new Error(`Missing action ${id} at ${current.title}`)
    current = exp.nodes[action.next]!
  }
  return current
}

function value(node: SceneNode, id: string): string {
  const evidence = node.evidence.find((item) => item.id === id)
  if (!evidence) throw new Error(`Missing evidence ${id} at ${node.title}`)
  return evidence.value
}

describe('kernel and memory curriculum', () => {
  it('exports the exact ordered titles and chapter IDs', () => {
    expect(levels34.map((scene) => [scene.id, scene.level, scene.title])).toEqual([
      ['l3-1', 3, 'Who Handles What?'],
      ['l3-2', 3, 'Something Happened'],
      ['l3-3', 3, 'Urgent Work, Deferred Work'],
      ['l3-4', 3, 'Objects and Handles'],
      ['l3-5', 3, 'Sharing Safely'],
      ['l3-6', 3, 'The Frozen Application'],
      ['l4-1', 4, 'Reserve, Commit, Touch'],
      ['l4-2', 4, 'Translate This Address'],
      ['l4-3', 4, 'The Page Was Not Here'],
      ['l4-4', 4, 'Permission to Access'],
      ['l4-5', 4, 'Shared Without Being Identical'],
      ['l4-6', 4, 'Memory Under Pressure'],
      ['l4-7', 4, 'Memory in Kernel Mode'],
    ])
  })

  it('has reachable snapshots, recoverable branches and action-acquired assessment evidence', () => {
    for (const scene of levels34) {
      expect(scene.icon).toMatch(/^[A-Za-z0-9]+$/)
      expect(scene.hints.length).toBeGreaterThanOrEqual(3)
      expect(scene.simplification.length).toBeGreaterThan(30)
      expect(scene.sources.length).toBeGreaterThan(0)
      for (const source of scene.sources) {
        expect(source.url).toMatch(/^https:\/\/learn\.microsoft\.com\/.+#.+/)
      }
      for (const variant of ['guided', 'transfer'] as const) {
        const exp = scene[variant]
        expect(exp.nodes[exp.initial]).toBeDefined()
        expect(exp.nodes[exp.initial]!.assess).not.toBe(true)
        expect(Object.keys(exp.nodes).length).toBeGreaterThanOrEqual(variant === 'guided' ? 4 : 3)
        expect(exp.investigation.requiredEvidence.length).toBeGreaterThanOrEqual(2)
        for (const check of [exp.prediction, exp.investigation]) {
          expect(check.correct).toBeGreaterThanOrEqual(0)
          expect(check.correct).toBeLessThan(check.options.length)
          expect(check.explanation.length).toBeGreaterThan(30)
        }
        const required = exp.investigation.requiredEvidence
        expect(exp.nodes[exp.initial]!.evidence.map((e) => e.id)).not.toEqual(expect.arrayContaining(required))
        const reached = new Set<string>()
        const queue: [string, Set<string>][] = [[exp.initial, new Set()]]
        const visited = new Set<string>()
        let validAssessment = false
        while (queue.length) {
          const [id, previous] = queue.shift()!
          const node = exp.nodes[id]!
          const observed = new Set([...previous, ...node.evidence.map((e) => e.id)])
          const key = `${id}:${[...observed].sort().join(',')}`
          if (visited.has(key)) continue
          visited.add(key)
          reached.add(id)
          if (node.assess && required.every((e) => observed.has(e))) validAssessment = true
          expect(new Set(node.actions.map((a) => a.id)).size).toBe(node.actions.length)
          expect(new Set(node.evidence.map((e) => e.id)).size).toBe(node.evidence.length)
          for (const action of node.actions) {
            expect(action.log.length).toBeGreaterThan(5)
            expect(exp.nodes[action.next]).toBeDefined()
            queue.push([action.next, observed])
          }
        }
        expect(reached.size).toBe(Object.keys(exp.nodes).length)
        expect(validAssessment).toBe(true)
        // From every detour there is still a path to collect both required observations.
        for (const start of reached) {
          const pending: [string, Set<string>][] = [[start, new Set()]]
          const seen = new Set<string>()
          let recoverable = false
          while (pending.length) {
            const [id, prior] = pending.shift()!
            const node = exp.nodes[id]!
            const observations = new Set([...prior, ...node.evidence.map((e) => e.id)])
            const key = `${id}:${[...observations].sort().join(',')}`
            if (seen.has(key)) continue
            seen.add(key)
            if (node.assess && required.every((e) => observations.has(e))) recoverable = true
            for (const action of node.actions) pending.push([action.next, observations])
          }
          expect(recoverable, `${scene.id}/${variant}/${start}`).toBe(true)
        }
      }
    }
  })
})

describe('literal kernel mechanisms', () => {
  it('assesses causal mechanisms rather than rewarding plausible but false repairs', () => {
    const answer = (id: string, variant: 'guided' | 'transfer' = 'guided') => {
      const check = experiment(id, variant).investigation
      return check.options[check.correct]
    }
    expect(answer('l3-1')).toBe('I/O management built the request; kernel dispatching made the satisfied waiter ready.')
    expect(answer('l3-3')).toBe('The operation could block; PASSIVE_LEVEL worker context permits it, unlike a DISPATCH_LEVEL DPC.')
    expect(answer('l3-4')).toBe('The kernel operation retained a reference; destruction followed its final release.')
    expect(answer('l3-5', 'transfer')).toBe('Both workers used the same mutex around the complete operation.')
    expect(answer('l3-6', 'transfer')).toBe('The worker awaited an independently completing I/O request, not a closed lock cycle.')
    expect(answer('l4-2')).toBe('The mapping was valid and resident; the first walked it and the second used the TLB.')
    expect(answer('l4-5', 'transfer')).toBe('This mapping explicitly preserves writable shared backing rather than creating A’s private copy.')
    expect(answer('l4-7')).toBe('Nonpageable accessed code/data and a bounded nonblocking operation at DISPATCH_LEVEL.')
  })

  it('routes a service through executive work and kernel dispatch rather than exclusive boxes', () => {
    const exp = experiment('l3-1')
    expect(value(follow(exp, 'route-io'), 'io-route')).toBe('I/O manager -> driver stack')
    expect(value(follow(exp, 'route-io', 'complete'), 'dispatch-route')).toBe('Kernel dispatcher readies the waiting thread')
    expect(value(follow(exp, 'route-kernel'), 'routing-error')).toBe('No driver request constructed')
    expect(follow(exp, 'route-kernel', 'route-io', 'complete').assess).toBe(true)
  })

  it('distinguishes interrupt notification, recoverable fault and unhandled exception', () => {
    const exp = experiment('l3-2')
    expect(value(follow(exp, 'notify'), 'event-origin')).toBe('Device interrupt: asynchronous to the interrupted instruction')
    expect(value(follow(exp, 'notify', 'touch'), 'exception-result')).toBe('Demand-zero fault resolved; instruction retried')
    expect(value(follow(exp, 'invalid'), 'fatal-result')).toBe('Unhandled access violation; application terminates')
    expect(value(follow(experiment('l3-2', 'transfer'), 'handle'), 'handled-result')).toBe('Handler selected; application continues at recovery code')
  })

  it('separates ISR, DPC and worker IRQL, mode and thread priority', () => {
    const exp = experiment('l3-3')
    const isr = follow(exp, 'interrupt')
    expect(value(isr, 'irql')).toBe('Device IRQL (above DISPATCH_LEVEL)')
    expect(value(isr, 'mode')).toBe('Kernel mode')
    const dpc = follow(exp, 'interrupt', 'queue-dpc')
    expect(value(dpc, 'irql')).toBe('DISPATCH_LEVEL')
    expect(value(dpc, 'priority')).toBe('Not a normal schedulable thread priority')
    expect(value(follow(exp, 'interrupt', 'queue-dpc', 'queue-worker'), 'irql')).toBe('PASSIVE_LEVEL')
    expect(value(follow(exp, 'interrupt', 'queue-dpc', 'queue-worker'), 'priority')).toBe('Worker thread priority 8 (fixture)')
    expect(value(follow(exp, 'interrupt', 'queue-dpc', 'wait'), 'wait-result')).toBe('Blocking wait rejected at DISPATCH_LEVEL')
  })

  it('destroys an unnamed object only after handles AND retained kernel references are gone', () => {
    const exp = experiment('l3-4')
    expect(value(follow(exp, 'close-a'), 'references')).toBe('1 handle + 1 kernel reference = 2')
    expect(value(follow(exp, 'close-a', 'close-b'), 'lifetime')).toBe('Alive: kernel reference remains')
    expect(value(follow(exp, 'close-a', 'close-b', 'release'), 'lifetime')).toBe('Destroyed: final reference released')
    const transfer = experiment('l3-4', 'transfer')
    expect(value(follow(transfer, 'release'), 'lifetime')).toBe('Alive: duplicated handle remains')
    expect(value(follow(transfer, 'release', 'close'), 'lifetime')).toBe('Destroyed: final reference released')
  })

  it('reproduces a lost update and protects the whole read-modify-write operation', () => {
    const exp = experiment('l3-5')
    expect(value(follow(exp, 'interleave'), 'race-trace')).toBe('A reads 0; B reads 0; A writes 1; B writes 1')
    expect(value(follow(exp, 'interleave'), 'counter')).toBe('1 (two increments attempted)')
    expect(value(follow(exp, 'interleave', 'lock-write'), 'partial-lock')).toBe('1: stale reads still lose an update')
    expect(value(follow(exp, 'interleave', 'lock-write', 'lock-all'), 'safe-trace')).toBe('A: lock/read 0/write 1/unlock; B: lock/read 1/write 2/unlock')
    expect(value(follow(exp, 'interleave', 'lock-all'), 'counter')).toBe('2 (two increments completed)')
    expect(value(follow(experiment('l3-5', 'transfer'), 'interleave'), 'counter')).toBe('11 (expected 12)')
  })

  it('contrasts a lock cycle with a legitimate I/O wait and verifies lock-order repair', () => {
    const exp = experiment('l3-6')
    expect(value(follow(exp, 'inspect'), 'wait-graph')).toBe('A owns L1 -> waits L2; B owns L2 -> waits L1')
    expect(value(follow(exp, 'inspect', 'boost'), 'repair-result')).toBe('Still blocked: priority does not release either lock')
    expect(value(follow(exp, 'inspect', 'order'), 'repair-result')).toBe('Both threads complete: L1 then L2')
    expect(value(follow(experiment('l3-6', 'transfer'), 'inspect'), 'wait-graph')).toBe('Worker -> pending disk request; no lock-owner cycle')
    expect(value(follow(experiment('l3-6', 'transfer'), 'inspect', 'complete'), 'wait-result')).toBe('I/O completed; worker ready')
  })
})

describe('literal memory mechanisms', () => {
  it('keeps reservation, commitment and resident counters independent', () => {
    const exp = experiment('l4-1')
    expect(value(follow(exp, 'reserve'), 'counters')).toBe('Reserved 4 pages; committed 0; resident 0')
    expect(value(follow(exp, 'reserve', 'commit'), 'counters')).toBe('Reserved 4 pages; committed 4; resident 0')
    expect(value(follow(exp, 'reserve', 'commit', 'touch'), 'counters')).toBe('Reserved 4 pages; committed 4; resident 1')
    expect(value(follow(experiment('l4-1', 'transfer'), 'decommit'), 'counters')).toBe('Reserved 4 pages; committed 2; resident 2')
    expect(value(follow(experiment('l4-1', 'transfer'), 'decommit', 'trim-one'), 'counters')).toBe('Reserved 4 pages; committed 2; resident 1')
  })

  it('a TLB miss walks a valid resident mapping without a page fault', () => {
    const exp = experiment('l4-2')
    expect(value(follow(exp, 'translate'), 'translation')).toBe('VA 0x234 -> page 2 + offset 0x34 -> frame 7 -> PA 0x734')
    expect(value(follow(exp, 'translate'), 'fault-count')).toBe('0 page faults; 1 TLB miss')
    expect(value(follow(exp, 'translate', 'repeat'), 'cache-result')).toBe('TLB hit: frame 7; no page-table walk')
    expect(value(follow(experiment('l4-2', 'transfer'), 'translate'), 'translation')).toBe('VA 0x234 -> page 2 + offset 0x34 -> frame 9 -> PA 0x934')
  })

  it('shows demand-zero and standby without storage, both hard-fault sources, and invalid access', () => {
    const exp = experiment('l4-3')
    expect(value(follow(exp, 'zero'), 'zero-result')).toBe('Soft fault: zero-filled RAM page; 0 storage reads')
    expect(value(follow(exp, 'zero', 'standby'), 'standby-result')).toBe('Soft fault: standby page reused; 0 storage reads')
    expect(value(follow(exp, 'zero', 'standby', 'file'), 'file-result')).toBe('Hard fault: 1 mapped-file read')
    expect(value(follow(exp, 'invalid'), 'invalid-result')).toBe('Access violation: no valid allocation; no page fetched')
    expect(value(follow(experiment('l4-3', 'transfer'), 'pagefile'), 'pagefile-result')).toBe('Hard fault: 1 pagefile read')
  })

  it('checks R/W/X authorization independently of residency', () => {
    const exp = experiment('l4-4')
    expect(value(follow(exp, 'write'), 'write-result')).toBe('Access violation: resident R-- page denies write')
    expect(value(follow(exp, 'write', 'read'), 'read-result')).toBe('Read succeeds: resident R-- page permits read')
    expect(value(follow(exp, 'write', 'read', 'execute'), 'execute-result')).toBe('Access violation: resident R-- page denies execute')
    expect(value(follow(experiment('l4-4', 'transfer'), 'execute'), 'execute-result')).toBe('Execute succeeds: resident R-X page')
    expect(value(follow(experiment('l4-4', 'transfer'), 'execute', 'write'), 'write-result')).toBe('Access violation: R-X is not writable')
  })

  it('copies only the written COW page while explicitly writable sharing changes both views', () => {
    const exp = experiment('l4-5')
    expect(value(follow(exp, 'write'), 'views')).toBe('Page 0: A=9, B=4; page 1: A=6, B=6')
    expect(value(follow(exp, 'write'), 'backing')).toBe('Page 0 private to A; page 1 still shared')
    expect(value(follow(exp, 'write', 'write-again'), 'copies')).toBe('1 private page; second write reuses it')
    expect(value(follow(experiment('l4-5', 'transfer'), 'write'), 'views')).toBe('Page 0: A=9, B=9; page 1: A=6, B=6')
    expect(value(follow(experiment('l4-5', 'transfer'), 'write', 'inspect'), 'backing')).toBe('Both views use the same writable backing; 0 private copies')
  })

  it('trims residency without freeing commitment, then releases retained allocations', () => {
    const exp = experiment('l4-6')
    expect(value(follow(exp, 'trim'), 'counters')).toBe('Committed 8 pages; resident 2; retained allocation 8')
    expect(value(follow(exp, 'trim', 'reuse'), 'counters')).toBe('Committed 8 pages; resident 3; retained allocation 8')
    expect(value(follow(exp, 'trim', 'reuse', 'release'), 'counters')).toBe('Committed 0 pages; resident 0; retained allocation 0')
    expect(value(follow(experiment('l4-6', 'transfer'), 'repeat'), 'allocation-trend')).toBe('Requests 2 and 3 reuse 8 pages; commitment stays 8')
  })

  it('requires nonpageable data at DISPATCH_LEVEL even when paged data currently resides in RAM', () => {
    const exp = experiment('l4-7')
    expect(value(follow(exp, 'paged'), 'safety')).toBe('Unsafe at DISPATCH_LEVEL: paged pool can become nonresident')
    expect(value(follow(exp, 'paged', 'nonpaged'), 'safety')).toBe('Suitable at DISPATCH_LEVEL: nonpaged buffer and nonpageable code')
    expect(value(follow(exp, 'paged', 'nonpaged', 'run'), 'run-result')).toBe('DPC completes without pageable access or blocking')
    expect(value(follow(experiment('l4-7', 'transfer'), 'paged'), 'safety')).toBe('Suitable at PASSIVE_LEVEL: worker can resolve page faults')
  })
})
