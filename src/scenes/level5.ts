import type { Check, Evidence, Experiment, Scene, SceneAction } from './types'

const evidence = (id: string, value: string, detail: string): Evidence => ({
  id, label: id.replaceAll('-', ' '), value, detail,
})

const check = (prompt: string, answer: string, distractors: string[], explanation: string): Check => ({
  prompt, options: [answer, ...distractors], correct: 0, explanation,
})

const action = (id: string, label: string, next: string, log: string): SceneAction => ({
  id, label, next, log,
})

interface Fixture {
  briefing: string
  prediction: Check
  initial: Evidence[]
  cause: Evidence
  inspected?: Evidence[]
  detour: Evidence[]
  changed: Evidence[]
  outcome: Evidence
  verified?: Evidence[]
  inspect: string
  contrast: string
  recover: string
  advance: string
  verify: string
  investigation: Check
}

function snapshot(items: Evidence[]): Evidence[] {
  return [...new Map(items.map((item) => [item.id, item])).values()]
}

// Each node is a complete fixture snapshot; edges choose a deterministic next
// snapshot, not an emulator or a measurement of the learner's host.
function experiment(fixture: Fixture): Experiment {
  const diagnosis = [fixture.cause, ...(fixture.inspected ?? [])]
  const capturedCause = {
    ...fixture.cause,
    label: `Captured cause: ${fixture.cause.label}`,
    detail: `Historical diagnosis captured before the intended step. ${fixture.cause.detail}`,
  }
  return {
    briefing: fixture.briefing,
    prediction: fixture.prediction,
    initial: 'initial',
    nodes: {
      initial: {
        title: 'Before the investigation',
        description: fixture.briefing,
        evidence: fixture.initial,
        actions: [
          action('inspect', fixture.inspect, 'inspected', `Observed: ${fixture.inspect}. No host was inspected.`),
          action('contrast', fixture.contrast, 'detour', `Tried the contrast: ${fixture.contrast}. Compare the new snapshot.`),
        ],
      },
      inspected: {
        title: 'The mechanism comes into view',
        description: 'Read the observations before choosing the next step. This is one bounded teaching fixture.',
        evidence: snapshot(diagnosis),
        actions: [
          action('advance', fixture.advance, 'changed', `Applied the bounded step: ${fixture.advance}.`),
          action('contrast', fixture.contrast, 'detour', `Tried the contrast: ${fixture.contrast}. The snapshot records its consequence.`),
        ],
      },
      detour: {
        title: 'Compare a different choice',
        description: 'This branch is not a shortcut to mastery. Recover, then test the mechanism with the intended step.',
        evidence: fixture.detour,
        actions: [action('recover', fixture.recover, 'inspected', `Recovered the original fixture: ${fixture.recover}.`)],
      },
      changed: {
        title: 'A change is not yet verification',
        description: 'The intended step has run. Now check the outcome instead of assuming that the change worked.',
        evidence: snapshot([capturedCause, ...fixture.changed]),
        actions: [action('verify', fixture.verify, 'verified', `Verified the result: ${fixture.verify}.`)],
      },
      verified: {
        title: 'Observed result',
        description: 'Select the two mechanism-and-result observations named in the investigation. Other cards provide context, not extra required selections.',
        evidence: snapshot([capturedCause, fixture.outcome, ...(fixture.verified ?? [])]),
        assess: true,
        actions: [action('reset', 'Restore this fictional fixture', 'initial', 'Restored the opening snapshot for another comparison.')],
      },
    },
    investigation: {
      ...fixture.investigation,
      requiredEvidence: [fixture.cause.id, fixture.outcome.id],
    },
  }
}

const source = (label: string, path: string) => ({ label, url: `https://learn.microsoft.com/${path}` })
const ioSources = [
  source('Overview of the Windows I/O system', 'en-us/windows-hardware/drivers/kernel/overview-of-the-windows-i-o-system'),
  source('I/O request packets', 'en-us/windows-hardware/drivers/kernel/i-o-request-packets'),
]
const accessSources = [
  source('Access tokens', 'en-us/windows/win32/secauthz/access-tokens'),
  source('How DACLs control access', 'en-us/windows/win32/secauthz/how-dacls-control-access-to-an-object'),
]
const bootSources = [
  source('Secure Boot', 'en-us/windows-hardware/design/device-experiences/oem-secure-boot'),
]
const vbsSources = [
  source('Virtualization-based security', 'en-us/windows-hardware/design/device-experiences/oem-vbs'),
  source('Memory integrity', 'en-us/windows/security/hardware-security/enable-virtualization-based-protection-of-code-integrity'),
]

interface Lesson {
  id: string
  title: string
  objective: string
  icon: string
  guided: Experiment
  transfer: Experiment
  concept: Scene['concepts'][number]
  hint: string
  sources: Scene['sources']
  limits: string
  level?: number
}

function lesson(content: Lesson): Scene {
  return {
    id: content.id, level: content.level ?? 5, title: content.title,
    objective: content.objective, icon: content.icon,
    guided: content.guided, transfer: content.transfer,
    concepts: [content.concept],
    hints: [
      content.hint,
      'Try the contrasting action, read what actually changed, then use its recovery action.',
      `For the explanation, select only "${content.guided.investigation.requiredEvidence[0]}" and "${content.guided.investigation.requiredEvidence[1]}" in guided practice. The transfer also names its two observations in the question.`,
    ],
    sources: content.sources,
    simplification: `Browser-only fictional, deterministic snapshots, not actual Windows emulation or live measurements. No credentials, real ACLs, boot settings, or host protections are changed. ${content.limits}`,
  }
}

const routeGuided = experiment({
  briefing: 'The training editor reads a small file from the supplied storage device. Follow this selected uncached request, not a claim about every Windows read.',
  prediction: check('Where will this selected request go?', 'Through the file-system, volume and storage drivers',
    ['Every request goes directly from the app to hardware', 'All Windows I/O uses this identical route'],
    'The I/O manager coordinates this selected driver path. Cached, fast, network and other operations can follow different routes.'),
  initial: [evidence('request', 'File READ; selected storage route', 'The browser fixture explicitly chooses this path; it does not infer it from a real application.')],
  cause: evidence('route', 'File system -> volume -> storage', 'The selected request passes through these three modeled driver roles under I/O-manager coordination.'),
  inspected: [evidence('position', 'At file-system driver', 'The request has entered the selected stack; the storage driver has not received it yet.')],
  detour: [evidence('position', 'App cannot bypass this selected driver route', 'A direct-hardware shortcut is rejected; no request or host setting changes.')],
  changed: [evidence('position', 'Storage driver receives READ', 'File-system and volume layers have forwarded the request to the modeled device-facing layer.')],
  outcome: evidence('outcome', 'Storage completed READ; result returned to editor', 'Completion returns through this selected path; the editor receives the requested data.'),
  inspect: 'Trace the chosen driver stack', contrast: 'Try to skip straight from editor to hardware',
  recover: 'Discard the shortcut and trace the selected stack',
  advance: 'Forward through volume to storage', verify: 'Follow completion back to the editor',
  investigation: check('Select route + outcome. What explains delivery?', 'The selected layers forwarded and completed this request',
    ['The app executed the storage driver directly', 'Every kind of I/O must have these layers'],
    'Route evidence identifies the chosen stack, and the outcome verifies its return path. Neither observation establishes a universal I/O route.'),
})

const routeTransfer = experiment({
  briefing: 'Now the supplied client sends a network message. The selected route uses a protocol and adapter, with no file-system or volume layer.',
  prediction: check('Must this message pass through the storage stack?', 'No; this fixture selects a network driver route',
    ['Yes; every packet is a file READ', 'No operating-system component is involved'],
    'Changing the operation changes the modeled route. Network I/O is not evidence that a volume or storage driver handled the message.'),
  initial: [evidence('request', 'Network SEND; selected adapter route', 'This is a different operation and set of driver roles, not the editor with a new name.')],
  cause: evidence('route', 'Network protocol -> network adapter', 'The chosen protocol layer passes this message to the supplied adapter path.'),
  detour: [evidence('position', 'Storage route rejected for network SEND', 'No storage request is issued by the incorrect routing choice.')],
  changed: [evidence('position', 'Adapter accepts SEND', 'The protocol layer forwarded the selected message; acceptance is not yet observed completion.')],
  outcome: evidence('outcome', 'Adapter completed SEND; client notified', 'The completion belongs to this modeled network route, not to the storage fixture.'),
  inspect: 'Inspect operation and network route', contrast: 'Route SEND through the volume driver',
  recover: 'Restore SEND and inspect its network route',
  advance: 'Forward protocol work to the adapter', verify: 'Observe adapter completion and client notification',
  investigation: check('Select route + outcome. Why does this route differ?', 'Operation and driver roles changed; no universal stack is implied',
    ['File-system layers are hidden in every SEND', 'Applications always talk directly to adapters'],
    'The selected SEND route and its verified notification support this path only. This lesson does not specify the complete real Windows networking architecture.'),
})

const packet = (write: boolean): Experiment => experiment({
  briefing: write
    ? 'The transfer logger issues a WRITE of 128 bytes at offset 8192. Follow the same request identity through a filter with a distinct stack location.'
    : 'The editor issues a READ of 512 bytes at offset 4096. Inspect the request packet and the operation data supplied to each driver.',
  prediction: check('Will forwarding turn this into a new unrelated request?', 'No; request identity is shared, while a driver uses its stack location',
    ['Yes; each driver must get a different application request', 'A stack location is a CPU call-stack frame'],
    'An IRP carries request-wide fields and I/O stack locations. Driver-specific operation parameters are not CPU stack frames or universal fixed offsets.'),
  initial: [evidence('request', write ? 'IRP W1; WRITE requested' : 'IRP R1; READ requested', 'Identity stays stable through this bounded two-driver route.')],
  cause: evidence('parameters', write ? 'WRITE; offset 8192; length 128; current location 0' : 'READ; offset 4096; length 512; current location 0',
    'The operation and selected parameters reside in the modeled current I/O stack location; request-wide identity and final status are separate.'),
  detour: [evidence('packet', 'Wrong operation rejected; original request unchanged', 'Treating the offset as a byte count or changing READ to WRITE is rejected before forwarding.')],
  changed: [evidence('packet', write ? 'WRITE; offset 8192; length 128; stack location 1' : 'READ; offset 4096; length 512; stack location 1',
    'The upper layer prepared the next stack location and forwarded the same IRP identity. No buffer-management or binary-layout model is implied.')],
  outcome: evidence('outcome', write ? 'IRP W1 completed; WRITE 128 bytes at 8192' : 'IRP R1 completed; READ 512 bytes at 4096',
    'The final result agrees with the operation, count and offset that were forwarded.'),
  inspect: 'Inspect operation parameters and current location', contrast: 'Confuse offset with length and change the operation',
  recover: 'Restore the original operation and parameters',
  advance: 'Prepare the next driver stack location', verify: 'Compare final operation, byte count and offset',
  investigation: check('Select parameters + outcome. What stayed consistent?', 'The operation and supplied parameters followed one IRP through separate locations',
    ['The I/O stack location is a virtual memory page', 'Every driver interpreted the request as the same CPU stack frame'],
    'The observed parameter tuple and final byte count support one request passing between driver locations. Real drivers may transform parameters with defined responsibilities.'),
})

const pending = (failure: boolean): Experiment => experiment({
  briefing: failure
    ? 'A telemetry read is pending. In this changed fixture the device disconnects before completing; unrelated UI work is still runnable.'
    : 'An editor read is pending on the storage device. Let its independent UI task run while the eventual result is unavailable.',
  prediction: check('Does pending already mean success or failure?', 'Neither; unrelated work can run while the final result is unknown',
    ['Pending proves failure', 'Pending guarantees eventual success'],
    'Pending reports an outstanding operation, not its final status. The issuing code and completion mechanism determine how the result is later observed.'),
  initial: [evidence('status', 'Pending; result unavailable', 'The device has not completed this request. The independent UI task is ready.')],
  cause: evidence('pending', 'Request outstanding; independent UI task can run', 'A waiting request is distinct from an unrelated runnable thread; this does not guarantee that every asynchronous API leaves its caller runnable.'),
  inspected: [evidence('status', 'Pending; result unavailable', 'Inspecting the request does not finish it.')],
  detour: [evidence('status', 'Pending; result unavailable; UI task finished', 'The UI task performed its bounded work without completing the outstanding request.')],
  changed: [evidence('status', failure ? 'Device disconnected; failure completion queued' : 'Device finished read; success completion queued',
    'The device event determines the result; completion notification has not yet been consumed by the client.')],
  outcome: evidence('outcome', failure ? 'Failure; device disconnected; 0 bytes delivered' : 'Success; 512 bytes delivered',
    'The client now observes a terminal result, unlike the earlier pending status.'),
  inspect: 'Inspect outstanding request and runnable work', contrast: 'Run one unrelated UI task while pending',
  recover: 'Restore the comparison and inspect the outstanding request',
  advance: failure ? 'Deliver the modeled disconnect event' : 'Deliver the modeled device-read completion',
  verify: 'Consume completion and check final status',
  investigation: check('Select pending + outcome. What did pending establish?', 'Only that the result was outstanding; the later event supplied the final outcome',
    ['Pending already contained the final status', 'Running unrelated UI work repaired the device'],
    'The pending observation and terminal outcome are different stages. In the transfer a device disconnect produces failure, proving that pending never promised success.'),
})

const completion = (failure: boolean): Experiment => experiment({
  briefing: failure
    ? 'The lower driver reports device failure. An upper completion callback retains the request to record diagnostics before resuming final completion.'
    : 'The lower driver finishes a read. An upper completion callback retains the request for a bounded post-processing step; final ownership has not yet returned.',
  prediction: check('May the final owner release the buffer as soon as the lower driver finishes?', 'No; this callback retains the request until completion resumes',
    ['Yes; lower completion always ends all ownership', 'No; retained requests can never complete'],
    'A completion routine may stop further completion processing. This fixture waits for its explicit resume before the final owner releases resources.'),
  initial: [evidence('status', 'Lower operation in flight; buffer owned', 'The fixture has one request and one buffer; release is not available while either is in use.')],
  cause: evidence('ownership', failure
    ? 'Lower driver failed; callback retains request; buffer not released'
    : 'Lower driver completed; callback retains request; buffer not released',
  'This is lower-layer completion, not the final ownership handoff. The modeled callback stops completion processing while it does bounded work.'),
  detour: [evidence('ownership', 'Early release rejected; callback still owns request', 'The unsafe choice does not free the buffer. Restore the retained state and resume completion correctly.')],
  changed: [evidence('ownership', 'Callback resumed completion; final owner may now release',
    'The callback finished its work and explicitly resumed the return path. Only the final owner now has the release responsibility.')],
  outcome: evidence('outcome', 'One final completion; buffer released once', 'Final ownership was returned before one release; no double completion or early free occurred.'),
  verified: [evidence('status', failure ? 'Final failure; diagnostic recorded; 0 bytes' : 'Final success; post-processing complete; 512 bytes',
    'Resuming completion preserves the lower status in this fixture; recording a diagnostic does not turn failure into success.')],
  inspect: 'Observe lower completion and callback ownership', contrast: 'Try to release while the callback retains',
  recover: 'Restore the retained request without freeing',
  advance: 'Finish callback work and resume completion', verify: 'Hand off to final owner and release once',
  investigation: check('Select ownership + outcome. What made release safe?', 'The callback resumed completion before final ownership and one release',
    ['Lower-layer completion alone transferred all ownership', 'A failure allows earlier release than success'],
    'The ownership transition and one-release outcome establish the safe lifetime here. Real callback return values and ownership conventions require driver-specific contracts.'),
})

function cancellation(failure: boolean): Experiment {
  const terminal = failure ? 'Failure' : 'Success'
  const finish = failure ? 'device error' : '512 bytes'
  const lifetime = evidence('lifetime', 'Cancellation requested; request and buffer still owned',
    'Requesting cancellation is not completion. This fixture serializes competing events to select exactly one terminal owner.')
  const released = (cancelled: boolean): Evidence[] => [
    evidence('race', cancelled ? 'Cancel won; cancelled; terminal count 1' : `${terminal} won; late cancel ignored; terminal count 1`,
      'Captured ordering diagnosis: one terminal owner won. The losing event never adds another completion.'),
    evidence('outcome', `${cancelled ? 'Cancelled' : terminal}; terminal count 1; release count 1`,
      'The final owner released only after terminal completion. A later cancellation/completion event cannot reuse the released request.'),
  ]
  return {
    briefing: failure
      ? 'A device-error completion competes with cancellation. Change the event ordering, not the terminal-count rule.'
      : 'An editor read has two competing events: cancel request and device success. Try both orderings before explaining buffer lifetime.',
    prediction: check('If cancellation is requested first, is the buffer already safe to release?', 'No; wait for one terminal completion',
      ['Yes; requesting cancel always frees the buffer', 'Both cancel and device must each complete the request'],
      'Cancellation is a request, not proof that all users of the buffer have finished. This serialized teaching race has one winning terminal completion.'),
    initial: 'initial',
    nodes: {
      initial: {
        title: 'Two events can arrive',
        description: 'Choose which arrives first. No real request is submitted.',
        evidence: [evidence('lifetime', 'Pending; terminal count 0; release count 0', 'Both event orderings are possible in the fixture; no resource is yet releasable.')],
        actions: [
          action('cancel', 'Request cancellation first', 'cancel-first', 'Cancellation requested; no completion and no buffer release yet.'),
          action('complete', `Deliver ${terminal.toLowerCase()} first`, 'complete-first', 'The device event acquired the single terminal-completion ownership.'),
        ],
      },
      'cancel-first': {
        title: 'Cancel requested, not completed', description: 'Only the cancellation owner can now complete this serialized fixture.',
        evidence: [lifetime],
        actions: [action('complete', 'Finish cancellation before the device event', 'cancel-completed', 'Cancellation completed once; the late device event cannot complete again.')],
      },
      'cancel-completed': {
        title: 'Cancelled terminal result', description: 'The late device event loses; final ownership is available but the buffer is still retained.',
        evidence: [
          evidence('race', 'Cancel won; cancelled; terminal count 1', 'Cancellation acquired the terminal owner; the competing device event is ignored.'),
          evidence('lifetime', 'Cancelled terminal completion; buffer still owned', 'The final owner must still release once after completion.'),
        ],
        actions: [action('release', 'Final owner releases after cancellation completion', 'cancel-released', 'Released once after the cancelled terminal result; no users remain in this model.')],
      },
      'complete-first': {
        title: 'Device owns the terminal result', description: 'Now deliver a late cancel request and observe whether it can rewrite this result.',
        evidence: [
          evidence('race', `${terminal} won; ${finish}; terminal count 1`, 'The device event acquired terminal ownership before cancellation.'),
          evidence('lifetime', `${terminal} terminal completion; buffer still owned`, 'Completion has occurred, but the final owner has not yet released the buffer.'),
        ],
        actions: [action('cancel', 'Deliver the late cancellation request', 'late-cancel', 'Late cancellation did not create or overwrite a terminal completion.')],
      },
      'late-cancel': {
        title: 'The losing event cannot complete again', description: 'Release is safe after the winning completion, not because the late cancel arrived.',
        evidence: [
          evidence('race', `Late cancel ignored; terminal count 1; ${terminal.toLowerCase()} unchanged`, 'This losing event cannot change terminal ownership.'),
          evidence('lifetime', `${terminal} terminal completion; buffer still owned`, 'The request remains owned until the explicit final release.')],
        actions: [action('release', 'Final owner releases after device completion', 'device-released', 'Released once after device completion; the losing cancel added no completion.')],
      },
      'cancel-released': {
        title: 'Cancelled and safely released', description: 'Select race + outcome to explain the one-owner lifetime rule.',
        evidence: released(true), assess: true,
        actions: [action('reset', 'Restore the race to try the other order', 'initial', 'Restored one pending request with no terminal outcome or release.')],
      },
      'device-released': {
        title: 'Device result and safely released', description: 'Select race + outcome to explain why the losing event changes nothing.',
        evidence: released(false), assess: true,
        actions: [action('reset', 'Restore the race to try the other order', 'initial', 'Restored one pending request with no terminal outcome or release.')],
      },
    },
    investigation: {
      ...check('Select race + outcome. What prevented a double free?', 'One terminal owner wins; release follows that completion exactly once',
        ['Requesting cancellation is the release event', 'Device and cancel each own a final completion'],
        'The ordering observation identifies the winner, and the result verifies one terminal completion and one later release. Real cancel synchronization is more complex than these serialized edges.'),
      requiredEvidence: ['race', 'outcome'],
    },
  }
}

const token = (impersonate: boolean): Experiment => experiment({
  briefing: impersonate
    ? 'A service thread starts without impersonation. It deliberately impersonates Customer B for a B-owned read; observe the changed effective identity.'
    : 'A service thread currently impersonates Customer A. Compare its access context with the process identity, then revert for a service-owned maintenance read.',
  prediction: check('Which token governs this modeled object access?', impersonate
    ? 'The process token until this thread impersonates; then Customer B'
    : 'The thread impersonation token, not automatically the service process token',
  ['The executable filename grants access', 'The process token always overrides thread impersonation'],
  'In this fixture a present thread impersonation token supplies the effective caller. Without it, the process primary token supplies the context.'),
  initial: [evidence('process', 'Process primary token Service', 'The primary token is stable; it does not reveal whether this thread currently impersonates a customer.')],
  cause: evidence('identity', impersonate
    ? 'No impersonation; effective token Service'
    : 'Thread impersonates Customer A; effective token Customer A',
  'The selected thread context, not its executable name, determines the caller for the first access in this fixture.'),
  inspected: [evidence('decision', impersonate ? 'B-owned read denied to Service' : 'A-owned read allowed; service maintenance denied',
    'The lab ACL grants the requested READ only to the intended identity; privileges and impersonation levels are outside this exercise.')],
  detour: [evidence('decision', 'Using process identity blindly rejected; effective context unchanged', 'A displayed process name cannot replace the security context used for the access decision.')],
  changed: [evidence('identity', impersonate
    ? 'Thread impersonates Customer B; effective token Customer B'
    : 'Impersonation reverted; effective token Service',
  'The explicit thread-context transition changed the effective token without changing the process primary token.')],
  outcome: evidence('outcome', impersonate ? 'B-owned READ allowed to Customer B; A-owned READ denied'
    : 'Service maintenance READ allowed; A-owned READ denied to Service',
  'Positive and negative object checks are evaluated using the new effective token.'),
  verified: [evidence('identity', impersonate ? 'Thread impersonates Customer B; effective token Customer B'
    : 'Impersonation reverted; effective token Service', 'Current effective identity at verification; earlier observations remain in the action history.')],
  inspect: 'Inspect process and thread tokens plus initial access', contrast: 'Use the process name as the access identity',
  recover: 'Restore the original thread context and inspect tokens',
  advance: impersonate ? 'Impersonate Customer B for B-owned work' : 'Revert impersonation for service-owned maintenance',
  verify: 'Probe the intended object and the other identity object',
  investigation: check('Select identity + outcome. Why did access change?', 'Changing the thread context changed the effective token for this object check',
    ['Renaming the executable changed its rights', 'All threads in a service always access as the process identity'],
    'The effective-token snapshot and positive/negative outcomes support the context change. Reverting is appropriate only for authorized service-owned work, never a bypass for customer authorization.'),
})

const acl = (allowFirst: boolean): Experiment => experiment({
  briefing: allowFirst
    ? 'A deliberately noncanonical ACL puts ALLOW Editors READ + WRITE before DENY Editors WRITE. The caller is an Editor. Use the declared ordered subset, not a universal "deny always wins" slogan.'
    : 'The caller belongs to Readers and Writers. This ordered ACL denies Writers WRITE before allowing Readers READ. The app requests READ + WRITE together.',
  prediction: check('How does this ordered subset evaluate READ + WRITE?', allowFirst
    ? 'The first allow satisfies the full request before the later deny is reached'
    : 'The WRITE deny rejects the whole READ + WRITE request',
  ['Any allowed bit grants the whole request', 'ACE order can never affect an access check'],
  'Our subset walks ACEs in order against remaining requested rights: a matching deny of a remaining bit rejects, and allowing all remaining bits succeeds.'),
  initial: [evidence('request', 'Requested rights READ + WRITE', 'A combined request must obtain every requested right; no partial grant is returned by this fixture.')],
  cause: evidence('acl', allowFirst
    ? 'ALLOW Editors READ + WRITE; DENY Editors WRITE; caller in Editors'
    : 'DENY Writers WRITE; ALLOW Readers READ; caller in both',
  'These are explicit ordered ACEs for a toy object. The transfer intentionally uses noncanonical order to expose remaining-rights evaluation.'),
  inspected: [evidence('decision', allowFirst ? 'READ + WRITE allowed; no rights remain at later deny'
    : 'READ + WRITE denied; first matching ACE denies WRITE',
  'The access check returns a decision for the complete request, not an arbitrary union of allow and deny labels.')],
  detour: [evidence('decision', allowFirst ? 'Assuming every later deny overrides a completed allow is incorrect'
    : 'READ + WRITE denied; WRITE explicitly denied',
  'In the guided case retrying the same combined request cannot borrow the READ allowance to obtain WRITE. In transfer, inspect the actual ACE order rather than claiming a universal deny rule.')],
  changed: [evidence('request', allowFirst ? 'READ + WRITE probe completed; DELETE probe queued'
    : 'Request narrowed to READ; WRITE and DELETE probes queued',
  'Only the justified operation is requested. The ACL itself has not been widened or reordered.')],
  outcome: evidence('outcome', allowFirst ? 'READ + WRITE allowed by first ACE; DELETE denied'
    : 'READ allowed; WRITE denied; DELETE denied',
  'The explicit probes confirm full-request evaluation and lack of ungranted rights.'),
  inspect: 'Walk ordered ACEs against remaining requested rights',
  contrast: allowFirst ? 'Assume a later deny always reverses success' : 'Retry READ + WRITE because READ alone is allowed',
  recover: 'Restore the original request and inspect the actual ACE order',
  advance: allowFirst ? 'Probe the full allowed request without editing the ACL' : 'Request only the READ needed by this operation',
  verify: 'Probe intended access and ungranted rights',
  investigation: check('Select acl + outcome. What explains this decision?', 'Ordered matching ACEs evaluated every requested right, not just one allowed bit',
    ['A matching allow always overrides every deny regardless of order', 'A READ grant implies WRITE and DELETE'],
    'The ACL order and probe outcomes establish this subset decision. Real Windows security descriptors include ownership, auditing, inheritance, privileges and other rules not modeled here.'),
})

interface AccessFixture {
  briefing: string
  cause: string
  grant: string
  boundary: string
  operation: string
  negative?: string
}

const narrowAccess = (fixture: AccessFixture): Experiment => experiment({
  briefing: fixture.briefing,
  prediction: check('Which repair preserves the intended boundary?', 'Grant only the intended identity the required object rights, then probe both sides',
    ['Give Everyone Full control', 'Treat every denial as a bug and disable the boundary'],
    'The fictional object has a missing narrow grant, not a reason to authorize outsiders or deletion. Correct recovery includes positive and negative probes.'),
  initial: [evidence('symptom', 'Authorized delivery denied; outsiders denied', 'Only intended delivery is faulty. Unauthorized work is correctly denied and must remain so.')],
  cause: evidence('cause', fixture.cause, 'Inspection ties the legitimate denial to one missing object-specific grant. No boot, CPU, memory or device fault is present.'),
  inspected: [evidence('request', fixture.operation, 'This operation needs the explicitly listed rights on this dedicated lab object, not administrator membership.')],
  detour: [evidence('probes', 'Broad grant rejected; outsider or DELETE would be allowed',
    'A sandbox what-if detects a widened boundary. The broad candidate is rejected and never applied, even to the fictional active object.')],
  changed: [evidence('grant', fixture.grant, 'Only this authorized identity/object pair receives the required rights; existing denials are not removed.')],
  outcome: evidence('outcome', 'Authorized delivery succeeds; outsider denied; DELETE denied',
    'Three probes ran after the narrow grant: intended delivery, an outsider attempting the same operation, and deletion by the authorized identity.'),
  verified: [
    evidence('grant', fixture.grant, 'Current narrow grant at verification. No Full control or broad group was introduced.'),
    evidence('boundary', fixture.boundary, 'The negative cross-identity probe ran against the repaired object; positive delivery alone would not establish isolation.'),
    ...(fixture.negative ? [evidence('negative', fixture.negative,
      'This additional probe checks the changed transfer boundary without broadening group membership or object rights.')] : []),
  ],
  inspect: 'Inspect effective identity, requested rights and object ACL',
  contrast: 'Preview Everyone Full control and run negative probes',
  recover: 'Discard the broad candidate and restore the missing narrow grant fixture',
  advance: 'Apply the missing identity-specific object grant',
  verify: 'Deliver as authorized identity; probe outsider and DELETE',
  investigation: check('Select cause + outcome. What counts as recovery?', 'The missing narrow grant is repaired; intended delivery works and forbidden probes stay denied',
    ['Any successful delivery proves the ACL safe', 'Outsider access is acceptable if the service works'],
    'The cause identifies the missing authorization, and the result verifies both delivery and preserved denial. No privileges, credentials or real permissions are changed.'),
})

const boot = (unknownAuthority: boolean): Experiment => experiment({
  briefing: unknownAuthority
    ? 'The transfer boot image has a valid signature from an authority outside this fixture trust store. It is not revoked; that alone is insufficient.'
    : 'The startup image is signed by a trusted authority but is now on the supplied revocation list. Inspect why the verified chain refuses it.',
  prediction: check('Does a valid signature alone permit this boot image?', 'No; trusted authority and revocation status also matter',
    ['Yes; any mathematically valid signature is trusted', 'Secure Boot proves all running software is harmless'],
    'The simplified chain checks authority, signature and revocation at this boundary. A valid signature can still belong to an untrusted or revoked image.'),
  initial: [evidence('status', 'Secure Boot on; candidate blocked', 'The candidate image has not been allowed to run in the supplied boot fixture.')],
  cause: evidence('trust', unknownAuthority ? 'Authority untrusted; signature valid; image not revoked'
    : 'Authority trusted; signature valid; image revoked',
  'Trust-store authority, signature validity and revocation are separate inputs. Inspection identifies exactly one rejected input in this fixture.'),
  detour: [evidence('status', 'Signature-only approval rejected; chain unchanged',
    'A signature-only check misses authority or revocation. No boot policy or protection setting is switched off.')],
  changed: [evidence('trust', 'Replacement authority trusted; signature valid; image not revoked',
    'The fixture chooses an already supplied approved replacement. It does not add a trust key, remove revocations or alter firmware.')],
  outcome: evidence('outcome', unknownAuthority
    ? 'Trusted, signed, unrevoked replacement boots; unknown-authority image blocked'
    : 'Trusted, signed, unrevoked replacement boots; revoked image blocked',
  'Positive and negative startup probes verify the chain decision without disabling its checks.'),
  verified: [evidence('scope', 'Boot component accepted; later software safety not established',
    'Passing the boot trust boundary is not a scan or proof about all malware in the operating system.')],
  inspect: 'Inspect authority, signature and revocation separately', contrast: 'Approve based only on signature validity',
  recover: 'Restore blocked candidate and full chain inspection',
  advance: 'Choose the supplied approved unrevoked replacement',
  verify: 'Check replacement boot and rejected-candidate denial',
  investigation: check('Select trust + outcome. Why was the first candidate blocked?', unknownAuthority
    ? 'Its authority was outside the trusted chain; the approved replacement satisfies all checks'
    : 'It was revoked despite a trusted signature; the replacement satisfies all checks',
  ['Secure Boot rejected every unsigned application after login', 'Turning off revocation would preserve the same boundary'],
  'The trust diagnosis and replacement/negative probes establish this startup boundary only. Secure Boot is not a guarantee against all malware or later compromise.'),
})

const isolation = (alreadyEnabled: boolean): Experiment => experiment({
  briefing: alreadyEnabled
    ? 'A prepared status fixture has Secure Boot off, VBS running and memory integrity on. Distinguish the three fields without changing any real setting.'
    : 'The prepared workstation reports Secure Boot on and VBS running, but memory integrity off. VBS availability is not proof that this particular service is enabled.',
  prediction: check('Can one status field stand in for all three protections?', 'No; Secure Boot, VBS and memory integrity describe separate states',
    ['VBS running always means memory integrity is on', 'Secure Boot and memory integrity are alternate names'],
    'VBS uses a virtualization-based isolated environment. Memory integrity is a code-integrity protection that can use it, while Secure Boot checks startup trust.'),
  initial: [evidence('symptom', 'Three independent status fields supplied', 'These are prepared teaching status snapshots, not host detection or advice to toggle real settings.')],
  cause: evidence('protections', alreadyEnabled ? 'Secure Boot off; VBS running; memory integrity on'
    : 'Secure Boot on; VBS running; memory integrity off',
  'Each field is explicitly supplied. A single on/off badge cannot establish all three facts or the health of the whole system.'),
  detour: [evidence('interpretation', 'Combined protection badge rejected; separate statuses unchanged',
    'Collapsing startup trust, isolation infrastructure and code integrity loses the distinction under investigation.')],
  changed: [evidence('fixture', alreadyEnabled ? 'Existing isolated code-integrity fixture selected'
    : 'Prepared memory-integrity-on comparison selected',
  'Selecting a comparison snapshot does not enable a real protection or claim that this host meets deployment prerequisites.')],
  outcome: evidence('outcome', 'Isolated code-integrity fixture enforced; arbitrary kernel compromise not ruled out',
    'The isolated integrity policy rejects the supplied invalid kernel-code candidate; this bounded probe cannot prove that every attack is prevented.'),
  verified: [
    evidence('probes', 'Approved kernel-code fixture accepted; invalid candidate denied',
      'The code-integrity contrast is local to the supplied isolated fixture; no driver is loaded.'),
    evidence('comparison-status', alreadyEnabled ? 'Secure Boot off; VBS running; memory integrity on'
      : 'Secure Boot on; VBS running; memory integrity on',
    'Current selected comparison fixture. The original protections observation is the historical diagnosis, not a current host measurement.'),
  ],
  inspect: 'Read each supplied protection status and its boundary',
  contrast: 'Replace the three fields with one protected badge',
  recover: 'Restore the three-field status snapshot',
  advance: alreadyEnabled ? 'Select the existing isolated policy probe' : 'Select the prepared memory-integrity-on comparison',
  verify: 'Test approved and invalid code candidates in the fixture',
  investigation: check('Select protections + outcome. What is established?', 'Separate status inspection plus a bounded isolated code-integrity result',
    ['All malware is excluded because a badge is green', 'Secure Boot and VBS are interchangeable'],
    'The status diagnosis distinguishes the three protections. The probe verifies only the supplied isolated policy, not immunity from arbitrary kernel compromise or actual deployment readiness.'),
})

export const level5: Scene[] = [
  lesson({
    id: 'l5-1', title: 'From Application to Device', icon: 'IO',
    objective: 'Follow one selected request route without treating it as universal.',
    guided: routeGuided, transfer: routeTransfer,
    concept: { term: 'Selected driver route', explanation: 'The I/O manager coordinates requests through appropriate driver roles; not every operation follows the same path.',
      depth: 'Real Windows includes cached and fast paths, varied device stacks and networking layers. The fixture shows selected roles, not every driver or every system-service transition.' },
    hint: 'First read the operation: file READ and network SEND select different driver roles.',
    sources: ioSources, limits: 'Only the named routes are modeled; cached I/O, fast I/O and complete real driver topology are omitted.',
  }),
  lesson({
    id: 'l5-2', title: 'The Request Packet', icon: 'IRP',
    objective: 'Separate request-wide identity from operation parameters and driver stack locations.',
    guided: packet(false), transfer: packet(true),
    concept: { term: 'IRP and I/O stack location', explanation: 'An I/O request packet carries a request through drivers; each location supplies operation-specific information.',
      depth: 'IRP and IO_STACK_LOCATION are real driver structures, but their fields and usage require documented contracts. We model only identity, READ/WRITE, offset, length and a two-location progression.' },
    hint: 'Compare the operation, offset and length before and after forwarding; location changes, request identity does not.',
    sources: [...ioSources, source('I/O stack locations', 'en-us/windows-hardware/drivers/kernel/i-o-stack-locations')],
    limits: 'Location 0/1 are illustrative indices, not universal structure offsets. Buffer methods and parameter transformations are omitted.',
  }),
  lesson({
    id: 'l5-3', title: 'Pending Is Not Failed', icon: 'IO',
    objective: 'Distinguish pending from terminal status while independent work runs.',
    guided: pending(false), transfer: pending(true),
    concept: { term: 'Asynchronous completion', explanation: 'Pending means the result is outstanding. Later completion may succeed or fail while unrelated work can proceed.',
      depth: 'Real APIs differ in waiting and notification contracts, including events, callbacks and completion ports. We model an independent UI task and one explicit terminal notification, not all caller behavior.' },
    hint: 'Run the independent UI task and ask whether that action completed the I/O.',
    sources: [...ioSources, source('Synchronous and asynchronous I/O', 'en-us/windows/win32/fileio/synchronous-and-asynchronous-i-o')],
    limits: 'A serialized success/disconnect event supplies the final outcome; pending does not guarantee success or that the issuing thread is runnable.',
  }),
  lesson({
    id: 'l5-4', title: 'The Return Journey', icon: 'IO',
    objective: 'Track retained completion and final ownership before releasing resources.',
    guided: completion(false), transfer: completion(true),
    concept: { term: 'Completion ownership', explanation: 'Lower completion can stop at a retaining callback. Final release follows resumed completion and an explicit ownership handoff.',
      depth: 'Driver completion routines may return STATUS_MORE_PROCESSING_REQUIRED to stop further completion. Correct real-driver ownership depends on the complete request contract, not just the lower status.' },
    hint: 'Read who still owns the buffer after lower completion; the retained callback must finish and resume.',
    sources: [...ioSources, source('Completing IRPs', 'en-us/windows-hardware/drivers/kernel/completing-irps')],
    limits: 'One retaining callback and one final owner are modeled; no actual callback, IRQL, IRP allocation or driver code runs.',
  }),
  lesson({
    id: 'l5-5', title: 'Cancellation and Failure', icon: 'IO',
    objective: 'Compare cancellation orderings with one terminal outcome and one later release.',
    guided: cancellation(false), transfer: cancellation(true),
    concept: { term: 'Cancellation race', explanation: 'Requesting cancel is not completion. One terminal owner wins; the losing event cannot complete again.',
      depth: 'Real cancellation requires synchronization of cancel routines, request queues and completion ownership. These serialized edges illustrate lifetime invariants, not a safe driver implementation recipe.' },
    hint: 'Try cancel first and complete first. The buffer stays owned until a terminal result in both paths.',
    sources: [...ioSources, source('Canceling IRPs', 'en-us/windows-hardware/drivers/kernel/canceling-irps')],
    limits: 'Cancel-first deterministically wins in this fixture; in real drivers a cancel request does not guarantee a cancelled final status. No concurrency primitive is emulated.',
  }),
  lesson({
    id: 'l5-6', title: 'Identity of the Caller', icon: 'ACL',
    objective: 'Identify the effective process or thread impersonation token for a selected access.',
    guided: token(false), transfer: token(true),
    concept: { term: 'Effective token', explanation: 'For this access, a present thread impersonation token supplies identity; otherwise the process primary token does.',
      depth: 'Real access checks also depend on token groups, privileges, restrictions, impersonation level and API behavior. Service-owned maintenance is explicitly authorized; revert is not a way to bypass customer checks.' },
    hint: 'Inspect the thread token before assuming the service process identity applies.',
    sources: [...accessSources, source('Client impersonation', 'en-us/windows/win32/secauthz/client-impersonation')],
    limits: 'Fixed fictional tokens and READ-only ACLs are supplied. No authentication, token acquisition or impersonation of real users occurs.',
  }),
  lesson({
    id: 'l5-7', title: 'The Access Decision', icon: 'ACL',
    objective: 'Explain full requested-rights decisions using a declared ordered ACL subset.',
    guided: acl(false), transfer: acl(true),
    concept: { term: 'Ordered DACL evaluation', explanation: 'Walk matching ACEs against remaining requested rights. A deny of a remaining bit rejects; allowing all requested bits succeeds.',
      depth: 'Canonical DACL ordering generally places explicit denies before explicit allows. The transfer deliberately uses noncanonical order. Real descriptors also include owner, SACL, inheritance, generic mappings and privilege rules.' },
    hint: 'Track which requested rights remain at each ACE; one allowed bit does not satisfy a larger request.',
    sources: [...accessSources, source('Order of ACEs', 'en-us/windows/win32/secauthz/order-of-aces-in-a-dacl')],
    limits: 'Only matching explicit READ/WRITE/DELETE allow/deny ACEs are evaluated; no MAXIMUM_ALLOWED, generic rights or privilege overrides. An empty DACL denies discretionary access; a null DACL permits discretionary full access. Neither is shorthand for a complete real-system security decision.',
  }),
  lesson({
    id: 'l5-8', title: 'Least Privilege', icon: 'ACL',
    objective: 'Repair an object-specific grant and verify intended, outsider and delete probes.',
    guided: narrowAccess({
      briefing: 'The exporter must WRITE an existing report object; its token has READ only. Repair this single object without authorizing unrelated identities or deletion.',
      cause: 'Exporter token matches object ACL; WRITE missing; READ already allowed',
      grant: 'Report object: Exporter READ + WRITE; no DELETE',
      operation: 'WRITE existing report object; no create, rename or delete',
      boundary: 'Exporter WRITE succeeds; Observer WRITE denied',
    }),
    transfer: narrowAccess({
      briefing: 'The indexer now only needs READ on a supplied archive object. A missing READ grant, not a missing WRITE grant, is the only fault.',
      cause: 'Indexer token matches archive object; READ missing; no write needed',
      grant: 'Archive object: Indexer READ only',
      operation: 'READ supplied archive; delivery means handing its contents to the authorized indexer',
      boundary: 'Indexer READ succeeds; Observer READ denied; Indexer WRITE denied',
    }),
    concept: { term: 'Least privilege', explanation: 'Grant the identity only the rights required on the intended object, then test both success and forbidden actions.',
      depth: 'File creation, rename and deletion can involve directory and parent rights. This fixture avoids those operations and uses one existing toy object so that the required narrow rights are explicit.' },
    hint: 'A delivery probe must pass, but outsider and DELETE probes must still fail.',
    sources: accessSources, limits: 'Dedicated existing toy objects use READ/WRITE/DELETE, not real filesystem generic rights or parent-directory deletion semantics.',
  }),
  lesson({
    id: 'l5-9', title: 'Trust at Startup', icon: 'BOOT',
    objective: 'Use authority, signature and revocation evidence to explain a boot trust decision.',
    guided: boot(false), transfer: boot(true),
    concept: { term: 'Verified boot trust', explanation: 'Secure Boot verifies selected startup components against trusted authority and revocation policy; it does not prevent all malware.',
      depth: 'Firmware trust databases, allowed signatures and forbidden signatures contribute to startup decisions. The supplied three-field chain is deliberately smaller than real platform, key-management and update procedures.' },
    hint: 'A valid signature is only one input. Check the authority and revocation fields separately.',
    sources: bootSources, limits: 'One boot-component boundary is supplied; approved replacements already exist in the fixture. No firmware keys, revocations or real Secure Boot settings change.',
  }),
  lesson({
    id: 'l5-10', title: 'Protecting Beyond the Normal Kernel', icon: 'VBS',
    objective: 'Separate Secure Boot, VBS and memory-integrity status and scope.',
    guided: isolation(false), transfer: isolation(true),
    concept: { term: 'Isolated code integrity', explanation: 'VBS provides isolation infrastructure; memory integrity uses it for code-integrity protection. Secure Boot is a different startup boundary.',
      depth: 'Hypervisor-enforced code integrity isolates security-sensitive decisions from the normal kernel. Configuration, hardware, drivers and deployment prerequisites still matter; a fixture probe does not prove resistance to all kernel attacks.' },
    hint: 'VBS running and memory integrity off can coexist. Read all three supplied fields.',
    sources: [...vbsSources, ...bootSources], limits: 'The transfer is a supplied status combination, not recommended configuration. Comparison selection never changes real protections; code-integrity candidates are inert text.',
  }),
  lesson({
    id: 'l5-11', title: 'A Secure Service', icon: 'ACL',
    objective: 'Restore intended service access while preserving cross-customer isolation.',
    guided: narrowAccess({
      briefing: 'The service correctly impersonates Customer A for delivery to A’s existing inbox object, but its ACL lacks A’s WRITE. B-to-A access must remain denied.',
      cause: 'Effective token Customer A; A inbox missing Customer A WRITE',
      grant: 'A inbox: Customer A WRITE only',
      operation: 'WRITE to existing A inbox; no directory creation or deletion',
      boundary: 'Customer A delivery succeeds; Customer B to A denied',
    }),
    transfer: narrowAccess({
      briefing: 'The service now returns an existing B-owned report rather than writing an inbox. Customer B’s impersonating thread needs READ only; A must not read B’s report.',
      cause: 'Effective token Customer B; B report missing Customer B READ',
      grant: 'B report: Customer B READ only',
      operation: 'READ existing B report and deliver contents to B; no WRITE needed',
      boundary: 'Customer B delivery succeeds; Customer A to B denied',
      negative: 'Customer B WRITE denied; Customer A READ to B denied',
    }),
    concept: { term: 'Positive and negative authorization probes', explanation: 'Intended customer delivery must work, while cross-customer access and deletion remain denied.',
      depth: 'A real multi-customer service must also validate routing and authorization before selecting an object or context. Both are correct in these fixtures; the single fault is a missing customer-specific object grant.' },
    hint: 'Do not revert to a powerful service token to bypass customer checks. Repair the intended customer/object grant.',
    sources: accessSources, limits: 'Customer routing and impersonation are prevalidated supplied facts. No credentials, real customer data or broad privilege repair is used.',
  }),
]

const waitSources = [
  source('Synchronization objects', 'en-us/windows/win32/sync/synchronization-objects'),
  source('Using synchronization', 'en-us/windows/win32/sync/using-synchronization'),
]
const memorySources = [
  source('VirtualAlloc', 'en-us/windows/win32/api/memoryapi/nf-memoryapi-virtualalloc'),
  source('VirtualFree', 'en-us/windows/win32/api/memoryapi/nf-memoryapi-virtualfree'),
  source('Working set', 'en-us/windows/win32/memory/working-set'),
]

const waits = (queueCycle: boolean): Experiment => experiment({
  briefing: queueCycle
    ? 'One worker runs A, which waits for event E. E’s producer is queued behind A on the same sole worker. There is no lock pair; identify the changed dependency cycle.'
    : 'Two supplied workers stopped making progress. A holds X and waits for Y; B holds Y and waits for X. A separate normal event waiter is not part of the fault.',
  prediction: check('Does adding CPU time necessarily resolve this waiting?', 'No; inspect what each waiter needs and who can supply it',
    ['Yes; every wait is caused by slow scheduling', 'Every waiting thread is deadlocked'],
    'Runnable work and dependency cycles are different. A normal event waiter can recover when an independent producer runs; a cycle needs a justified relationship change.'),
  initial: [evidence('symptom', 'Batch stopped; workers waiting; CPU mostly idle', 'One dependency fault is present. Memory, storage and authorization fixtures are healthy.')],
  cause: evidence('cause', queueCycle
    ? 'A waits for event E; producer queued behind A on sole worker; dependency cycle'
    : 'A holds X waits Y; B holds Y waits X; lock cycle',
  'Wait/owner evidence identifies a closed dependency cycle. A separate waiter depends on a producer that remains able to run, so its wait is not a cycle.'),
  inspected: [evidence('normal-wait', 'C waits for event N; independent producer ready', 'Normal waiting has an external path to progress. It should remain a blocking wait until its event is supplied.')],
  detour: [evidence('waits', 'Extra CPU assigned; dependency cycle unchanged',
    'None of the blocked dependencies is made available by more CPU allocation. No forced unlock or event forgery occurs.')],
  changed: [evidence('intervention', queueCycle
    ? 'One bounded producer assigned to independent lane; E supplied'
    : 'Controlled batch rollback; replay acquires X then Y for both workers',
  queueCycle
    ? 'A separate authorized producer lane can supply E without waiting behind A. No arbitrary global thread-count increase or busy polling is used.'
    : 'The fictional batch safely rolls back and releases locks through its owners before replay. A consistent order removes this specific cycle, not every possible deadlock.')],
  outcome: evidence('outcome', queueCycle
    ? 'Producer supplies E; A resumes; next bounded batch completes'
    : 'Ordered replay completes; both locks released by owners; next bounded batch completes',
  'The affected workload and one bounded repeat both made progress after the causal intervention.'),
  verified: [
    evidence('negative', 'Normal event wait still blocks until signalled; no forced unlock',
      'The normal C waiter was first observed blocked, then became ready only after N’s independent producer signalled. The intervention did not bypass synchronization.'),
    evidence('faults', 'Memory baseline; storage healthy; intended access allowed',
      'These supplied healthy controls establish that the fixture contains only the described dependency fault.'),
  ],
  inspect: 'Inspect waiters, owners and the producer path',
  contrast: 'Assign more CPU without changing dependencies',
  recover: 'Restore the blocked batch and its original dependency evidence',
  advance: queueCycle ? 'Run the bounded event producer on an independent lane'
    : 'Safely roll back and replay this batch in consistent X then Y order',
  verify: 'Repeat one batch and probe the separate normal event wait',
  investigation: check('Select cause + outcome. What restored progress?', queueCycle
    ? 'Making the event producer independent broke the sole-worker dependency cycle'
    : 'Owner-driven rollback and consistent replay order removed the observed lock cycle',
  ['Assigning CPU fixed every waiting thread', 'Force-unlocking any object is a safe general fix'],
  'The closed dependency evidence identifies the cause; bounded replay and the normal-wait probe verify a targeted repair. This does not diagnose arbitrary real application hangs.'),
})

const retainedMemory = (cacheOwner: boolean): Experiment => experiment({
  briefing: cacheOwner
    ? 'The completed batch is still referenced by an expired cache entry. Commit is 64 MiB despite a 4 MiB working set; follow ownership rather than treating residency as allocation lifetime.'
    : 'The service retains an unused 80 MiB scratch allocation after a completed batch. Together with a live 16 MiB buffer, commit is 96 MiB. Find what can safely be freed.',
  prediction: check('Will trimming the working set remove retained commitment?', 'No; identify the owner and release unused committed storage safely',
    ['Yes; trim and free mean the same operation', 'Low working set proves low commitment'],
    'Working-set trimming changes residency, not the ownership of committed allocations. Freeing unused committed storage is a separate lifetime operation.'),
  initial: [evidence('symptom', cacheOwner ? 'Commit 64 MiB; working set 4 MiB; batch completed'
    : 'Commit 96 MiB; working set 48 MiB; batch completed',
  'One retained-allocation fault is supplied. There is no lock cycle, storage delay or access fault.')],
  cause: evidence('cause', cacheOwner
    ? 'Completed batch still referenced by cache; commit 64 MiB; working set 4 MiB'
    : 'Unused scratch still owned after batch; commit 96 MiB; live buffer 16 MiB',
  cacheOwner
    ? 'The expired cache entry owns a 48 MiB completed batch. A separate 16 MiB live allocation must remain intact.'
    : 'The scratch owner confirms that no active request still uses its 80 MiB buffer. The 16 MiB live buffer has a different owner.'),
  detour: [evidence('memory', cacheOwner ? 'Working set 2 MiB; commit 64 MiB; trim did not free'
    : 'Working set 8 MiB; commit 96 MiB; trim did not free',
  'The trim comparison evicts resident pages but neither removes the reference nor decommits the retained allocation.')],
  changed: [evidence('memory', cacheOwner ? 'Expired cache reference removed; owner frees 48 MiB; commit 16 MiB'
    : 'Scratch owner frees unused 80 MiB; commit 16 MiB',
  'The bounded lifetime repair checks that no active users remain, releases only the completed allocation, and preserves the live 16 MiB buffer.')],
  outcome: evidence('outcome', 'Commit returns to 16 MiB baseline; retained allocation absent',
    'The commitment counter and owner inventory agree. This result is not inferred from a smaller working set.'),
  verified: [
    evidence('negative', 'Live 16 MiB allocation intact; next bounded batch returns to baseline',
      'A live-buffer read succeeds; one next batch allocates and frees 32 MiB, taking commit 16 -> 48 -> 16 MiB. No active allocation was discarded.'),
    evidence('faults', 'Waits normal; storage healthy; intended access allowed', 'Healthy controls are supplied; the retained completed allocation is the only root cause.'),
  ],
  inspect: 'Inspect commit, residency and allocation owners', contrast: 'Trim resident pages without releasing ownership',
  recover: 'Restore original residency and inspect retained ownership',
  advance: cacheOwner ? 'Remove the expired cache reference and free its completed batch'
    : 'Let the scratch owner free the confirmed unused allocation',
  verify: 'Check commit, live-buffer read and one bounded next batch',
  investigation: check('Select cause + outcome. Why did commitment fall?', 'The confirmed unused allocation was released; trim alone never removed its commitment',
    ['Trimming proves the service has freed every allocation', 'Any low working set eliminates retained storage'],
    'Owner evidence distinguishes live and retained allocations. Baseline commitment plus the live-data and repeat probes establish the bounded lifetime repair, not a universal leak diagnosis.'),
})

const delayedIo = (queueBackoff: boolean): Experiment => experiment({
  briefing: queueBackoff
    ? 'The transfer request has not reached the healthy device: a stale retry-backoff entry delays issue. Storage is idle while independent CPU work finishes.'
    : 'The batch waits on a supplied device path with excessive latency. Its independent CPU task completes, but the outstanding I/O result has not arrived.',
  prediction: check('Will adding CPU fix the observed request delay?', 'Not unless the cause is CPU work; inspect issue, device and completion stages',
    ['Yes; every slow service needs more CPU', 'Pending always means device failure'],
    'An I/O symptom may come from the issued device path or from a pre-issue queue relationship. CPU capacity alone changes neither supplied cause.'),
  initial: [evidence('symptom', 'Delivery delayed; CPU task completed; result unavailable',
    'Only one request-delay fault is supplied. Locks, allocation lifetime and authorized delivery permissions are healthy.')],
  cause: evidence('cause', queueBackoff
    ? 'Queue retry backoff gates issue; storage idle; CPU ready work finishes'
    : 'Request issued; device path delay 12 ticks; CPU ready work finishes',
  queueBackoff
    ? 'The prepared timeline shows no device issue. A stale bounded backoff gate, not physical-device service time, is the root relationship.'
    : 'The prepared timeline identifies the issued device path as the delay. Ticks are narrative ordering units, not a benchmark or actual clock.'),
  detour: [evidence('storage', 'Extra CPU assigned; same delayed I/O; completion unavailable',
    'The extra CPU does not change device service time or the pre-issue retry gate. No completion is invented by scheduling ready work.')],
  changed: [evidence('intervention', queueBackoff
    ? 'Stale backoff cleared for one ready request; healthy device issue recorded'
    : 'One authorized request routed to supplied healthy alternate device path',
  queueBackoff
    ? 'Only the stale gate for this confirmed-ready request is cleared. Offline failures retain a finite retry budget; no unlimited retry loop is added.'
    : 'Only this bounded lab request is redirected to an already supplied authorized healthy path. This is not a universal storage or real hardware repair.')],
  outcome: evidence('outcome', queueBackoff
    ? 'Issue now recorded; healthy device completes; authorized delivery succeeds'
    : 'Healthy alternate path completes in 2 ticks; authorized delivery succeeds',
  'The issue/completion timeline and delivery probe verify the responsible stage changed. CPU-task progress remains independent.'),
  verified: [
    evidence('negative', queueBackoff
      ? 'Offline device still fails; no unbounded retry; CPU work unchanged'
      : 'Device failure still reported; unrelated CPU work unchanged',
    'An explicit failing-device probe remains a terminal failure; the bounded remedy does not suppress errors or alter the independent CPU workload.'),
    evidence('faults', 'Waits normal; commit baseline; unauthorized access denied', 'The healthy controls and preserved authorization boundary exclude extra fixture faults.'),
  ],
  inspect: 'Inspect request issue, device timeline and independent CPU work',
  contrast: 'Assign CPU without changing the request delay',
  recover: 'Restore the delay fixture and inspect its request timeline',
  advance: queueBackoff ? 'Clear only the stale gate for this confirmed-ready request'
    : 'Select the supplied healthy alternate path for one authorized request',
  verify: 'Observe delivery and probe a failing device plus independent CPU work',
  investigation: check('Select cause + outcome. Why did the bounded remedy work?', queueBackoff
    ? 'It repaired the pre-issue backoff relationship; the healthy device could finally receive the request'
    : 'It changed the delayed device path, not the already-healthy CPU work',
  ['More CPU guarantees every I/O result', 'Error suppression proves storage recovery'],
  'Stage-specific evidence identifies the delay. The completion and explicit failing-device probe verify a bounded repair while preserving failure reporting.'),
})

export const capstones: Scene[] = [
  lesson({
    id: 'capstone-waits', level: 6, title: 'Waiting Workers', icon: 'WAIT',
    objective: 'Diagnose a closed dependency, intervene narrowly and preserve normal blocking waits.',
    guided: waits(false), transfer: waits(true),
    concept: { term: 'Dependency investigation', explanation: 'A wait is not automatically a fault. A closed dependency cycle prevents its own producers from supplying progress.',
      depth: 'A consistent lock order addresses the specific two-lock cycle. A producer queued behind its waiter needs a different relationship repair; the transfer changes from lock ownership to queue dependency.' },
    hint: 'Draw who holds or supplies each needed resource; compare the separate normal event waiter.',
    sources: waitSources, limits: 'One cycle is supplied per variant. Controlled rollback and independent producer execution are browser transitions, not real forced unlocks or a general hang-repair procedure.',
  }),
  lesson({
    id: 'capstone-memory', level: 6, title: 'Retained Allocations', icon: 'MEM',
    objective: 'Find retained commitment, free only unused owned storage and preserve live data.',
    guided: retainedMemory(false), transfer: retainedMemory(true),
    concept: { term: 'Commitment and ownership', explanation: 'A completed workload may still own committed allocations. Trimming residency does not release that ownership.',
      depth: 'The transfer retains storage through an expired cache reference rather than a scratch-owner omission. A safe repair follows the final ownership relationship and active users, not an arbitrary memory counter target.' },
    hint: 'Track the 16 MiB live buffer separately from the completed allocation and compare trim against free.',
    sources: memorySources, limits: 'MiB counters are exact supplied values, not RAM accounting or evidence of a universal leak. Ownership release also frees the modeled commitment; real allocation APIs have distinct reserve/decommit/release rules.',
  }),
  lesson({
    id: 'capstone-io', level: 6, title: 'Storage Delay', icon: 'IO',
    objective: 'Locate the delaying stage, change only that relationship and preserve failure reporting.',
    guided: delayedIo(false), transfer: delayedIo(true),
    concept: { term: 'I/O timeline diagnosis', explanation: 'Distinguish a delayed issued request from one held before issue. Additional CPU is not a universal I/O fix.',
      depth: 'The transfer changes the responsible stage to stale pre-issue backoff while the physical device is healthy. An alternate device path would miss that cause; use stage evidence and a finite remedy instead.' },
    hint: 'Was the request actually issued? Compare that observation with device activity and completed CPU work.',
    sources: ioSources, limits: 'Two timeline fixtures represent different single causes. Ticks are illustrative; no storage benchmarks, real device failover, process priority changes or infinite retries occur.',
  }),
  lesson({
    id: 'capstone-access', level: 6, title: 'Authorized Delivery', icon: 'ACL',
    objective: 'Repair legitimate delivery denial while preserving outsider, cross-service and delete denial.',
    guided: narrowAccess({
      briefing: 'The dispatcher has the intended service token, healthy I/O and a correctly selected existing output object. That object lacks Dispatcher WRITE; outsiders are correctly denied.',
      cause: 'Effective token Dispatcher; output object missing Dispatcher WRITE',
      grant: 'Output object: Dispatcher WRITE only',
      operation: 'WRITE existing authorized output object; no delete or directory operation',
      boundary: 'Dispatcher delivers; Outsider delivery denied',
    }),
    transfer: narrowAccess({
      briefing: 'Service B correctly targets B’s output, whose ACL grants WRITE to a delivery group. B’s token is not in that group. Repair this object, not global membership; Service A to B must remain denied.',
      cause: 'Service B lacks Delivery group; B output grants WRITE to Delivery group only',
      grant: 'B output: Service B WRITE only',
      operation: 'Service B WRITE to existing B output; Service A has only its own A output',
      boundary: 'Service B delivers to B; Service A to B denied',
      negative: 'Service B global group membership unchanged; other group-protected object denied',
    }),
    concept: { term: 'Verified narrow authorization repair', explanation: 'Legitimate delivery denial is repaired only when authorized delivery succeeds and unauthorized work stays denied.',
      depth: 'The transfer changes from a missing direct grant to a group-membership/ACL mismatch. Joining the global group would authorize unrelated objects; the bounded repair adds only this intended service/object grant.' },
    hint: 'Inspect the intended identity/object pair. Require successful delivery and negative outsider and DELETE probes.',
    sources: accessSources, limits: 'Only one missing object-specific grant is faulty; routing, token selection, waits, memory and storage are healthy. Real filesystem parent rights, credentials and administrator overrides are excluded.',
  }),
]
