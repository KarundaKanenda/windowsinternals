import type { Check, Evidence, Experiment, Scene, SceneAction, SceneNode } from './types'

const evidence = (id: string, label: string, value: string, detail: string): Evidence =>
  ({ id, label, value, detail })
const action = (id: string, label: string, next: string, log: string): SceneAction =>
  ({ id, label, next, log })
const node = (title: string, description: string, observations: Evidence[], actions: SceneAction[], assess = false): SceneNode =>
  ({ title, description, evidence: observations, actions, ...(assess ? { assess: true } : {}) })
const check = (prompt: string, answer: string, alternatives: string[], explanation: string): Check =>
  ({ prompt, options: [answer, ...alternatives], correct: 0, explanation })
const experiment = (
  briefing: string, prediction: Check, nodes: Record<string, SceneNode>,
  requiredEvidence: string[], investigation: Check,
): Experiment => ({ briefing, prediction, initial: 'start', nodes, investigation: { ...investigation, requiredEvidence } })

const source = (label: string, path: string, anchor: string) =>
  ({ label, url: `https://learn.microsoft.com/en-us/${path}#${anchor}` })
const architecture = source('Kernel-mode driver architecture', 'windows-hardware/drivers/kernel/', 'kernel-mode-driver-architecture-design-guide')
const irqlSource = source('Managing hardware priorities', 'windows-hardware/drivers/kernel/managing-hardware-priorities', 'managing-hardware-priorities')
const objectSource = source('Managing kernel objects', 'windows-hardware/drivers/kernel/managing-kernel-objects', 'managing-kernel-objects')
const syncSource = source('Introduction to kernel dispatcher objects', 'windows-hardware/drivers/kernel/introduction-to-kernel-dispatcher-objects', 'dispatcher-object-states')
const virtualAlloc = source('VirtualAlloc: reservation and commitment', 'windows/win32/api/memoryapi/nf-memoryapi-virtualalloc', 'parameters')
const virtualFree = source('VirtualFree: decommit and release', 'windows/win32/api/memoryapi/nf-memoryapi-virtualfree', 'parameters')
const workingSet = source('Working set', 'windows/win32/memory/working-set', 'working-set')
const protection = source('Memory protection constants', 'windows/win32/memory/memory-protection-constants', 'constants')
const cowSource = source('Copy-on-write protection', 'windows/win32/memory/memory-protection', 'copy-on-write-protection')
const poolSource = source('Paged and nonpaged pool', 'windows-hardware/drivers/gettingstarted/virtual-address-spaces', 'paged-pool-and-nonpaged-pool')

const scene = (
  id: string, level: number, title: string, icon: string, objective: string,
  guided: Experiment, transfer: Experiment, term: string, explanation: string, depth: string,
  hints: string[], sources: Scene['sources'], simplification: string,
): Scene => ({
  id, level, title, icon, objective, guided, transfer,
  concepts: [{ term, explanation, depth }], hints, sources, simplification,
})

export const levels34: Scene[] = [
  scene(
    'l3-1', 3, 'Who Handles What?', 'Route',
    'Follow service responsibilities without treating executive and kernel as mutually exclusive routes.',
    experiment(
      'The training workstation cannot finish a file read. Route the request, then watch the waiting thread resume.',
      check('Can the kernel dispatcher alone construct the file request?',
        'No: executive I/O services construct the request; kernel dispatching also participates later.',
        ['Yes: scheduling replaces I/O management.', 'No kernel component participates in an executive service.'],
        'The executive supplies higher-level services. Lower-level kernel mechanisms support those services; these are cooperating responsibilities.'),
      {
        start: node('A read needs service', 'The application thread asks Windows to read a file. Which responsibility starts this simplified trace?', [], [
          action('route-io', 'Send to executive I/O manager', 'io', 'I/O manager constructs a request for the driver stack.'),
          action('route-kernel', 'Send only to kernel dispatcher', 'wrong', 'Dispatcher selected without constructing an I/O request.'),
        ]),
        wrong: node('Scheduling is not file I/O', 'The dispatcher cannot replace file-service work. Route the unchanged read to the I/O manager.', [
          evidence('routing-error', 'Missing work', 'No driver request constructed', 'Changing which thread runs does not create this file request.'),
        ], [action('route-io', 'Route the read to I/O manager', 'io', 'Recovered by constructing the missing I/O request.')]),
        io: node('Executive service and drivers', 'The read is pending. The application thread waits while the driver services the device.', [
          evidence('io-route', 'Request route', 'I/O manager -> driver stack', 'This is a selected file-read route, not every Windows I/O path.'),
        ], [action('complete', 'Deliver driver completion', 'done', 'Driver completion satisfies the wait; kernel dispatcher readies the thread.')]),
        done: node('Cooperating responsibilities', 'The thread can run again. The executive service and kernel mechanism both took part.', [
          evidence('io-route', 'Request route', 'I/O manager -> driver stack', 'The read was constructed before the driver completed it.'),
          evidence('dispatch-route', 'Thread route', 'Kernel dispatcher readies the waiting thread', 'Being ready is not a promise of immediate execution.'),
        ], [], true),
      }, ['io-route', 'dispatch-route'],
      check('Which explanation matches both observations?',
        'I/O management built the request; kernel dispatching made the satisfied waiter ready.',
        ['Only the executive ran, so no kernel mechanisms were used.', 'The dispatcher read the file itself.'],
        'Component names describe responsibilities, not exclusive boxes. Services can use kernel mechanisms and drivers to complete work.'),
    ),
    experiment(
      'A worker now waits on an unnamed event, not a file. Creating an object and waking a waiter involve different responsibilities.',
      check('Does creating the event itself wake the worker?',
        'No: object management creates it; signaling must satisfy the wait.',
        ['Yes: every object creation schedules a waiting thread.', 'The object manager schedules every thread directly.'],
        'Object management gives the event its managed identity and lifetime. Its signal state and the dispatcher determine whether a waiter becomes ready.'),
      {
        start: node('Event requested', 'The event is not yet created; the worker will wait for a signal.', [], [
          action('create', 'Create the event object', 'created', 'Object manager establishes the event object and its handle.'),
          action('schedule', 'Try scheduling instead', 'wrong', 'Scheduling cannot manufacture the missing event object.'),
        ]),
        wrong: node('No event yet', 'The worker still has no event to wait on. Create the requested object first.', [
          evidence('creation-error', 'Event', 'Not created', 'Scheduling is not object creation.'),
        ], [action('create', 'Create event', 'created', 'Object management creates the event.')]),
        created: node('Created, not signaled', 'The event exists but the worker still waits. Signal it to test the next responsibility.', [
          evidence('object-route', 'Creation', 'Object manager creates event; worker waiting', 'The initial fixture event is nonsignaled.'),
        ], [action('signal', 'Signal the event', 'done', 'Signal satisfies the wait and kernel dispatcher readies the worker.')]),
        done: node('Signal satisfied the wait', 'Object lifetime and execution coordination cooperate; neither alone explains the trace.', [
          evidence('object-route', 'Creation', 'Object manager creates event; worker waiting', 'This records the earlier creation and waiting state.'),
          evidence('wake-route', 'Signal outcome', 'Kernel dispatcher readies event waiter', 'The worker is now ready after the signal.'),
        ], [], true),
      }, ['object-route', 'wake-route'],
      check('What changed between creation and signaling?',
        'Creation supplied the event object; signaling satisfied the wait and enabled dispatch.',
        ['Object creation and scheduling are identical.', 'Signaling moved the worker into user mode immediately.'],
        'Creating a managed object does not satisfy a nonsignaled wait. Signaling changes state that the kernel dispatcher uses.'),
    ),
    'Executive and kernel', 'Executive services manage resources; kernel mechanisms coordinate low-level execution.',
    'Windows kernel-mode architecture also includes drivers and the HAL. The memory manager, object manager and I/O manager cooperate with kernel dispatching; this is not a rigid request-routing taxonomy.',
    ['Name the requested service before naming a component.', 'Compare request construction with the later thread-ready observation.', 'Use both route observations: executive service work and kernel dispatching are compatible.'],
    [architecture], 'Selected fictional service traces omit subsystems, fast paths, HAL details and driver internals. A component is not an exclusive execution lane.',
  ),

  scene(
    'l3-2', 3, 'Something Happened', 'Event',
    'Distinguish asynchronous device interrupts from execution-related exceptions and separate recovery from termination.',
    experiment(
      'The workstation reports a device notification and a missing memory page. Compare their origins before calling either a crash.',
      check('Must an exception terminate the application?',
        'No: a valid demand-zero page fault can be resolved and the instruction retried.',
        ['Yes: exceptions always terminate.', 'No: all exceptions are device interrupts.'],
        'An exception is related to instruction execution. Some are resolved by the OS or a handler; an unhandled access violation can terminate the application.'),
      {
        start: node('Two possible events', 'Deliver a device notification, or inspect a separate invalid-access crash fixture.', [], [
          action('notify', 'Deliver device interrupt', 'interrupt', 'Device notification interrupts execution asynchronously.'),
          action('invalid', 'Test unhandled invalid access', 'fatal', 'A separate application attempts invalid access and has no handler.'),
        ]),
        fatal: node('Unhandled exception', 'This fixture terminates one application, not the entire workstation. Return to the valid-page test.', [
          evidence('fatal-result', 'Invalid-access fixture', 'Unhandled access violation; application terminates', 'There is no valid mapping and no selected recovery handler.'),
        ], [action('restart', 'Restart valid-page experiment', 'start', 'Restored the separate valid-page fixture; no invalid access is repaired by retry alone.')]),
        interrupt: node('Notification arrived', 'The device event did not arise because the interrupted instruction accessed invalid memory.', [
          evidence('event-origin', 'Interrupt origin', 'Device interrupt: asynchronous to the interrupted instruction', 'Interrupt delivery can occur between unrelated instructions.'),
        ], [action('touch', 'Touch a valid committed demand-zero page', 'done', 'Access raises a recoverable page fault; a zero-filled page is supplied.')]),
        done: node('Recoverable exception', 'Windows resolved the valid memory access. The interrupted instruction can be retried.', [
          evidence('event-origin', 'Earlier interrupt', 'Device interrupt: asynchronous to the interrupted instruction', 'This is a historical observation, not a second interrupt.'),
          evidence('exception-result', 'Memory access', 'Demand-zero fault resolved; instruction retried', 'The mapping was valid but had no resident page yet.'),
        ], [], true),
      }, ['event-origin', 'exception-result'],
      check('How are these events different?',
        'The interrupt was asynchronous notification; the page fault was execution-related and recoverable.',
        ['Both were fatal hardware failures.', 'A page fault is a device interrupt because RAM is hardware.'],
        'Origin and outcome are separate questions. Execution-related exceptions include page faults; valid mappings can be resolved without terminating the application.'),
    ),
    experiment(
      'A calculation exception now has an application recovery handler. Compare handling with the same input and no handler.',
      check('Can application recovery differ from retrying a demand-zero access?',
        'Yes: this handler selects recovery code instead of retrying the failing calculation.',
        ['No: every exception retries the same instruction.', 'The handler turns the exception into an interrupt.'],
        'Handling an exception need not mean repeating the failing operation. This fixture selects a recovery path; removing the handler changes the outcome.'),
      {
        start: node('Calculation fault', 'A synchronous calculation exception is pending. Choose the fixture handler policy.', [], [
          action('handle', 'Enable recovery handler', 'handled', 'Application handler selects recovery code for the calculation exception.'),
          action('unhandled', 'Remove recovery handler', 'fatal', 'Without a handler this calculation exception terminates the application.'),
        ]),
        fatal: node('No selected recovery', 'The exception was not a device notification. Restore the handler to compare the same event.', [
          evidence('unhandled-result', 'Outcome', 'Unhandled calculation exception; application terminates', 'Termination is the selected fixture policy, not every exception outcome.'),
        ], [action('handle', 'Restart with handler enabled', 'handled', 'Restarted the same calculation fixture with its recovery handler.')]),
        handled: node('Recovery code selected', 'The application continues at its recovery code, not by retrying the invalid calculation.', [
          evidence('handled-result', 'Handler outcome', 'Handler selected; application continues at recovery code', 'This is explicit application handling.'),
        ], [action('inspect', 'Inspect event origin', 'done', 'Trace confirms the calculation instruction raised the exception.')]),
        done: node('Origin and policy', 'The instruction caused the event; handler policy made it recoverable.', [
          evidence('handled-result', 'Handler outcome', 'Handler selected; application continues at recovery code', 'Recovery does not imply all exceptions are harmless.'),
          evidence('origin', 'Trigger', 'Synchronous calculation exception at the executing instruction', 'No device interrupt caused this fixture event.'),
        ], [], true),
      }, ['handled-result', 'origin'],
      check('Why did this application survive?',
        'A synchronous exception had an explicit recovery handler.',
        ['All exceptions automatically recover.', 'It was an interrupt, so application handling was irrelevant.'],
        'The triggering instruction establishes exception origin. The selected handler establishes recovery; neither implies universal retry or universal fatality.'),
    ),
    'Interrupt and exception', 'Interrupts notify asynchronously; exceptions arise in relation to instruction execution.',
    'This teaching split covers device interrupts and synchronous exceptions. Real platforms have more event classes, software interrupts and detailed exception-dispatch policies.',
    ['Ask what triggered the event.', 'Then ask whether a valid mapping or handler permits recovery.', 'A page fault can resolve; an unhandled invalid access can terminate just the application.'],
    [source('Structured exception handling', 'windows/win32/debug/structured-exception-handling', 'structured-exception-handling'), irqlSource],
    'Bounded event fixtures omit processor-specific exception vectors and debugger policy. Termination shown is an application outcome, not a claim that every exception crashes Windows.',
  ),

  scene(
    'l3-3', 3, 'Urgent Work, Deferred Work', 'IRQL',
    'Move work from ISR to DPC to worker while keeping IRQL, privilege mode and thread priority separate.',
    experiment(
      'The workstation device needs a quick acknowledgment, deferred processing, and later a blocking operation.',
      check('Can a normal DPC perform the blocking operation?',
        'No: defer blocking work to a worker at PASSIVE_LEVEL.',
        ['Yes: give the DPC thread priority 31.', 'Yes: kernel mode permits blocking at every IRQL.'],
        'IRQL constrains what code may do. A DPC runs at DISPATCH_LEVEL and is not an ordinary schedulable thread with a normal thread priority.'),
      {
        start: node('Device notification pending', 'Begin with the short interrupt-service routine (ISR), then move less urgent work out of it.', [], [
          action('interrupt', 'Acknowledge in ISR', 'isr', 'ISR acknowledges the device and queues deferred processing.'),
        ]),
        isr: node('Short immediate handling', 'The ISR runs in kernel mode at the device interrupt level. It must not wait on ordinary blocking work.', [
          evidence('irql', 'IRQL', 'Device IRQL (above DISPATCH_LEVEL)', 'Fixture level is above ordinary DPC execution.'),
          evidence('mode', 'Privilege mode', 'Kernel mode', 'Privilege mode is not a scheduling priority.'),
          evidence('priority', 'Thread priority', 'Not a normal schedulable thread priority', 'The ISR runs in interrupt context, not as a dedicated scheduled thread.'),
          evidence('isr-observed', 'ISR work', 'Device acknowledged; DPC queued', 'Only bounded urgent work was done.'),
        ], [action('queue-dpc', 'Run queued DPC', 'dpc', 'ISR returns; queued DPC performs deferred nonblocking work at DISPATCH_LEVEL.')]),
        dpc: node('Deferred does not mean low IRQL', 'A normal DPC can do bounded nonblocking work. It still cannot perform the required blocking operation.', [
          evidence('irql', 'IRQL', 'DISPATCH_LEVEL', 'Lower than this device ISR, but still too high for blocking waits.'),
          evidence('mode', 'Privilege mode', 'Kernel mode', 'The mode did not change when IRQL changed.'),
          evidence('priority', 'Thread priority', 'Not a normal schedulable thread priority', 'Do not assign a normal thread scheduling priority to this DPC.'),
          evidence('dpc-observed', 'DPC work', 'Deferred nonblocking stage completed', 'Blocking work remains to be done by a worker.'),
        ], [
          action('queue-worker', 'Queue blocking work to worker', 'worker', 'DPC queues a system worker and returns.'),
          action('wait', 'Try a blocking wait in DPC', 'wrong', 'Teaching guard rejects the blocking wait at DISPATCH_LEVEL.'),
        ]),
        wrong: node('Wrong execution context', 'Changing priority cannot make a DPC an ordinary blocking worker.', [
          evidence('wait-result', 'Attempted wait', 'Blocking wait rejected at DISPATCH_LEVEL', 'The simulation rejects the unsafe action rather than executing a driver bug.'),
        ], [action('queue-worker', 'Move work to PASSIVE_LEVEL worker', 'worker', 'Recovered by queuing work to a normal worker thread.')]),
        worker: node('Schedulable worker', 'Now ordinary thread scheduling and a permissible blocking context apply.', [
          evidence('irql', 'IRQL', 'PASSIVE_LEVEL', 'This worker can perform the selected blocking operation.'),
          evidence('mode', 'Privilege mode', 'Kernel mode', 'Lower IRQL did not move execution into user mode.'),
          evidence('priority', 'Thread priority', 'Worker thread priority 8 (fixture)', 'This arbitrary fixture priority is a separate axis from IRQL.'),
          evidence('dpc-observed', 'Earlier DPC', 'Deferred nonblocking stage completed', 'The ISR/DPC work was already completed before queuing this worker.'),
          evidence('worker-observed', 'Worker work', 'Blocking operation completed at PASSIVE_LEVEL', 'A worker provides the context needed for this operation.'),
        ], [], true),
      }, ['dpc-observed', 'worker-observed'],
      check('Why was the worker necessary?',
        'The operation could block; PASSIVE_LEVEL worker context permits it, unlike a DISPATCH_LEVEL DPC.',
        ['The DPC had a normal thread priority that was too low.', 'PASSIVE_LEVEL means user mode.'],
        'IRQL, mode and thread priority are different axes. Both DPC and worker are kernel-mode here, but only the normal worker can perform the selected blocking operation.'),
    ),
    experiment(
      'A device now needs only a bounded nonblocking update. Do not send every operation to a worker merely because it is deferred.',
      check('Does this tiny nonblocking update require a worker?',
        'No: a normal DPC can do this bounded, nonpageable update.',
        ['Yes: all deferred work must be PASSIVE_LEVEL.', 'No: a DPC can also block if it wants.'],
        'Suitability depends on the work. A bounded operation using nonpageable data can run in a DPC; blocking or pageable operations require a suitable lower-IRQL context.'),
      {
        start: node('ISR already queued the update', 'The changed fixture has no blocking operation. Select an execution context.', [], [
          action('dpc', 'Run bounded update in DPC', 'updated', 'DPC updates a nonpaged counter without blocking.'),
          action('wait', 'Add an unnecessary blocking wait', 'wrong', 'Guard rejects blocking at DISPATCH_LEVEL even in a small workload.'),
        ]),
        wrong: node('Size does not permit blocking', 'A short intended wait is still a blocking wait.', [
          evidence('wait-result', 'Attempt', 'Blocking wait rejected at DISPATCH_LEVEL', 'Duration does not remove IRQL constraints.'),
        ], [action('dpc', 'Remove wait and perform update', 'updated', 'Recovered with a bounded nonblocking DPC update.')]),
        updated: node('Update completed', 'The DPC did not need normal thread scheduling or pageable data.', [
          evidence('update-result', 'Counter', 'Nonpaged counter updated; no blocking', 'The chosen work is suitable for DPC context.'),
          evidence('irql', 'IRQL', 'DISPATCH_LEVEL', 'Deferred work is not necessarily PASSIVE_LEVEL work.'),
          evidence('mode', 'Privilege mode', 'Kernel mode', 'Mode is independent of IRQL.'),
          evidence('priority', 'Thread priority', 'Not a normal schedulable thread priority', 'A normal DPC has no ordinary thread priority to tune.'),
        ], [action('inspect', 'Inspect context constraints', 'done', 'Context trace confirms nonpageable code and data and no blocking operation.')]),
        done: node('Right context for this work', 'Contrast this result with the guided blocking operation.', [
          evidence('update-result', 'Counter', 'Nonpaged counter updated; no blocking', 'The update completed before this inspection.'),
          evidence('context-result', 'Context', 'DPC: kernel mode; DISPATCH_LEVEL; no normal thread priority', 'The code and accessed data in this fixture are nonpageable.'),
        ], [], true),
      }, ['update-result', 'context-result'],
      check('Why is DPC context sufficient here but not for the earlier wait?',
        'This work is bounded, nonblocking and nonpageable; the earlier work could block.',
        ['The DPC now has a higher thread priority.', 'Kernel mode always makes pageable access safe.'],
        'Deferred work is not a single scheduling category. The execution constraints of the actual operation determine whether DPC or worker context is suitable.'),
    ),
    'IRQL is not thread priority', 'IRQL governs interruption and execution constraints; thread priority influences ordinary thread scheduling.',
    'This uses ordinary DPCs at DISPATCH_LEVEL, not threaded DPCs. ISR IRQL depends on device and platform. Workers remain kernel-mode threads at PASSIVE_LEVEL in these fixtures.',
    ['Read the three labels separately.', 'A DPC is deferred but still at DISPATCH_LEVEL.', 'Move blocking work to the worker; keep bounded nonpageable work in the DPC.'],
    [irqlSource, source('DPC objects and DPCs', 'windows-hardware/drivers/kernel/dpc-objects-and-dpcs', 'introduction-to-dpc-objects')],
    'ISR and ordinary DPC snapshots are illustrative, not timing measurements. Worker priority 8 is a fixture, not a Windows guarantee; threaded DPCs and platform-specific IRQL details are omitted.',
  ),

  scene(
    'l3-4', 3, 'Objects and Handles', 'Refs',
    'Track handles and retained kernel references to an unnamed teaching object until the last reference is released.',
    experiment(
      'The workstation has two handles to one unnamed teaching object. A pending kernel operation also retains a reference.',
      check('Will closing both handles necessarily destroy this object?',
        'No: the retained kernel reference keeps it alive.',
        ['Yes: handle count is the complete reference count.', 'No: unnamed objects live forever.'],
        'Handles contribute references, but kernel code can retain references too. This fixture destroys the object only when its total reference count reaches zero.'),
      {
        start: node('One object, three references', 'Handles A and B point to the same object; the pending operation holds one more reference.', [
          evidence('references', 'Current references', '2 handles + 1 kernel reference = 3', 'The object is unnamed and nonpermanent.'),
        ], [
          action('close-a', 'Close handle A', 'one', 'Closed A; handle B and the kernel reference remain.'),
          action('release-first', 'Complete kernel operation first', 'kernel-gone', 'Kernel reference released while both handles still keep the object alive.'),
        ]),
        'kernel-gone': node('Handles still own references', 'Releasing the kernel reference was not sufficient to destroy this object. Reset to test closing handles first.', [
          evidence('early-release', 'Lifetime', 'Alive: two handles remain', 'This alternate order leaves two total references.'),
        ], [action('reset', 'Recreate original three-reference fixture', 'start', 'Released old handles and recreated the bounded original fixture.')]),
        one: node('One handle closed', 'Closing one handle removes exactly one fixture reference, not the other handle.', [
          evidence('references', 'Current references', '1 handle + 1 kernel reference = 2', 'Two references still keep the object alive.'),
          evidence('close-a-result', 'Handle A', 'Closed; handle B still valid', 'A handle value and the referenced object are not the same thing.'),
        ], [action('close-b', 'Close handle B', 'no-handles', 'Last handle closed, but pending kernel operation still retains a reference.')]),
        'no-handles': node('No handles, still alive', 'The pending operation still needs the object. Let it finish and release its reference.', [
          evidence('references', 'Current references', '0 handles + 1 kernel reference = 1', 'Handle count alone would miss this remaining owner.'),
          evidence('retained-result', 'Retained reference', 'Kernel operation holds the sole remaining reference', 'The operation explicitly acquired this reference.'),
          evidence('lifetime', 'Lifetime', 'Alive: kernel reference remains', 'There are no open handles, but destruction is not yet allowed.'),
        ], [action('release', 'Finish operation and release kernel reference', 'done', 'Final reference released; teaching object destroyed.')]),
        done: node('Last reference released', 'Now the object can be destroyed. The order of release mattered for its intermediate lifetime.', [
          evidence('references', 'Current references', '0 handles + 0 kernel references = 0', 'No fixture owner remains.'),
          evidence('retained-result', 'Earlier retention', 'Kernel operation held the sole remaining reference', 'This records why closing the last handle was insufficient.'),
          evidence('lifetime', 'Lifetime', 'Destroyed: final reference released', 'The unnamed nonpermanent object has reached zero references.'),
        ], [], true),
      }, ['retained-result', 'lifetime'],
      check('Why did closing the final handle not immediately destroy the object?',
        'The kernel operation retained a reference; destruction followed its final release.',
        ['Every closed handle permanently leaks its object.', 'Unnamed objects require an extra hidden handle forever.'],
        'A handle is one way to own a reference. The observed retained kernel reference explains continued lifetime without inventing another handle or a leak.'),
    ),
    experiment(
      'The kernel operation now finishes before the final duplicated handle closes. Test whether reversing the release order changes the rule.',
      check('Does releasing the kernel reference destroy an object with a duplicated handle still open?',
        'No: that handle still owns a reference.',
        ['Yes: kernel references are the only lifetime owners.', 'Duplicating a handle creates a different object.'],
        'A duplicated handle refers to the same object and contributes a reference. The final remaining reference can be a handle or a kernel reference.'),
      {
        start: node('Duplicated handle remains', 'The original handle is already closed; one duplicated handle and one kernel reference remain.', [
          evidence('references', 'Current references', '1 handle + 1 kernel reference = 2', 'No name or permanence rule keeps this fixture alive.'),
        ], [
          action('release', 'Release kernel reference first', 'released', 'Operation finishes; duplicated handle still references the same object.'),
        ]),
        released: node('Handle keeps object alive', 'The retained kernel reference is gone. Close the remaining handle to test the same lifetime rule.', [
          evidence('release-result', 'Operation', 'Kernel reference released; duplicated handle still open', 'Exactly one reference remains.'),
          evidence('lifetime', 'Lifetime', 'Alive: duplicated handle remains', 'A duplicated handle did not duplicate the object itself.'),
        ], [action('close', 'Close duplicated handle', 'done', 'Closed final handle; total references reach zero and object is destroyed.')]),
        done: node('Same last-reference rule', 'Here a handle, not the kernel operation, released the last reference.', [
          evidence('release-result', 'Earlier operation', 'Kernel reference released; duplicated handle was still open', 'The intermediate owner differed from the guided case.'),
          evidence('lifetime', 'Lifetime', 'Destroyed: final reference released', 'The same zero-reference rule applied in reverse release order.'),
        ], [], true),
      }, ['release-result', 'lifetime'],
      check('What stayed invariant when the release order changed?',
        'The object survived while any fixture reference remained.',
        ['Releasing a kernel reference always destroys the object.', 'Closing one duplicated handle invalidates every other handle.'],
        'The identity of the last owner changed, but the lifetime rule did not. Independent handles and kernel references can keep this same object alive.'),
    ),
    'Reference lifetime', 'A handle refers to an object; object lifetime can extend beyond the last open handle.',
    'This unnamed nonpermanent object has only the explicit owners shown. Real objects can have additional system references, type-specific cleanup, naming and permanent-object rules.',
    ['Count every shown owner, not just handles.', 'After both closes, inspect the pending operation reference.', 'Destruction requires zero total references; reverse the order to test the same rule.'],
    [objectSource, source('Object handles', 'windows-hardware/drivers/kernel/object-handles', 'object-handles')],
    'Counts describe one unnamed nonpermanent teaching object with no hidden owners. They are not raw Object Manager pointer-count fields or a universal destruction trace for every object type.',
  ),

  scene(
    'l3-5', 3, 'Sharing Safely', 'Mutex',
    'Reproduce a lost update and protect the entire read-modify-write operation with a mutex.',
    experiment(
      'Two workstation workers increment one shared counter. Each increment reads a value, adds one locally, then writes it.',
      check('If both workers read 0 before either writes, is final value 2 guaranteed?',
        'No: both may write 1, losing an update.',
        ['Yes: the writes automatically merge.', 'No: the operating system never allows shared counters.'],
        'The multi-step read-modify-write operation is not atomic in this fixture. Interleaving stale reads can lose an update even when each individual read or write is intact.'),
      {
        start: node('Shared counter is 0', 'Each of two workers intends one increment. Compare an unsafe interleaving with a mutex around the full operation.', [
          evidence('counter', 'Counter', '0 (no increments yet)', 'Each read and write is indivisible here, but the whole increment is not.'),
        ], [
          action('interleave', 'Run A-read, B-read, A-write, B-write', 'race', 'Both workers read 0 and then each writes 1.'),
          action('lock-all', 'Protect both full increments', 'safe', 'Serialized both complete read-modify-write operations with one mutex.'),
        ]),
        race: node('An update was lost', 'Both writes succeeded individually, yet the counter is wrong. A write-only lock cannot repair stale reads.', [
          evidence('race-trace', 'Unsafe interleaving', 'A reads 0; B reads 0; A writes 1; B writes 1', 'Each worker computed 1 using the same stale input.'),
          evidence('counter', 'Counter', '1 (two increments attempted)', 'Expected result for two completed increments was 2.'),
        ], [
          action('lock-write', 'Reset and mutex only the writes', 'partial', 'Reset to 0; reads remain outside the mutex and both compute 1.'),
          action('lock-all', 'Reset and mutex read-modify-write', 'safe', 'Reset to 0; one mutex now covers read, modify and write together.'),
        ]),
        partial: node('Partial protection is insufficient', 'Serialized writes still store values computed from stale reads.', [
          evidence('partial-lock', 'Write-only mutex', '1: stale reads still lose an update', 'Mutual exclusion must cover the complete shared invariant operation.'),
          evidence('race-trace', 'Unsafe reads', 'A reads 0; B reads 0; A writes 1; B writes 1', 'The write lock did not change the chosen read interleaving.'),
          evidence('counter', 'Counter', '1 (two increments attempted)', 'Neither write could reconstruct the missed increment.'),
        ], [action('lock-all', 'Reset and protect full operation', 'safe', 'Recovered by moving the reads and modifications inside the same mutex.')]),
        safe: node('Whole-operation protection', 'A owns the mutex while reading and updating; B waits until A releases it.', [
          evidence('safe-trace', 'Mutex trace', 'A: lock/read 0/write 1/unlock; B: lock/read 1/write 2/unlock', 'B observes A’s completed update before computing its own.'),
          evidence('counter', 'Counter', '2 (two increments completed)', 'The result now matches the intended two increments.'),
        ], [], true),
      }, ['safe-trace', 'counter'],
      check('Why does the full mutex fix this lost update while the write-only mutex does not?',
        'It prevents both workers from reading the same stale value before updating.',
        ['It gives both workers extra CPU cores.', 'It makes every shared variable in the process safe forever.'],
        'The protected region includes the read, local modification and write. Protecting only a write does not stop a computation based on a stale read.'),
    ),
    experiment(
      'The counter now starts at 10. Only B uses a mutex; A ignores it. Test whether unilateral locking protects the shared operation.',
      check('Is one worker taking a mutex sufficient if the other ignores it?',
        'No: both accesses must participate in the same synchronization protocol.',
        ['Yes: a mutex locks the memory address against all code automatically.', 'The initial value 10 prevents races.'],
        'A mutex controls cooperating code that acquires it. Unsynchronized accesses can still interleave with a protected operation.'),
      {
        start: node('One-sided protocol', 'Counter 10; B will take mutex M, but A reads and writes without M.', [
          evidence('counter', 'Counter', '10 (no increments yet)', 'The changed condition is participation, not the counter’s spelling.'),
        ], [
          action('interleave', 'Interleave A with protected B', 'race', 'A and B both read 10; each writes 11 despite B holding its mutex.'),
          action('cooperate', 'Make both workers use mutex M', 'done', 'Both workers use the same mutex for the full increment; counter reaches 12.'),
        ]),
        race: node('Mutex did not guard the outsider', 'A never acquired M, so B’s ownership did not exclude A’s access.', [
          evidence('counter', 'Counter', '11 (expected 12)', 'Two attempted increments again used one stale base value.'),
          evidence('participation', 'Lock participation', 'Only B acquired M; A accessed counter without M', 'A lock is not automatic memory-access authorization.'),
        ], [action('cooperate', 'Reset; make A and B use M', 'done', 'Reset to 10; both complete increments under the same mutex.')]),
        done: node('Shared protocol verified', 'Both workers now serialize their complete increment operations.', [
          evidence('participation', 'Lock participation', 'A and B both acquire M around read-modify-write', 'Cooperation on one mutex supplies mutual exclusion.'),
          evidence('counter', 'Counter', '12 (two increments completed)', 'A computes 11; B subsequently reads 11 and computes 12.'),
        ], [], true),
      }, ['participation', 'counter'],
      check('Which change made the transfer safe?',
        'Both workers used the same mutex around the complete operation.',
        ['B used any mutex, regardless of A’s behavior.', 'A higher initial counter value removed the race.'],
        'The invariant depends on all relevant accesses following the same protocol. A lock held by one worker cannot exclude code that ignores it.'),
    ),
    'Lost update', 'An unsafe interleaving can discard a completed update; mutual exclusion protects a complete shared operation.',
    'This demonstrates a prescribed interleaving, not every memory-model detail. An interlocked increment is another suitable solution for a simple counter; a mutex is used to show protection of multi-step invariants.',
    ['Write out each read value before each write.', 'Locking writes alone leaves stale inputs outside the lock.', 'Every participant must use the same mutex for read, modify and write.'],
    [syncSource, source('Synchronization', 'windows/win32/sync/synchronization', 'synchronization')],
    'Individual reads and writes are assumed indivisible; each increment is deliberately non-atomic. No claim is made about a real language data race, compiler reordering, fairness or timing.',
  ),

  scene(
    'l3-6', 3, 'The Frozen Application', 'Wait',
    'Diagnose a lock-owner cycle, reject priority as a repair, and contrast a legitimate I/O wait.',
    experiment(
      'The workstation application is frozen. Capture who owns each lock and who waits before proposing a fix.',
      check('Does a frozen window prove a deadlock?',
        'No: inspect waits and ownership to establish a cycle.',
        ['Yes: every wait is deadlock.', 'No: deadlocks cannot involve two locks.'],
        'A symptom alone does not establish a deadlock. This fixture needs ownership and wait evidence showing each participant cannot proceed without the other.'),
      {
        start: node('Application not responding', 'No diagnosis yet. Inspect the supplied bounded thread evidence.', [], [
          action('inspect', 'Capture thread waits and lock owners', 'cycle', 'Captured A owning L1 while waiting L2 and B owning L2 while waiting L1.'),
        ]),
        cycle: node('Closed lock-owner cycle', 'Neither owner can reach its release while waiting for the lock held by the other.', [
          evidence('wait-graph', 'Wait graph', 'A owns L1 -> waits L2; B owns L2 -> waits L1', 'Each arrow ends at a lock held by the other waiting thread.'),
        ], [
          action('boost', 'Raise thread priority', 'wrong', 'Priority changed but neither held lock was released.'),
          action('order', 'Restart fixture with global L1 then L2 order', 'done', 'Restarted both operations under one global acquisition order; both completed.'),
        ]),
        wrong: node('Ready time is not the problem', 'These threads are waiting for locks, not ready threads starved of CPU.', [
          evidence('wait-graph', 'Wait graph', 'A owns L1 -> waits L2; B owns L2 -> waits L1', 'The ownership cycle is unchanged.'),
          evidence('repair-result', 'Priority experiment', 'Still blocked: priority does not release either lock', 'Scheduling a waiter cannot satisfy its lock dependency.'),
        ], [action('order', 'Restart with L1 then L2 order', 'done', 'Recovered by restarting the controlled operations with consistent lock ordering.')]),
        done: node('Repair verified', 'A bounded restart removed the existing stuck fixture. The new acquisition order prevented its two-lock cycle.', [
          evidence('wait-graph', 'Original cycle', 'A owns L1 -> waits L2; B owns L2 -> waits L1', 'This historical evidence supports the original diagnosis.'),
          evidence('repair-result', 'Ordered rerun', 'Both threads complete: L1 then L2', 'One thread can wait for L1 without holding L2, so the shown cycle does not form.'),
        ], [], true),
      }, ['wait-graph', 'repair-result'],
      check('What both diagnoses and verifies this repair?',
        'A two-lock ownership cycle was observed; the ordered rerun completed both threads.',
        ['A frozen window alone proves every possible deadlock.', 'Higher priority is a general lock release mechanism.'],
        'The wait graph gives the causal diagnosis. A global order prevents this particular cycle in new operations; the bounded restart was needed to clear the already-stuck fixture.'),
    ),
    experiment(
      'A different worker waits on a disk request. No lock-owner cycle is present. Investigate before changing lock order.',
      check('Must this waiting worker be deadlocked?',
        'No: pending I/O can be a legitimate wait with an external completion path.',
        ['Yes: every waiting thread is deadlocked.', 'It needs both lock priorities raised.'],
        'An I/O dependency is not the same as a closed lock-owner cycle. The supplied request can complete independently of this worker.'),
      {
        start: node('Worker waiting', 'The changed fixture is a read request awaiting device completion.', [], [
          action('inspect', 'Inspect wait dependency', 'io', 'Captured a pending disk request and no circular lock ownership.'),
        ]),
        io: node('External completion path', 'The device can finish while the worker waits. Do not invent a lock cycle.', [
          evidence('wait-graph', 'Wait graph', 'Worker -> pending disk request; no lock-owner cycle', 'The request has an external completion path in this fixture.'),
        ], [
          action('complete', 'Deliver disk completion', 'done', 'Disk request completes and the waiting worker becomes ready.'),
          action('order', 'Change unrelated lock order', 'wrong', 'Unrelated lock ordering did not finish the disk request.'),
        ]),
        wrong: node('Unrelated intervention', 'No shown lock cycle was removed. Supply the actual missing event.', [
          evidence('order-result', 'Intervention', 'Worker still waits for disk completion', 'Lock-order repair does not complete an I/O request.'),
        ], [action('complete', 'Deliver disk completion', 'done', 'Completed the actual pending dependency; worker is ready.')]),
        done: node('Legitimate wait ended', 'The worker can resume once scheduled. The wait was not itself proof of deadlock.', [
          evidence('wait-graph', 'Earlier dependency', 'Worker -> pending disk request; no lock-owner cycle', 'The original request dependency is historical evidence.'),
          evidence('wait-result', 'Completion', 'I/O completed; worker ready', 'Ready does not promise instantaneous execution.'),
        ], [], true),
      }, ['wait-graph', 'wait-result'],
      check('Why was completion the right intervention here?',
        'The worker awaited an independently completing I/O request, not a closed lock cycle.',
        ['All waiting threads must be forcibly terminated.', 'The absence of a lock cycle proves every possible hang impossible.'],
        'This supplied wait graph and successful I/O completion explain this fixture. They do not exclude every other kind of hang or prove all real I/O always completes.'),
    ),
    'Wait graph', 'A wait is a dependency; a lock-owner cycle can make progress impossible for the participants.',
    'Consistent acquisition order prevents this shown two-lock cycle if every relevant path follows it. Real hangs can involve other resources, cancellation, external failures or more complex dependencies.',
    ['Identify owners, not only waiting threads.', 'Follow dependencies until they end or return to the starting thread.', 'Repair this cycle with a consistent order; verify both operations complete. For I/O, inspect completion instead.'],
    [source('Critical sections', 'windows/win32/sync/critical-section-objects', 'critical-section-objects'),
      source('Wait chain traversal', 'windows/win32/debug/wait-chain-traversal', 'wait-chain-traversal')],
    'Prepared user-mode wait evidence is fictional. The lock-order action explicitly restarts the stuck fixture; it does not magically release live locks or solve all forms of deadlock.',
  ),

  scene(
    'l4-1', 4, 'Reserve, Commit, Touch', 'RAM',
    'Separate reserved address ranges, committed private pages and current physical residency.',
    experiment(
      'The workstation needs a four-page scratch buffer. Compare reserving addresses, committing pages and touching one page.',
      check('Does reserving four pages make four physical pages resident?',
        'No: reservation selects addresses; commitment and touching are separate.',
        ['Yes: virtual addresses are physical RAM.', 'Commitment is another name for the working set.'],
        'Reservation keeps an address range available. Private commitment incurs backing responsibility; physical pages can be supplied lazily when valid pages are accessed.'),
      {
        start: node('No buffer allocated', 'Use four illustrative pages, not a measurement of browser or Windows memory.', [
          evidence('counters', 'Allocation counters', 'Reserved 0 pages; committed 0; resident 0', 'Reserved means total owned address range, including committed subranges.'),
        ], [action('reserve', 'Reserve four-page address range', 'reserved', 'Reserved four addresses without committing or touching pages.')]),
        reserved: node('Addresses set aside', 'The range exists but has no committed pages. A premature access is invalid.', [
          evidence('counters', 'Allocation counters', 'Reserved 4 pages; committed 0; resident 0', 'No physical pages or private commitment were added.'),
          evidence('reserve-result', 'Reservation', 'Four-page range owned; no backing commitment', 'Reservation alone does not authorize page access.'),
        ], [
          action('commit', 'Commit all four pages', 'committed', 'Committed four private pages without touching them.'),
          action('touch-early', 'Touch before commitment', 'wrong', 'Uncommitted access is rejected; no page becomes resident.'),
        ]),
        wrong: node('Reserved is not accessible', 'The address is owned, but there is no committed accessible page.', [
          evidence('early-touch', 'Access', 'Access violation: reserved but uncommitted', 'No demand-zero page can be supplied for an uncommitted address.'),
          evidence('counters', 'Allocation counters', 'Reserved 4 pages; committed 0; resident 0', 'The rejected access changed no allocation counters.'),
        ], [action('commit', 'Commit the four pages', 'committed', 'Recovery commits the previously reserved range.')]),
        committed: node('Backing responsibility, not four resident frames', 'Each committed private page can be supplied when accessed. Touch just the first page.', [
          evidence('counters', 'Allocation counters', 'Reserved 4 pages; committed 4; resident 0', 'Private commitment is accounted without implying current residency.'),
          evidence('commit-result', 'Commitment', 'Four private pages committed before first touch', 'This bounded fixture has enough commit capacity.'),
        ], [action('touch', 'Write first committed page', 'done', 'Demand-zero access supplies one resident page and the write succeeds.')]),
        done: node('One page touched', 'The other three pages remain committed but untouched.', [
          evidence('counters', 'Allocation counters', 'Reserved 4 pages; committed 4; resident 1', 'Residency reflects the one supplied physical page, not all four virtual pages.'),
          evidence('commit-result', 'Earlier commitment', 'Four private pages committed before first touch', 'This records the lazy-allocation sequence.'),
          evidence('touch-result', 'Touch', 'One valid page supplied and written', 'Commitment was already present when the access occurred.'),
        ], [], true),
      }, ['commit-result', 'touch-result'],
      check('Why did commitment become 4 while residency became only 1?',
        'Four pages have backing commitment; only the touched page has been made resident in this fixture.',
        ['Every committed page must currently be RAM.', 'The other three pages were automatically released.'],
        'Reservation, commitment and residency answer different questions. The valid first touch supplied one physical page without changing the already-established four-page commitment.'),
    ),
    experiment(
      'The four-page reservation contains four committed pages and two resident pages. Decommit two untouched pages, trim one resident page, then release the range.',
      check('Does decommitting two untouched pages release the entire reservation?',
        'No: it reduces commitment while retaining the reserved address range.',
        ['Yes: decommit and release are identical.', 'No: decommit cannot reduce commitment.'],
        'Decommit removes commitment from a subrange. Releasing the entire allocation returns the reservation; resident pages in the retained committed subrange can remain.'),
      {
        start: node('Partly resident buffer', 'Pages 0 and 1 are resident; pages 2 and 3 are committed but untouched.', [
          evidence('counters', 'Allocation counters', 'Reserved 4 pages; committed 4; resident 2', 'The changed experiment begins after two valid touches.'),
        ], [
          action('decommit', 'Decommit untouched pages 2 and 3', 'decommitted', 'Two untouched pages lose commitment; reservation and the resident first two pages remain.'),
        ]),
        decommitted: node('Subrange retained', 'Two pages remain committed and resident. The four-page address range is still owned.', [
          evidence('decommit-result', 'Subrange', 'Pages 2 and 3 uncommitted; reservation retained', 'A later touch of this subrange would be invalid until recommitted.'),
          evidence('counters', 'Allocation counters', 'Reserved 4 pages; committed 2; resident 2', 'Two resident pages were not selected for decommit.'),
        ], [
          action('trim-one', 'Trim resident page 1', 'trimmed', 'Removed page 1 from the working set without decommitting it.'),
        ]),
        trimmed: node('Residency changed separately', 'A separate trim now leaves one resident page, while commitment stays two.', [
          evidence('decommit-result', 'Subrange', 'Pages 2 and 3 uncommitted; reservation retained', 'Decommit and trim affect different counters.'),
          evidence('counters', 'Allocation counters', 'Reserved 4 pages; committed 2; resident 1', 'The trim did not undo the remaining backing commitment.'),
        ], [action('release', 'Release entire reservation', 'done', 'Entire allocation released; reservation, commitment and residency become zero.')]),
        done: node('Range returned', 'Releasing this entire allocation differs from decommitting only its untouched subrange.', [
          evidence('decommit-result', 'Earlier subrange', 'Pages 2 and 3 uncommitted; reservation retained', 'This observation preceded trimming and release.'),
          evidence('release-result', 'Release', 'Entire reservation released; no allocation retained', 'The original address ownership is gone.'),
          evidence('counters', 'Allocation counters', 'Reserved 0 pages; committed 0; resident 0', 'All remaining committed and resident pages belong to the released allocation.'),
        ], [], true),
      }, ['decommit-result', 'release-result'],
      check('Which operation returned address ownership, rather than just backing responsibility?',
        'Release of the entire reservation.',
        ['Decommit of the untouched subrange.', 'Trimming a resident page.'],
        'Decommit preserved address ownership; trim preserved commitment. Releasing the entire allocation finally returned the owned virtual address range.'),
    ),
    'Three memory questions', 'Reservation owns addresses; commitment promises backing; residency describes pages currently in the working set.',
    'Private commitment consumes commit capacity, supported by RAM and pagefile capacity under Windows policy. It is not an advance assignment of one physical frame or a pagefile slot to every page.',
    ['Ask which counter an action should change.', 'Untouched private committed pages need not be resident.', 'Decommit, trim and release are different: backing, working-set membership, and address ownership.'],
    [virtualAlloc, virtualFree, workingSet],
    'Four illustrative pages omit allocation granularity, page-size differences, accounting overhead and background paging. The reserved counter includes committed subranges rather than only MEM_RESERVE-state pages.',
  ),

  scene(
    'l4-2', 4, 'Translate This Address', 'TLB',
    'Translate a toy virtual address through a cached or resident page-table mapping without confusing a TLB miss with a page fault.',
    experiment(
      'The workstation trace uses toy 0x100-byte pages. Process A maps virtual page 2 to resident frame 7; its TLB is empty.',
      check('Does an empty TLB imply a page fault?',
        'No: a page-table walk can find a valid resident mapping.',
        ['Yes: every cache miss reads the pagefile.', 'No: virtual addresses are already physical addresses.'],
        'The TLB caches translations. A cache miss requires finding a translation, but a valid resident page-table entry can satisfy the access without a page fault.'),
      {
        start: node('Mapping exists, cache empty', 'Translate VA 0x234. Split the toy address into virtual page 2 and offset 0x34.', [
          evidence('mapping', 'Page-table fixture', 'Process A: page 2 -> resident frame 7', 'Page size is 0x100 only for this arithmetic example.'),
        ], [
          action('translate', 'Walk mapping for VA 0x234', 'walked', 'TLB miss walks a resident mapping and caches page 2 -> frame 7.'),
          action('fault', 'Assume pagefile read on TLB miss', 'wrong', 'No storage read occurred: resident page-table mapping already exists.'),
        ]),
        wrong: node('Cache miss is not absent page', 'The mapping is still valid and resident. Look it up rather than inventing a storage access.', [
          evidence('assumption-result', 'Storage', '0 reads: resident mapping available', 'A translation cache miss alone does not establish a page fault.'),
        ], [action('translate', 'Walk the actual mapping', 'walked', 'Recovered by using the existing resident page-table mapping.')]),
        walked: node('First translation', 'Use frame 7 with the unchanged offset 0x34. Cache the mapping for the next access.', [
          evidence('translation', 'Address calculation', 'VA 0x234 -> page 2 + offset 0x34 -> frame 7 -> PA 0x734', '0x700 is the frame base in this toy model.'),
          evidence('fault-count', 'Access counters', '0 page faults; 1 TLB miss', 'A page-table walk supplied the translation without fetching a page.'),
        ], [action('repeat', 'Access VA 0x234 again', 'done', 'Second access hits the cached page 2 -> frame 7 translation.')]),
        done: node('Cached translation', 'The physical destination is unchanged; the translation lookup path is shorter.', [
          evidence('translation', 'Address calculation', 'VA 0x234 -> page 2 + offset 0x34 -> frame 7 -> PA 0x734', 'The offset remains the same when translating a page.'),
          evidence('fault-count', 'Access counters', '0 page faults; 1 TLB miss', 'The second access added a hit, not another miss.'),
          evidence('cache-result', 'Second access', 'TLB hit: frame 7; no page-table walk', 'Caching the translation is not caching application file contents.'),
        ], [], true),
      }, ['translation', 'cache-result'],
      check('Why did neither access require a page fault?',
        'The mapping was valid and resident; the first walked it and the second used the TLB.',
        ['A TLB miss always invokes the pagefile.', 'The TLB permanently pins every mapped page in RAM.'],
        'The TLB miss describes a translation-cache state. The resident page-table mapping describes whether this access needs page-fault resolution.'),
    ),
    experiment(
      'Switch to process B. The same virtual page 2 maps to resident frame 9. Its process-specific translation must not reuse A’s frame 7.',
      check('Must VA 0x234 still translate to PA 0x734 after switching processes?',
        'No: process B has its own page-2 mapping to frame 9.',
        ['Yes: the virtual number determines one global frame.', 'It must cause a pagefile read because the process changed.'],
        'Virtual address meaning depends on address-space context. A different valid resident mapping changes the physical frame without requiring a fault.'),
      {
        start: node('New address-space context', 'Process B has a valid resident mapping and no matching cached translation in this fixture.', [
          evidence('mapping', 'Process B mapping', 'Process B: page 2 -> resident frame 9', 'A’s cached translation cannot be mistaken for B’s translation.'),
        ], [
          action('translate', 'Translate in process B context', 'walked', 'Walked B’s resident mapping to frame 9 with offset 0x34.'),
          action('reuse-a', 'Reuse A’s frame 7 without context', 'wrong', 'Teaching guard rejects an address-space-mismatched translation.'),
        ]),
        wrong: node('Context matters', 'Identical virtual numbers do not imply identical physical destinations.', [
          evidence('context-error', 'Cache selection', 'A translation is not valid as B translation', 'Real hardware and Windows manage address-space translation contexts.'),
        ], [action('translate', 'Use B’s mapping', 'walked', 'Recovered by selecting process B’s translation context.')]),
        walked: node('Different physical destination', 'The offset is unchanged; the frame differs because the process mapping differs.', [
          evidence('translation', 'Address calculation', 'VA 0x234 -> page 2 + offset 0x34 -> frame 9 -> PA 0x934', 'Page 2 is virtual; frame 9 is physical in this fixture.'),
        ], [action('repeat', 'Repeat B access', 'done', 'B’s cached mapping now supplies frame 9 without a walk.')]),
        done: node('B’s cached translation', 'The changed address-space context, not a renamed application, explains the new destination.', [
          evidence('translation', 'Address calculation', 'VA 0x234 -> page 2 + offset 0x34 -> frame 9 -> PA 0x934', 'A’s physical destination remains separate from this fixture.'),
          evidence('cache-result', 'Second B access', 'TLB hit: frame 9; 0 page faults', 'The first resident walk needed no page fetch either.'),
        ], [], true),
      }, ['translation', 'cache-result'],
      check('What explains the changed physical address without a page fault?',
        'Process B maps the same virtual page to a different resident frame.',
        ['Changing process always fetches the page from disk.', 'TLB entries are one process-independent address book.'],
        'Address-space context selects the mapping. Because B’s mapping is valid and resident, its cache miss is resolved by translation lookup rather than page-fault handling.'),
    ),
    'Translation cache', 'The TLB caches virtual-to-physical mappings; a miss is not by itself a page fault.',
    'Real translation uses architecture-dependent multi-level page tables, page sizes and context-tagging or invalidation mechanisms. Hardware and Windows ensure translations belong to the correct address space.',
    ['Split the address into page number and offset.', 'Use the resident mapping before assuming a page fetch.', 'Keep the offset; change the frame according to the current process mapping.'],
    [source('Virtual address spaces', 'windows-hardware/drivers/gettingstarted/virtual-address-spaces', 'virtual-address-spaces')],
    'This is a one-level toy mapping with 0x100-byte pages, not real Windows page sizes, PTE layout or a full hardware walk. Mappings and permissions stay valid and fixed during each access.',
  ),

  scene(
    'l4-3', 4, 'The Page Was Not Here', 'Fault',
    'Use backing evidence to separate demand-zero, standby reuse, hard faults and invalid accesses.',
    experiment(
      'The workstation touches several prepared page fixtures. Determine whether each valid missing page needs storage, rather than assuming all faults read a pagefile.',
      check('Must a page fault read storage?',
        'No: demand-zero or standby reuse can resolve without storage reads.',
        ['Yes: page fault means pagefile access.', 'No: page faults are never related to memory access.'],
        'A valid nonresident page can be supplied from a zero-filled RAM page or an existing standby page. Other valid pages may need a mapped-file or pagefile read; invalid access is different.'),
      {
        start: node('Inspect a missing page', 'Begin with valid private demand-zero memory, or test a separate invalid address.', [], [
          action('zero', 'Touch valid demand-zero page', 'zeroed', 'Supplied a zero-filled physical page without reading storage.'),
          action('invalid', 'Touch unallocated address fixture', 'invalid', 'Access violation raised; no valid page could be fetched.'),
        ]),
        invalid: node('Not a retrieval problem', 'The address has no valid allocation. More RAM or a disk read cannot authorize it.', [
          evidence('invalid-result', 'Invalid access', 'Access violation: no valid allocation; no page fetched', 'The bounded test harness records the violation without running a real crash.'),
        ], [action('zero', 'Return to valid demand-zero fixture', 'zeroed', 'Selected a separate valid committed page; did not repair the invalid address by fetching it.')]),
        zeroed: node('Valid zero-filled page', 'The initial content is known to be zero; there was no saved content to read from storage.', [
          evidence('zero-result', 'Demand-zero resolution', 'Soft fault: zero-filled RAM page; 0 storage reads', 'Soft here means this page was resolved without a storage read.'),
        ], [action('standby', 'Touch valid page on standby list', 'standby', 'Reactivated the existing standby physical page without reading storage.')]),
        standby: node('Existing contents still in RAM', 'This page was outside the process working set but its valid contents remained on standby.', [
          evidence('zero-result', 'Earlier demand-zero', 'Soft fault: zero-filled RAM page; 0 storage reads', 'Earlier access had no disk dependency.'),
          evidence('standby-result', 'Standby resolution', 'Soft fault: standby page reused; 0 storage reads', 'Not in the working set does not imply not anywhere in physical memory.'),
        ], [action('file', 'Touch mapped-file page absent from RAM', 'done', 'Read the required page contents from the mapped file once.')]),
        done: node('Backing source explains the hard fault', 'This third valid page required storage because its mapped-file contents were absent from RAM.', [
          evidence('zero-result', 'Demand-zero', 'Soft fault: zero-filled RAM page; 0 storage reads', 'Historical fixture access: a new zero-filled page.'),
          evidence('standby-result', 'Standby', 'Soft fault: standby page reused; 0 storage reads', 'Historical fixture access: contents already in RAM.'),
          evidence('file-result', 'Mapped-file resolution', 'Hard fault: 1 mapped-file read', 'A hard fault need not read the pagefile.'),
        ], [], true),
      }, ['standby-result', 'file-result'],
      check('Why did only the mapped-file fixture read storage?',
        'Its required contents were absent from RAM; demand-zero and standby fixtures had no storage dependency.',
        ['Every valid page fault secretly reads the pagefile.', 'The standby page was an invalid address.'],
        'Backing and current page state determine the resolution. The mapped file supplies this hard fault; standby reuse and demand-zero supply valid pages without storage reads.'),
    ),
    experiment(
      'A modified private page was previously written to the pagefile and is now absent from RAM. Compare retrieval with a subsequent invalid address.',
      check('Can this private page be recreated by zero-filling instead of reading its saved contents?',
        'No: its modified contents must be restored from the pagefile in this fixture.',
        ['Yes: all private pages always contain zero.', 'It must be read from the application executable.'],
        'Private modified content differs from new demand-zero memory. Its saved backing is the pagefile here; a hard fault restores that content.'),
      {
        start: node('Saved private content', 'The page is valid and committed, but its only current saved contents are in the pagefile.', [], [
          action('pagefile', 'Touch valid saved private page', 'restored', 'Hard fault reads the saved pagefile contents into RAM.'),
          action('zero', 'Try zero-fill instead', 'wrong', 'Guard rejects losing modified saved contents by substituting zeros.'),
        ]),
        wrong: node('Do not discard valid content', 'Zero-filling is suitable for a new demand-zero page, not for this saved modified page.', [
          evidence('zero-error', 'Incorrect resolution', 'Saved private data requires its backing contents', 'This selected page contains modified data, not guaranteed zeros.'),
        ], [action('pagefile', 'Restore from pagefile', 'restored', 'Recovered using the selected page’s actual saved backing.')]),
        restored: node('Saved contents restored', 'This hard fault used a different storage source from the guided mapped-file page.', [
          evidence('pagefile-result', 'Private-page resolution', 'Hard fault: 1 pagefile read', 'The valid page can now be accessed with its preserved contents.'),
        ], [action('invalid', 'Probe a separate unallocated address', 'done', 'Separate invalid-address probe raises an access violation without a storage read.')]),
        done: node('Retrievable versus invalid', 'One access had valid saved content; the other had no valid allocation at all.', [
          evidence('pagefile-result', 'Earlier restore', 'Hard fault: 1 pagefile read', 'This was a successful valid-page retrieval.'),
          evidence('invalid-result', 'Separate invalid access', 'Access violation: no valid allocation; no page fetched', 'The harness records the fault; invalid addresses are not repaired by paging.'),
        ], [], true),
      }, ['pagefile-result', 'invalid-result'],
      check('Why is the second access not just another hard fault to fetch a page?',
        'It has no valid allocation; the first had saved contents for a valid private page.',
        ['The pagefile can supply a page for any arbitrary address.', 'All access violations indicate insufficient storage speed.'],
        'A valid backing relationship makes the first page retrievable. No such relationship exists for the invalid probe, so fetching data cannot authorize the address.'),
    ),
    'Fault source', 'Fault resolution depends on validity, residency and backing, not just the word “fault.”',
    'Windows distinguishes multiple page-fault causes. These fixtures use demand-zero and transition/standby cases for no-storage resolution, and explicit mapped-file and pagefile cases for storage reads.',
    ['First establish that the address is valid.', 'Then ask whether required contents already exist in RAM or can be zero-filled.', 'If saved contents are absent from RAM, identify the mapped file or pagefile; do not guess.'],
    [workingSet, source('Page state', 'windows/win32/memory/page-state', 'page-state')],
    'Each fixture performs exactly one selected resolution with no read-ahead, compression, caching races or concurrent trimming. Soft/hard labels describe storage dependency, not all hardware fault classifications.',
  ),

  scene(
    'l4-4', 4, 'Permission to Access', 'RWX',
    'Test read, write and execute permissions independently from whether a page is resident.',
    experiment(
      'The workstation has a resident read-only data page. Test permissions safely in the harness before blaming missing RAM.',
      check('Does residency authorize a write or execution?',
        'No: resident data still needs permission for the attempted access.',
        ['Yes: anything in RAM is writable and executable.', 'Read permission automatically includes execute permission.'],
        'Residency answers where a page is. Protection answers which accesses are permitted. A resident read-only page can allow reads while denying writes and instruction execution.'),
      {
        start: node('Resident R-- page', 'This data page permits read only. R/W/X are independent labels in the teaching display.', [
          evidence('page-state', 'State', 'Resident; protection R--', 'No page fetch is needed for an authorized read.'),
        ], [
          action('write', 'Probe a write', 'denied', 'Harness records access violation because write permission is absent.'),
          action('read', 'Probe a read', 'read', 'Read succeeds under read-only protection.'),
        ]),
        denied: node('Resident but not writable', 'The page stayed resident; no amount of RAM would grant write permission.', [
          evidence('write-result', 'Write probe', 'Access violation: resident R-- page denies write', 'The harness records denial without executing a real crash.'),
          evidence('page-state', 'State', 'Resident; protection R--', 'Rejected access changed neither data nor permissions.'),
        ], [action('read', 'Try authorized read', 'read', 'Read succeeds because this operation is permitted.')]),
        read: node('Authorized read', 'Reading the same page succeeds. Now test instruction execution separately.', [
          evidence('read-result', 'Read probe', 'Read succeeds: resident R-- page permits read', 'Readable is not synonymous with executable.'),
        ], [
          action('execute', 'Probe execution from data page', 'done', 'Execution probe is denied because execute permission is absent.'),
          action('write', 'Compare denied write again', 'denied', 'Write probe remains denied on the resident read-only page.'),
        ]),
        done: node('Permission-specific results', 'The successful read and rejected execution concern the same resident page.', [
          evidence('read-result', 'Read probe', 'Read succeeds: resident R-- page permits read', 'A successful read says nothing about write authorization.'),
          evidence('execute-result', 'Execution probe', 'Access violation: resident R-- page denies execute', 'The fixture enforces nonexecutable data; it does not fetch a page to resolve denial.'),
        ], [], true),
      }, ['read-result', 'execute-result'],
      check('Why did reading succeed while execution failed?',
        'The resident page permits read but not execute.',
        ['Execution needed more RAM.', 'Any readable bytes must be executable instructions.'],
        'The requested operation is checked against protection. Residency was unchanged; authorization explains the contrasting outcomes.'),
    ),
    experiment(
      'A code page now has R-X protection. Execution is authorized, but patching bytes is not. Preserve the narrow permissions.',
      check('Does execute permission imply write permission?',
        'No: R-X permits reading and execution, not writing.',
        ['Yes: executing code always requires RWX memory.', 'No: executable pages cannot be resident.'],
        'Code can execute from a resident read-execute page without being writable. Adding broad write permission is not necessary to explain or preserve the successful execution.'),
      {
        start: node('Resident R-X code', 'The changed fixture permits execution, unlike the earlier read-only data page.', [
          evidence('page-state', 'State', 'Resident; protection R-X', 'The code bytes are already present in RAM.'),
        ], [
          action('execute', 'Run authorized code probe', 'ran', 'Execute probe succeeds on the resident read-execute page.'),
          action('rwx', 'Add write permission unnecessarily', 'broad', 'Fixture now permits unnecessary writing; restore narrow code protection.'),
        ]),
        broad: node('Unnecessary authority', 'The code did not need write access to execute. Restore R-X before testing the intended policy.', [
          evidence('broad-result', 'Policy change', 'Resident RWX: write unnecessarily permitted', 'Broad permission is not a missing-page repair.'),
        ], [action('restore', 'Restore R-X and execute', 'ran', 'Restored read-execute protection; execution still succeeds.')]),
        ran: node('Execute succeeds without write', 'The page is readable and executable. Probe a disallowed write without changing policy.', [
          evidence('execute-result', 'Execution', 'Execute succeeds: resident R-X page', 'Execute authorization is distinct from write authorization.'),
        ], [action('write', 'Probe write under R-X', 'done', 'Write probe denied while execution remains authorized.')]),
        done: node('Narrow protection verified', 'The intended code operation succeeds and the unintended patch operation is denied.', [
          evidence('execute-result', 'Execution', 'Execute succeeds: resident R-X page', 'No broad RWX permission was needed.'),
          evidence('write-result', 'Write', 'Access violation: R-X is not writable', 'Denied access leaves code and residency unchanged.'),
        ], [], true),
      }, ['execute-result', 'write-result'],
      check('Which policy explains the successful execute and rejected write?',
        'Resident R-X: executable but not writable.',
        ['RWX is required to run all code.', 'Residency authorizes every access type.'],
        'The transfer changes the permitted operation set. The evidence verifies a positive execute test and a negative write test without broadening permissions.'),
    ),
    'Protection versus location', 'R/W/X describe allowed operations; residency does not grant authorization.',
    'Windows protection constants encode supported combinations rather than every abstract bit pattern. This fixture assumes supported execute-disable enforcement and omits guard-page, control-flow and other access checks.',
    ['Read the requested operation, not just “resident.”', 'Compare one allowed and one denied operation on the same page.', 'R-- allows read; R-X also allows execute, but neither allows write.'],
    [protection],
    'R/W/X is a compact teaching notation for selected Windows protection combinations. Probes are fictional harness results, not browser execution or real unsafe memory access; other security layers are omitted.',
  ),

  scene(
    'l4-5', 4, 'Shared Without Being Identical', 'COW',
    'Observe per-page private copying under copy-on-write and contrast it with explicitly writable shared backing.',
    experiment(
      'Two workstation processes share two copy-on-write mapped pages. Page 0 contains 4; page 1 contains 6. A writes only page 0.',
      check('Will A’s copy-on-write update change B’s page 0 or copy both pages?',
        'Neither: only A’s written page becomes private.',
        ['Both views change because all shared memory is writable sharing.', 'Both pages copy immediately on the first write.'],
        'Copy-on-write allows shared backing until a view writes. The written page receives a private copy for that view; untouched pages can remain shared.'),
      {
        start: node('Two pages shared initially', 'A and B see [4, 6]. Both pages share backing with copy-on-write protection.', [
          evidence('views', 'Visible data', 'Page 0: A=4, B=4; page 1: A=6, B=6', 'These are separate process views of the same initial backing.'),
        ], [
          action('write', 'A writes 9 to page 0', 'copied', 'A’s write creates a private page-0 copy; B retains the original value 4.'),
          action('read', 'A reads both pages only', 'read', 'Read-only access leaves both backing pages shared.'),
        ]),
        read: node('Reading did not split backing', 'No private copy was necessary because no view wrote.', [
          evidence('read-result', 'Copy count', '0 private pages after reads', 'Shared read access does not trigger copy-on-write splitting.'),
        ], [action('write', 'A writes page 0 now', 'copied', 'First write creates the private copy for only page 0.')]),
        copied: node('One page split', 'B still sees original page 0. Page 1 is untouched and remains shared.', [
          evidence('views', 'Visible data', 'Page 0: A=9, B=4; page 1: A=6, B=6', 'A’s private page now holds 9; B’s original page still holds 4.'),
          evidence('backing', 'Backing relationship', 'Page 0 private to A; page 1 still shared', 'The copy is page-sized, not an entire mapping copy.'),
        ], [action('write-again', 'A writes 10 to its page 0', 'done', 'Second write updates A’s already-private page without creating another copy.')]),
        done: node('Private page reused', 'A’s second write leaves B unchanged and still does not split page 1.', [
          evidence('views', 'Visible data', 'Page 0: A=10, B=4; page 1: A=6, B=6', 'The second write changes only A’s private page.'),
          evidence('backing', 'Backing relationship', 'Page 0 private to A; page 1 still shared', 'Untouched page 1 remains shared across both views.'),
          evidence('copies', 'Private copy count', '1 private page; second write reuses it', 'The same private page services subsequent writes by A.'),
        ], [], true),
      }, ['backing', 'copies'],
      check('Why did a second write not create a second private page?',
        'A already had a private page-0 copy; untouched page 1 stayed shared.',
        ['Copy-on-write copies the entire process on each write.', 'B’s original page was overwritten by both writes.'],
        'The copy-on-write transition is per page and per writing view. Once A owns a private copy of page 0, it can update that page without splitting the untouched shared page.'),
    ),
    experiment(
      'The backing is now explicitly writable sharing, not copy-on-write. A and B still map two pages; compare how A’s write is observed.',
      check('Will B see A’s update under explicitly writable sharing?',
        'Yes: both views still use the same writable page backing.',
        ['No: every mapping uses copy-on-write.', 'Only page 1 will change because it is untouched.'],
        'Writable sharing intentionally preserves shared backing for writes. Copy-on-write is a specific protection policy, not a universal property of mapped memory.'),
      {
        start: node('Shared writable mapping', 'Both views initially see [4, 6]. This policy keeps writes in shared backing.', [
          evidence('views', 'Visible data', 'Page 0: A=4, B=4; page 1: A=6, B=6', 'Only the sharing policy changed, not the initial values.'),
        ], [
          action('write', 'A writes 9 to shared page 0', 'written', 'A updates shared backing; B observes 9 at page 0.'),
        ]),
        written: node('Update visible in both views', 'This is intended communication, not private copy isolation.', [
          evidence('views', 'Visible data', 'Page 0: A=9, B=9; page 1: A=6, B=6', 'Page 1 remained unchanged because it was not written.'),
        ], [action('inspect', 'Inspect shared backing and copies', 'done', 'Confirmed both page-0 views still point to the same writable backing; no private copy was made.')]),
        done: node('Policy explains the difference', 'Explicit writable sharing and copy-on-write have different write consequences.', [
          evidence('views', 'Visible data', 'Page 0: A=9, B=9; page 1: A=6, B=6', 'The shared page-0 update is visible to both processes.'),
          evidence('backing', 'Backing relationship', 'Both views use the same writable backing; 0 private copies', 'The changed mapping policy authorized shared modification.'),
        ], [], true),
      }, ['views', 'backing'],
      check('Why did B see 9 in this transfer but not in the guided COW experiment?',
        'This mapping explicitly preserves writable shared backing rather than creating A’s private copy.',
        ['Sharing policies never affect visible writes.', 'B must have read from A’s private copy.'],
        'The changed write policy, not an application rename, determines whether writes split backing privately or remain visible through both views.'),
    ),
    'Copy-on-write', 'Shared pages can become private one page at a time when a writing view uses copy-on-write protection.',
    'Windows mapped views can deliberately use writable sharing or copy-on-write. Real cross-process writable communication also needs synchronization; commit accounting and mapping details are not modeled here.',
    ['Check the mapping policy before predicting visibility.', 'A COW write splits only the written page for that view.', 'Compare A and B values and backing identity; a second write reuses A’s private page.'],
    [cowSource, source('Creating a file mapping object', 'windows/win32/memory/creating-a-file-mapping-object', 'creating-a-file-mapping-object')],
    'Two fixed pages and sequential writes isolate backing relationships. Copy-on-write commit charging, concurrent synchronization, file persistence and other mapped-view flags are intentionally omitted.',
  ),

  scene(
    'l4-6', 4, 'Memory Under Pressure', 'Trim',
    'Separate working-set trimming from releasing commitment and distinguish bounded allocation retention from proven leakage.',
    experiment(
      'The workstation cache owns eight committed private pages, all resident. Reduce its working set, then test reuse and explicit release.',
      check('Will trimming resident pages necessarily reduce private commitment?',
        'No: trimming changes residency while the allocation and commitment can remain.',
        ['Yes: working set and commitment are the same counter.', 'No: trimming always increases the reservation.'],
        'A working-set trim removes physical residency from a process view. Keeping the private allocation retains its backing commitment until decommit or release.'),
      {
        start: node('Eight-page retained cache', 'The cache owns eight committed resident pages. No evidence yet establishes a leak.', [
          evidence('counters', 'Cache counters', 'Committed 8 pages; resident 8; retained allocation 8', 'All counters refer only to this bounded private cache allocation.'),
        ], [
          action('trim', 'Trim six pages from working set', 'trimmed', 'Residency drops to two pages while all eight pages remain allocated and committed.'),
          action('label-leak', 'Declare leak from one large reading', 'wrong', 'A single retained-allocation reading does not establish unbounded growth.'),
        ]),
        wrong: node('A reading is not a trend', 'Retention can be intentional. Observe what trim and reuse actually change.', [
          evidence('diagnosis-error', 'Missing evidence', 'No growth trend or ownership loss observed', 'A cache can retain bounded reusable memory without leaking it.'),
        ], [action('trim', 'Measure after working-set trim', 'trimmed', 'Performed controlled trim without changing allocation ownership.')]),
        trimmed: node('Less resident, still committed', 'The cache still owns its pages. Reuse one trimmed page without allocating another.', [
          evidence('trim-result', 'Trim effect', 'Six pages left working set; allocation retained', 'Pages outside the working set may have RAM or storage backing.'),
          evidence('counters', 'Cache counters', 'Committed 8 pages; resident 2; retained allocation 8', 'The eight-page private commitment remains charged.'),
        ], [action('reuse', 'Touch one retained trimmed page', 'reused', 'One page becomes resident again; no new allocation or commitment is added.')]),
        reused: node('Retained allocation reused', 'Residency grew by one, but allocation ownership and commitment stayed constant.', [
          evidence('trim-result', 'Earlier trim', 'Six pages left working set; allocation retained', 'This observation explains why refaulting was possible.'),
          evidence('counters', 'Cache counters', 'Committed 8 pages; resident 3; retained allocation 8', 'The touched page belonged to the existing allocation.'),
        ], [action('release', 'Release cache allocation explicitly', 'done', 'Released the entire cache allocation; its commitment and residency are gone.')]),
        done: node('Release differs from trim', 'The cache explicitly relinquished ownership rather than only physical residency.', [
          evidence('trim-result', 'Earlier trim', 'Six pages left working set; allocation retained', 'Commitment survived the trim.'),
          evidence('release-result', 'Release', 'Cache allocation ownership returned; private commitment removed', 'Release actually ends the retained allocation.'),
          evidence('counters', 'Cache counters', 'Committed 0 pages; resident 0; retained allocation 0', 'Other workstation allocations are outside these counters.'),
        ], [], true),
      }, ['trim-result', 'release-result'],
      check('Which observation distinguishes trim from release?',
        'Trim kept the eight-page allocation committed; release returned ownership and removed its commitment.',
        ['Both operations freed all backing commitment.', 'Any later rise in residency proves a leak.'],
        'Residency changes can reflect eviction and reuse of owned pages. Releasing ownership, unlike trimming the working set, removes this allocation’s commitment.'),
    ),
    experiment(
      'A cache grows from four pages to eight on its first large request, then serves repeated requests using the same retained allocation.',
      check('Does the first growth from 4 to 8 alone prove a leak?',
        'No: compare subsequent allocation and ownership trends.',
        ['Yes: every retained allocation is leaked.', 'No: a cache can never leak.'],
        'Initial growth can be bounded retention for reuse. Repeated stable commitment supports this fixture’s bounded-cache explanation, but it does not prove all caches are leak-free.'),
      {
        start: node('First large request finished', 'The cache grew from 4 to 8 committed pages and intentionally retained them.', [
          evidence('counters', 'Current cache', 'Committed 8 pages; resident 8; retained allocation 8', 'A single post-request snapshot is insufficient to infer unbounded growth.'),
        ], [
          action('repeat', 'Serve requests 2 and 3', 'stable', 'Both subsequent requests reuse the existing eight-page allocation.'),
          action('trim', 'Trim cache working set first', 'trimmed', 'Reduced residency to two pages without changing eight-page commitment.'),
        ]),
        trimmed: node('Trimming does not test growth alone', 'Repeat the workload and inspect allocation reuse, not just the low resident counter.', [
          evidence('trim-effect', 'Trim', 'Committed 8 pages; resident 2; retained allocation 8', 'The retained cache can become resident again when reused.'),
        ], [action('repeat', 'Repeat workload on retained pages', 'stable', 'Repeated requests reuse all eight pages, bringing them resident without new commitment.')]),
        stable: node('Bounded reuse observed', 'The allocation remains owned by the cache, and subsequent requests did not grow it.', [
          evidence('allocation-trend', 'Repeated workload', 'Requests 2 and 3 reuse 8 pages; commitment stays 8', 'This is a bounded observation, not proof about all future requests.'),
          evidence('counters', 'Current cache', 'Committed 8 pages; resident 8; retained allocation 8', 'The retained pages remain intentionally allocated.'),
        ], [action('inspect', 'Inspect cache ownership', 'done', 'Verified one reachable cache allocation with an explicit release path.')]),
        done: node('Retention is not necessarily leakage', 'The fixture shows bounded reuse and known ownership, not discarded references to ever-growing allocations.', [
          evidence('allocation-trend', 'Repeated workload', 'Requests 2 and 3 reuse 8 pages; commitment stays 8', 'The measured requests reuse one allocation.'),
          evidence('ownership', 'Allocation owner', 'Cache retains one reachable 8-page allocation with release path', 'Ownership and bounded trends support intentional retention in this fixture.'),
        ], [], true),
      }, ['allocation-trend', 'ownership'],
      check('What does this evidence support, without overclaiming?',
        'The observed requests reused a bounded retained cache; initial growth alone did not establish a leak.',
        ['All growth always proves a leak.', 'Stable commitment proves this application can never leak anything.'],
        'The supplied repeat and ownership evidence explains this allocation. Leak diagnosis needs workload and ownership investigation, not a universal inference from one resident or committed reading.'),
    ),
    'Commitment under pressure', 'Physical residency can shrink while private commitment and intentional allocation ownership remain.',
    'Working sets contain resident process pages; private commit and system commit accounting are different views. A real pressure investigation also considers total commit capacity, other processes and backing behavior.',
    ['Track commitment separately from resident pages.', 'A reused page can refault without increasing allocation size.', 'Check repeated growth and ownership before labeling retention a leak; release is distinct from trim.'],
    [workingSet, virtualFree],
    'Counters cover one private cache, not all Windows memory. Six-page trim and subsequent residency are deterministic fixtures; no global pressure algorithm, storage cost or comprehensive leak diagnosis is simulated.',
  ),

  scene(
    'l4-7', 4, 'Memory in Kernel Mode', 'Pool',
    'Choose memory that remains accessible at the actual execution IRQL, not merely memory that happens to be resident now.',
    experiment(
      'The workstation driver’s normal DPC must read a buffer at DISPATCH_LEVEL. A paged allocation currently happens to be resident.',
      check('Is paged pool safe for this DPC merely because it is resident now?',
        'No: use nonpaged data and nonpageable code for the DISPATCH_LEVEL path.',
        ['Yes: current residency is a permanent guarantee.', 'Kernel mode removes all page-fault constraints.'],
        'Paged pool can become nonresident. Code at DISPATCH_LEVEL cannot depend on resolving a page fault; the accessed code and data must be suitable regardless of current residency.'),
      {
        start: node('DPC buffer requirement', 'The operation is bounded and nonblocking. Choose a pool type for its accessed data.', [
          evidence('context', 'Execution context', 'Kernel mode; DISPATCH_LEVEL; normal DPC', 'IRQL is separate from privilege mode and thread priority.'),
        ], [
          action('paged', 'Choose currently resident paged pool', 'unsafe', 'Rejected suitability: pageable data could be evicted before DPC access.'),
          action('nonpaged', 'Choose nonpaged buffer and nonpageable code', 'suitable', 'Selected code and data that do not require page-fault resolution.'),
        ]),
        unsafe: node('Current residency is not a guarantee', 'The guard prevents a real unsafe access. Move the required buffer to nonpaged memory.', [
          evidence('safety', 'Suitability', 'Unsafe at DISPATCH_LEVEL: paged pool can become nonresident', 'A favorable current snapshot does not change the allocation’s pageable contract.'),
          evidence('paged-observation', 'Current location', 'Paged buffer currently resident', 'Even this location does not justify high-IRQL pageable access.'),
        ], [action('nonpaged', 'Replace with nonpaged buffer and code', 'suitable', 'Recovered by choosing a nonpageable DISPATCH_LEVEL path.')]),
        suitable: node('Guaranteed nonpageable path', 'The buffer is nonpaged and the DPC code is nonpageable. The operation still must not block.', [
          evidence('safety', 'Suitability', 'Suitable at DISPATCH_LEVEL: nonpaged buffer and nonpageable code', 'Nonpaged allocation alone would not make pageable code safe.'),
          evidence('pool-choice', 'Memory contract', 'Accessed buffer is nonpaged; code is nonpageable', 'Kernel mode alone was never the residency guarantee.'),
        ], [
          action('run', 'Run bounded DPC operation', 'done', 'DPC completes using only nonpageable code and data without blocking.'),
          action('wait', 'Add a blocking wait despite nonpaged data', 'wait', 'Guard rejects blocking; nonpaged memory does not remove the IRQL wait rule.'),
        ]),
        wait: node('Another independent constraint', 'Nonpageable data is necessary for this path, but it does not permit a blocking wait.', [
          evidence('wait-error', 'Wait attempt', 'Blocking still forbidden at DISPATCH_LEVEL', 'Memory suitability does not change execution-context constraints.'),
        ], [action('run', 'Remove wait and run bounded DPC', 'done', 'Removed the blocking operation; suitable nonpageable DPC completes.')]),
        done: node('DPC operation verified', 'The correct memory contract and the nonblocking operation both matter.', [
          evidence('pool-choice', 'Memory contract', 'Accessed buffer is nonpaged; code is nonpageable', 'This does not authorize arbitrary operations at high IRQL.'),
          evidence('safety', 'Suitability', 'Suitable at DISPATCH_LEVEL: nonpaged buffer and nonpageable code', 'The contract does not depend on a lucky current-residency snapshot.'),
          evidence('run-result', 'Execution', 'DPC completes without pageable access or blocking', 'The bounded operation obeys both memory and wait constraints.'),
        ], [], true),
      }, ['pool-choice', 'run-result'],
      check('What made this DPC path suitable?',
        'Nonpageable accessed code/data and a bounded nonblocking operation at DISPATCH_LEVEL.',
        ['Kernel mode plus any currently resident paged buffer.', 'Nonpaged memory allows blocking waits at any IRQL.'],
        'The required property is reliable accessibility at the actual IRQL. Nonpaged data does not fix pageable code or authorize blocking; all shown constraints must hold.'),
    ),
    experiment(
      'The operation is moved to an ordinary system worker at PASSIVE_LEVEL. Its buffer can now be pageable; a missing page may be resolved in this context.',
      check('Must every kernel-mode worker allocation be nonpaged?',
        'No: paged pool can suit this PASSIVE_LEVEL worker-only use.',
        ['Yes: all kernel-mode memory must always be nonpaged.', 'Paged pool is only for user-mode applications.'],
        'Memory requirements depend on all access contexts, not mode alone. This selected worker-only path can tolerate page-fault resolution; no ISR or DPC later accesses its buffer.'),
      {
        start: node('Worker-only buffer', 'The worker runs in kernel mode at PASSIVE_LEVEL; the path can resolve page faults and no high-IRQL consumer uses this buffer.', [
          evidence('context', 'Execution context', 'Kernel mode; PASSIVE_LEVEL; worker thread priority 8 (fixture)', 'Kernel mode did not change; the IRQL and kind of execution changed.'),
        ], [
          action('paged', 'Choose paged pool for worker-only data', 'suitable', 'Paged allocation is suitable for this PASSIVE_LEVEL-only access contract.'),
          action('dpc', 'Hand pageable buffer to a DPC', 'wrong', 'Guard rejects adding a DISPATCH_LEVEL consumer of pageable data.'),
        ]),
        wrong: node('Changed consumer changes requirements', 'A low-IRQL allocation site does not make a high-IRQL access safe. Keep this buffer worker-only.', [
          evidence('consumer-error', 'Access contract', 'Unsafe DPC consumer of paged buffer', 'Requirements follow where data is accessed, not only where it was allocated.'),
        ], [action('paged', 'Remove DPC consumer; retain worker-only buffer', 'suitable', 'Recovered the PASSIVE_LEVEL-only paged-buffer contract.')]),
        suitable: node('Paged buffer is appropriate here', 'Current nonresidency is tolerable because this worker can resolve the selected fault.', [
          evidence('safety', 'Suitability', 'Suitable at PASSIVE_LEVEL: worker can resolve page faults', 'No high-IRQL consumer or prohibited wait context is present in this fixture.'),
        ], [action('touch', 'Access a nonresident buffer page', 'done', 'Worker resolves the page fault at PASSIVE_LEVEL and completes the buffer access.')]),
        done: node('Context-dependent choice', 'Kernel-mode pageable memory is not universally wrong; the access context determines suitability.', [
          evidence('safety', 'Suitability', 'Suitable at PASSIVE_LEVEL: worker can resolve page faults', 'This does not grant permission to hand the buffer to a DPC.'),
          evidence('touch-result', 'Worker access', 'Page fault resolved at PASSIVE_LEVEL; worker completes', 'The changed execution contract permits the selected fault resolution.'),
        ], [], true),
      }, ['safety', 'touch-result'],
      check('Why is paged pool acceptable in this transfer but not for the earlier DPC?',
        'All accesses here are in a fault-tolerant PASSIVE_LEVEL worker context.',
        ['Paged pool becomes permanently resident when allocated by a worker.', 'Privilege mode, rather than IRQL, determines whether page faults can be resolved.'],
        'Suitability depends on the most restrictive access context. This worker-only path can resolve the selected page fault; a DISPATCH_LEVEL consumer could not rely on that.'),
    ),
    'Paged and nonpaged pool', 'Paged pool can leave RAM; nonpaged pool provides nonpageable storage for paths that cannot tolerate page faults.',
    'The allocator call and each access have separate IRQL requirements. Nonpaged memory does not make arbitrary pointers, pageable code, blocking or excessive high-IRQL work safe. Execute permissions are separate from pool residency.',
    ['Identify the highest IRQL of every consumer.', 'Currently resident paged pool can still become nonresident.', 'Use nonpageable code and data for the DPC; a worker-only PASSIVE_LEVEL path can use paged pool.'],
    [poolSource, irqlSource],
    'No real kernel allocation or driver runs. Guards show unsafe choices without bugchecks. Fixtures omit quotas, allocation failure, pool flags and locks that could further constrain low-IRQL code.',
  ),
]
