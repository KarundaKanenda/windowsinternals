import { describe, expect, it } from 'vitest'
import { capstones, level5 } from './level5'
import type { Experiment, SceneNode } from './types'

function node(experiment: Experiment, id: string): SceneNode {
  const result = experiment.nodes[id]
  expect(result, `missing node ${id}`).toBeDefined()
  return result
}

function act(experiment: Experiment, from: string, action: string): string {
  const transition = node(experiment, from).actions.find((item) => item.id === action)
  expect(transition, `missing ${from}/${action}`).toBeDefined()
  return transition!.next
}

function value(experiment: Experiment, at: string, id: string): string {
  const observation = node(experiment, at).evidence.find((item) => item.id === id)
  expect(observation, `missing ${at}/${id}`).toBeDefined()
  return observation!.value
}

describe('I/O and security curriculum', () => {
  it('exports the exact ordered curriculum and four standalone capstones', () => {
    expect(level5.map((scene) => [scene.id, scene.level, scene.title])).toEqual([
      ['l5-1', 5, 'From Application to Device'],
      ['l5-2', 5, 'The Request Packet'],
      ['l5-3', 5, 'Pending Is Not Failed'],
      ['l5-4', 5, 'The Return Journey'],
      ['l5-5', 5, 'Cancellation and Failure'],
      ['l5-6', 5, 'Identity of the Caller'],
      ['l5-7', 5, 'The Access Decision'],
      ['l5-8', 5, 'Least Privilege'],
      ['l5-9', 5, 'Trust at Startup'],
      ['l5-10', 5, 'Protecting Beyond the Normal Kernel'],
      ['l5-11', 5, 'A Secure Service'],
    ])
    expect(capstones.map((scene) => [scene.id, scene.level])).toEqual([
      ['capstone-waits', 6], ['capstone-memory', 6],
      ['capstone-io', 6], ['capstone-access', 6],
    ])
  })

  it('models a selected storage route and different network route, not all I/O', () => {
    expect(value(level5[0].guided, 'inspected', 'route')).toBe('File system -> volume -> storage')
    expect(value(level5[0].transfer, 'inspected', 'route')).toBe('Network protocol -> network adapter')
    expect(value(level5[1].guided, 'changed', 'packet')).toBe('READ; offset 4096; length 512; stack location 1')
    expect(value(level5[1].transfer, 'changed', 'packet')).toBe('WRITE; offset 8192; length 128; stack location 1')
  })

  it('keeps pending separate from final success or failure and permits unrelated work', () => {
    const { guided, transfer } = level5[2]
    expect(value(guided, 'initial', 'status')).toBe('Pending; result unavailable')
    expect(value(guided, act(guided, 'initial', 'contrast'), 'status')).toBe('Pending; result unavailable; UI task finished')
    expect(value(guided, 'verified', 'outcome')).toBe('Success; 512 bytes delivered')
    expect(value(transfer, 'verified', 'outcome')).toBe('Failure; device disconnected; 0 bytes delivered')
  })

  it('retains ownership after lower completion until the callback resumes', () => {
    const { guided, transfer } = level5[3]
    expect(value(guided, 'inspected', 'ownership')).toBe('Lower driver completed; callback retains request; buffer not released')
    expect(value(guided, 'changed', 'ownership')).toBe('Callback resumed completion; final owner may now release')
    expect(value(guided, 'verified', 'outcome')).toBe('One final completion; buffer released once')
    expect(value(transfer, 'inspected', 'ownership')).toBe('Lower driver failed; callback retains request; buffer not released')
  })

  it('both cancellation orderings produce one terminal outcome, with no early release', () => {
    for (const experiment of [level5[4].guided, level5[4].transfer]) {
      const cancel = act(experiment, experiment.initial, 'cancel')
      const complete = act(experiment, experiment.initial, 'complete')
      expect(value(experiment, cancel, 'lifetime')).toBe('Cancellation requested; request and buffer still owned')
      expect(value(experiment, complete, 'lifetime')).toContain('terminal completion; buffer still owned')
      const cancelled = act(experiment, cancel, 'complete')
      expect(value(experiment, cancelled, 'race')).toBe('Cancel won; cancelled; terminal count 1')
      expect(value(experiment, act(experiment, cancelled, 'release'), 'outcome')).toBe('Cancelled; terminal count 1; release count 1')
      const lateCancel = act(experiment, complete, 'cancel')
      expect(value(experiment, lateCancel, 'race')).toContain('Late cancel ignored; terminal count 1')
      expect(value(experiment, act(experiment, lateCancel, 'release'), 'outcome')).toContain('terminal count 1; release count 1')
      expect(node(experiment, cancel).actions.map((action) => action.id)).not.toContain('release')
    }
    expect(value(level5[4].transfer, 'complete-first', 'race')).toBe('Failure won; device error; terminal count 1')
  })

  it('uses the thread impersonation token when present and process token after revert', () => {
    expect(value(level5[5].guided, 'inspected', 'identity')).toBe('Thread impersonates Customer A; effective token Customer A')
    expect(value(level5[5].guided, 'changed', 'identity')).toBe('Impersonation reverted; effective token Service')
    expect(value(level5[5].transfer, 'inspected', 'identity')).toBe('No impersonation; effective token Service')
    expect(value(level5[5].transfer, 'changed', 'identity')).toBe('Thread impersonates Customer B; effective token Customer B')
  })

  it('evaluates an ordered ACL subset against every requested right', () => {
    expect(value(level5[6].guided, 'inspected', 'acl')).toBe('DENY Writers WRITE; ALLOW Readers READ; caller in both')
    expect(value(level5[6].guided, 'detour', 'decision')).toBe('READ + WRITE denied; WRITE explicitly denied')
    expect(value(level5[6].guided, 'verified', 'outcome')).toBe('READ allowed; WRITE denied; DELETE denied')
    expect(value(level5[6].transfer, 'inspected', 'acl')).toBe('ALLOW Editors READ + WRITE; DENY Editors WRITE; caller in Editors')
    expect(value(level5[6].transfer, 'verified', 'outcome')).toBe('READ + WRITE allowed by first ACE; DELETE denied')
    expect(level5[6].simplification).toMatch(/empty DACL denies.*null DACL/i)
  })

  it('narrow repairs preserve authorized delivery and outsider/delete denial', () => {
    for (const scene of [level5[7], level5[10], capstones[3]]) {
      for (const experiment of [scene.guided, scene.transfer]) {
        expect(value(experiment, 'detour', 'probes')).toBe('Broad grant rejected; outsider or DELETE would be allowed')
        expect(value(experiment, 'verified', 'outcome')).toBe('Authorized delivery succeeds; outsider denied; DELETE denied')
        expect(value(experiment, 'changed', 'grant')).not.toMatch(/Everyone|Full control/)
      }
    }
    expect(value(level5[10].transfer, 'verified', 'boundary')).toBe('Customer B delivery succeeds; Customer A to B denied')
    expect(value(level5[10].transfer, 'changed', 'grant')).toBe('B report: Customer B READ only')
    expect(value(level5[10].transfer, 'verified', 'negative')).toBe('Customer B WRITE denied; Customer A READ to B denied')
    expect(value(capstones[3].transfer, 'inspected', 'cause')).toBe('Service B lacks Delivery group; B output grants WRITE to Delivery group only')
    expect(value(capstones[3].transfer, 'verified', 'boundary')).toBe('Service B delivers to B; Service A to B denied')
    expect(value(capstones[3].transfer, 'verified', 'negative')).toBe('Service B global group membership unchanged; other group-protected object denied')
  })

  it('checks boot authority/signature/revocation and separates three status fields', () => {
    expect(value(level5[8].guided, 'inspected', 'trust')).toBe('Authority trusted; signature valid; image revoked')
    expect(value(level5[8].transfer, 'inspected', 'trust')).toBe('Authority untrusted; signature valid; image not revoked')
    expect(value(level5[8].guided, 'verified', 'outcome')).toBe('Trusted, signed, unrevoked replacement boots; revoked image blocked')
    expect(value(level5[9].guided, 'inspected', 'protections')).toBe('Secure Boot on; VBS running; memory integrity off')
    expect(value(level5[9].transfer, 'inspected', 'protections')).toBe('Secure Boot off; VBS running; memory integrity on')
    expect(value(level5[9].guided, 'verified', 'outcome')).toBe('Isolated code-integrity fixture enforced; arbitrary kernel compromise not ruled out')
    expect(level5[8].concepts.map((concept) => concept.explanation).join(' ')).toMatch(/not.*all malware/i)
  })

  it('capstones diagnose one fault, contrast a non-fix, then verify bounded recovery', () => {
    expect(value(capstones[0].guided, 'inspected', 'cause')).toBe('A holds X waits Y; B holds Y waits X; lock cycle')
    expect(value(capstones[0].transfer, 'inspected', 'cause')).toBe('A waits for event E; producer queued behind A on sole worker; dependency cycle')
    expect(value(capstones[0].guided, 'verified', 'negative')).toBe('Normal event wait still blocks until signalled; no forced unlock')
    expect(value(capstones[1].guided, 'detour', 'memory')).toBe('Working set 8 MiB; commit 96 MiB; trim did not free')
    expect(value(capstones[1].transfer, 'inspected', 'cause')).toBe('Completed batch still referenced by cache; commit 64 MiB; working set 4 MiB')
    expect(value(capstones[1].guided, 'verified', 'negative')).toBe('Live 16 MiB allocation intact; next bounded batch returns to baseline')
    expect(value(capstones[2].guided, 'detour', 'storage')).toBe('Extra CPU assigned; same delayed I/O; completion unavailable')
    expect(value(capstones[2].transfer, 'inspected', 'cause')).toBe('Queue retry backoff gates issue; storage idle; CPU ready work finishes')
    expect(value(capstones[2].guided, 'verified', 'negative')).toBe('Device failure still reported; unrelated CPU work unchanged')
    expect(value(capstones[2].transfer, 'verified', 'negative')).toBe('Offline device still fails; no unbounded retry; CPU work unchanged')
  })

  it('every bounded repair requires its verification action, including after a contrast', () => {
    for (const scene of capstones) {
      for (const experiment of [scene.guided, scene.transfer]) {
        let at = act(experiment, experiment.initial, 'contrast')
        expect(node(experiment, at).assess).not.toBe(true)
        at = act(experiment, at, 'recover')
        expect(node(experiment, at).evidence.map((item) => item.id)).toContain('cause')
        at = act(experiment, at, 'advance')
        expect(node(experiment, at).assess).not.toBe(true)
        expect(node(experiment, at).evidence.map((item) => item.id)).not.toContain('outcome')
        at = act(experiment, at, 'verify')
        expect(node(experiment, at).assess).toBe(true)
        expect(node(experiment, at).evidence.map((item) => item.id)).toContain('outcome')
        expect(node(experiment, at).evidence.map((item) => item.id)).toContain(scene.id === 'capstone-access' ? 'boundary' : 'negative')
        expect(node(experiment, at).evidence.find((item) => item.id === 'cause')!.label).toMatch(/Captured cause/)
      }
    }
  })
})

describe('every authored graph is playable', () => {
  for (const scene of [...level5, ...capstones]) {
    for (const mode of ['guided', 'transfer'] as const) {
      it(`${scene.id} ${mode}: observations, detours and assessment are reachable`, () => {
        const experiment = scene[mode]
        expect(Object.keys(experiment.nodes).length).toBeGreaterThanOrEqual(mode === 'guided' ? 4 : 3)
        expect(node(experiment, experiment.initial).assess).not.toBe(true)
        expect(experiment.investigation.requiredEvidence).toHaveLength(2)
        for (const check of [experiment.prediction, experiment.investigation]) {
          expect(check.correct).toBeGreaterThanOrEqual(0)
          expect(check.correct).toBeLessThan(check.options.length)
          expect(check.explanation.length).toBeGreaterThan(30)
        }
        const reachable = new Set<string>()
        const queue = [experiment.initial]
        while (queue.length) {
          const id = queue.shift()!
          if (reachable.has(id)) continue
          reachable.add(id)
          const current = node(experiment, id)
          expect(current.evidence.length).toBeGreaterThan(0)
          expect(new Set(current.evidence.map((item) => item.id)).size).toBe(current.evidence.length)
          expect(new Set(current.actions.map((item) => item.id)).size).toBe(current.actions.length)
          for (const action of current.actions) {
            expect(action.log.length).toBeGreaterThan(10)
            expect(experiment.nodes[action.next]).toBeDefined()
            queue.push(action.next)
          }
          if (current.assess) {
            expect(current.evidence.map((item) => item.id)).toEqual(expect.arrayContaining(experiment.investigation.requiredEvidence))
          } else {
            // Every detour can recover to assessment without resetting the model.
            const pending = [id]
            const visited = new Set<string>()
            let canAssess = false
            while (pending.length) {
              const candidate = pending.shift()!
              if (visited.has(candidate)) continue
              visited.add(candidate)
              const target = node(experiment, candidate)
              if (target.assess) canAssess = true
              pending.push(...target.actions.filter((action) => action.id !== 'reset').map((action) => action.next))
            }
            expect(canAssess, `${id} is a trapped detour`).toBe(true)
          }
        }
        expect(reachable.size).toBe(Object.keys(experiment.nodes).length)
        for (const required of experiment.investigation.requiredEvidence) {
          expect(node(experiment, experiment.initial).evidence.map((item) => item.id)).not.toContain(required)
        }
        expect(scene.hints.length).toBeGreaterThanOrEqual(3)
        expect(scene.concepts.every((concept) => concept.depth.length > 20)).toBe(true)
        expect(scene.sources.every((source) => source.url.startsWith('https://learn.microsoft.com/'))).toBe(true)
        expect(scene.simplification).toMatch(/fiction|snapshot|browser/i)
        expect(scene.icon).toMatch(/^[A-Z0-9 ]+$/)
        expect(scene.transfer.briefing).not.toBe(scene.guided.briefing)
      })
    }
  }
})
