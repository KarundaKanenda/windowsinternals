import type { Check, Evidence, Experiment, Scene, SceneAction, SceneNode } from './types'

const evidence = (id: string, label: string, value: string, detail: string): Evidence =>
  ({ id, label, value, detail })

const action = (id: string, label: string, next: string, log: string): SceneAction =>
  ({ id, label, next, log })

const node = (
  title: string, description: string, observations: Evidence[], actions: SceneAction[], assess = false,
): SceneNode => ({ title, description, evidence: observations, actions, ...(assess ? { assess } : {}) })

const check = (prompt: string, correct: string, wrong: string, explanation: string): Check =>
  ({ prompt, options: [wrong, correct], correct: 1, explanation })

type Operation = [id: string, label: string, log: string]
type Snapshot = [title: string, description: string, observations: Evidence[]]

interface Probe {
  briefing: string
  prediction: Check
  mechanism: Check
  required: [string, string]
  start: Snapshot
  changed: Snapshot
  alternative: Snapshot
  verified: Snapshot
  apply: Operation
  contrast: Operation
  recover: Operation
  verify: Operation
}

// A branch is an intervention, not a quiz answer. Recovery can explicitly reset
// a fixture when an operation (for example termination) cannot be undone.
function probe(input: Probe): Experiment {
  const transition = ([id, label, log]: Operation, next: string) => action(id, label, next, log)
  const reset = action('reset-fixture', 'Reset this fictional fixture', 'start', 'Restored the stated initial fixture; previous observations remain in the notebook.')
  return {
    briefing: input.briefing,
    prediction: input.prediction,
    initial: 'start',
    investigation: { ...input.mechanism, requiredEvidence: input.required },
    nodes: {
      start: node(...input.start, [transition(input.apply, 'changed'), transition(input.contrast, 'alternative')]),
      changed: node(...input.changed, [transition(input.verify, 'verified'), reset]),
      alternative: node(...input.alternative, [transition(input.recover, 'changed'), reset]),
      verified: node(...input.verified, [reset], true),
    },
  }
}

const source = (label: string, path: string) => ({
  label, url: `https://learn.microsoft.com/en-us/${path}#main`,
})

function scene(
  id: string, title: string, icon: string, objective: string,
  guided: Experiment, transfer: Experiment,
  concepts: Scene['concepts'], hints: string[], sources: Scene['sources'], simplification: string,
): Scene {
  return { id, level: Number(id[1]), title, icon, objective, guided, transfer, concepts, hints, sources, simplification }
}

const firstContact: Experiment = {
  briefing: 'Atlas Notes is a program on disk. Launch it twice, compare the live instances, and close just one. Predict first; a mistaken prediction is a chance to compare, not a blocked experiment.',
  prediction: check(
    'After two independent launches, closing the second instance will do what?',
    'Leave the first process alive.', 'Delete the program and close both processes.',
    'The file is the program. Each independent launch creates a live process; closing one does not delete the file or close its peer.',
  ),
  initial: 'disk',
  investigation: {
    ...check('What explains the survivor?', 'Two live processes had separate PIDs; only PID 4104 exited.',
      'The program file had to be duplicated to keep PID 4100 alive.',
      'Compare the two-PID snapshot with the survivor snapshot. One image file supplied two independent process instances.'),
    requiredEvidence: ['two-pids', 'survivor'],
  },
  nodes: {
    disk: node('A program, no process', 'atlas-notes.exe is available. Nothing from it is running yet.', [
      evidence('image', 'Program file', 'atlas-notes.exe: present on disk', 'Closing a process does not remove this file.'),
      evidence('instances', 'Live instances', '0: no live PIDs', 'There is no process to schedule.'),
    ], [action('launch-first', 'Launch Atlas Notes', 'one', 'Created PID 4100 from atlas-notes.exe.')]),
    one: node('One live instance', 'A launch created a process with its own identity and resources.', [
      evidence('instances', 'Live instances', '1: PID 4100', 'One running instance of the image, not a new disk file.'),
    ], [
      action('launch-second', 'Launch an independent second instance', 'two', 'Created PID 4104; PID 4100 is still alive.'),
      action('close-only', 'Close the only instance', 'empty', 'PID 4100 exited; the image file remains.'),
    ]),
    two: node('Two independent processes', 'Both processes came from the same file. Choose which process to close.', [
      evidence('two-pids', 'Distinct live identities', '2: PIDs 4100, 4104', 'Both are alive concurrently; their PIDs differ.'),
    ], [
      action('close-second', 'Close PID 4104 only', 'survivor', 'PID 4104 exited; PID 4100 retained its window and resources.'),
      action('restart', 'Close both and reset the launch fixture', 'disk', 'Both instances exited. Restored the empty fixture.'),
    ]),
    survivor: node('One process survives', 'PID 4100 remains usable. The executable is still on disk.', [
      evidence('survivor', 'After closing PID 4104', '1: PID 4100; PID 4104 exited', 'Before: two PIDs. After: only the selected process is gone.'),
      evidence('image', 'Program file', 'atlas-notes.exe: present on disk', 'A process exit did not delete the executable.'),
    ], [
      action('close-only', 'Close the survivor', 'empty', 'PID 4100 exited; no Atlas Notes processes remain.'),
      action('restart', 'Reset and try another launch sequence', 'disk', 'Closed remaining work and reset the fictional fixture.'),
    ], true),
    empty: node('No instances remain', 'Closing the last live instance removes the last process, not the file.', [
      evidence('instances', 'Live instances', '0: no live PIDs', 'The process count decreased to zero.'),
    ], [action('restart', 'Reset and launch again', 'disk', 'Restored the empty launch fixture; the program remains available.')]),
  },
}

const firstTransfer: Experiment = {
  briefing: 'A viewer already has exactly one live instance, PID 5100 (generation A). Close it, then relaunch. This fixture deliberately reuses a retired PID: compare lifetime as well as the number.',
  prediction: check('If the last instance exits, must a later launch have a different PID forever?',
    'No. No instance remains after exit, and a later lifetime may reuse the number.',
    'Yes. PID numbers permanently identify one application lifetime.',
    'A PID identifies a process while it is alive. After exit the OS can reuse the number; lifetime information distinguishes the instances.'),
  initial: 'one',
  investigation: {
    ...check('Does the reappearing number prove the old process survived?',
      'No: generation A exited and generation B was created with a reused number.',
      'Yes: identical PID means identical lifetime.',
      'The exit and launch observations establish two lifetimes even though the displayed PID number matches.'),
    requiredEvidence: ['remaining', 'reuse'],
  },
  nodes: {
    one: node('Only one live viewer', 'Unlike the guided pair, there is no peer to survive closing the last instance.', [
      evidence('viewer-before', 'Before exit', '1: PID 5100, generation A', 'Generation labels are teaching lifetime markers, not a Windows PID field.'),
    ], [
      action('close-last', 'Close the last viewer', 'empty', 'Generation A exited; zero viewer instances remain.'),
      action('launch-peer', 'Instead launch a peer before closing', 'pair', 'PID 5104 created while PID 5100 generation A is alive.'),
    ]),
    pair: node('The peer changes the outcome', 'Now there are two independent instances, so closing one leaves another.', [
      evidence('viewer-pair', 'Current instances', '2: PIDs 5100, 5104', 'A second live lifetime was created.'),
    ], [
      action('close-both', 'Close both instances to test last-instance exit', 'empty', 'Both viewer lifetimes exited; none remain.'),
      action('reset-fixture', 'Reset to one original viewer', 'one', 'Closed the pair and restored generation A in the fictional fixture.'),
    ]),
    empty: node('Last-instance exit', 'The file is still available, but no viewer process remains.', [
      evidence('remaining', 'After exit', '0: PID 5100 exited', 'In the pair detour, PID 5104 also exited. There is no live viewer.'),
    ], [action('relaunch', 'Relaunch with this fixture’s reused PID', 'new', 'Created generation B; the retired numeric PID 5100 was reused.')]),
    new: node('Same number, new lifetime', 'A relaunch is creation, not resurrection.', [
      evidence('reuse', 'New lifetime', '1: PID 5100, generation B', 'Compare the observed exit with this creation. Windows does not guarantee immediate PID reuse.'),
    ], [action('reset-fixture', 'Reset to the original one-instance case', 'one', 'Closed generation B and restored the starting fixture.')], true),
  },
}

const threads = probe({
  briefing: 'A calculator has a UI thread and a worker thread, but only one logical CPU. Move a long calculation off the UI thread and send input while it runs.',
  prediction: check('Can the UI respond before the worker finishes on one logical CPU?',
    'Yes, if the scheduler gives the UI a turn.', 'No: responsiveness always requires two CPUs.',
    'A single CPU alternates execution. A worker lets the UI handle events between slices, without simultaneous execution.'),
  mechanism: check('Why did input respond before calculation finished?',
    'Separate threads took alternating CPU turns; the UI was not occupied by the calculation.',
    'Two threads executed at the same instant on the single CPU.',
    'The input and CPU trace together show concurrency by time sharing, not parallel execution.'),
  required: ['ui-response', 'cpu-slices'],
  start: ['Calculation queued', 'UI TID 4201 is idle; worker TID 4202 is available.', [
    evidence('cpu-count', 'Available execution slots', '1 logical CPU', 'At most one modeled thread executes at an instant.'),
    evidence('work-before', 'Calculation remaining', '6 work units', 'The same bounded calculation is used in both branches.'),
  ]],
  changed: ['Worker calculating', 'The worker has used one slice. The UI is available to handle input on its next turn.', [
    evidence('worker-progress', 'After dispatch', '5 work units remain; UI ready', 'Dispatch did not create another CPU.'),
  ]],
  alternative: ['UI occupied', 'The calculation runs in the UI event handler, so another input is queued.', [
    evidence('ui-branch', 'UI after inline work', 'UI busy: input queued', 'The event handler has not returned to process another event.'),
  ]],
  verified: ['Input handled between work slices', 'The worker continues after the UI handles one event.', [
    evidence('ui-response', 'Input result', 'Input handled; calculation unfinished', 'The UI ran while 4 calculation units still remained.'),
    evidence('cpu-slices', 'Execution trace', '1 logical CPU: worker -> UI -> worker', 'These are successive, not simultaneous, execution turns.'),
  ]],
  apply: ['dispatch-worker', 'Dispatch calculation to worker', 'Worker used one unit; UI remained available.'],
  contrast: ['block-ui', 'Run calculation in the UI handler', 'UI began the long handler; a new input was queued.'],
  recover: ['move-work', 'Cancel the inline fixture and dispatch the same work to worker', 'Reset the bounded calculation, then ran its first worker slice.'],
  verify: ['send-input', 'Send input and advance two scheduling turns', 'UI handled input; worker used another unit.'],
})

const threadTransfer = probe({
  briefing: 'The worker now waits for simulated storage instead of consuming CPU. On one logical CPU, test UI input while the worker is waiting, then compare blocking the UI on that wait.',
  prediction: check('Must a waiting worker occupy the only CPU?',
    'No: a waiting thread is not executing; the UI can run.', 'Yes: a process owns its CPU until all its work completes.',
    'A blocked thread does not consume an execution slot. Its process may still have another runnable thread.'),
  mechanism: check('How can the UI run with an unfinished storage request?',
    'The worker waits while the UI thread uses the CPU.', 'The waiting worker is running invisibly on the same CPU.',
    'Waiting is different from running. An unfinished request need not occupy the UI event handler.'),
  required: ['wait-state', 'wait-input'],
  start: ['Storage work queued', 'One logical CPU; worker and UI are separate threads.', [
    evidence('wait-before', 'Request state', 'Not submitted; UI idle', 'The changed condition is a wait rather than CPU calculation.'),
  ]],
  changed: ['Worker blocked on storage', 'Only the worker is waiting; the UI remains runnable.', [
    evidence('wait-state', 'Thread states', 'Worker waiting; UI ready; 1 logical CPU', 'No CPU execution is attributed to the waiting worker.'),
  ]],
  alternative: ['UI joined the wait', 'The UI synchronously waits for the worker; input cannot be handled yet.', [
    evidence('joined-wait', 'Thread states', 'Worker waiting; UI waiting; input queued', 'Moving work to a worker is not enough if the UI then blocks waiting for it.'),
  ]],
  verified: ['UI handles input', 'The storage completion has not happened, but the input event has.', [
    evidence('wait-state', 'Thread states', 'Worker waiting; UI ready; 1 logical CPU', 'After its event handler returned, the UI is ready for another event.'),
    evidence('wait-input', 'Observed response', 'Input handled; storage still pending', 'The UI took a scheduling turn while the worker remained waiting.'),
  ]],
  apply: ['submit-storage', 'Submit storage work without blocking UI', 'Worker entered a wait; UI stayed ready.'],
  contrast: ['join-worker', 'Block UI until storage finishes', 'Both threads are waiting; input queued.'],
  recover: ['release-ui', 'Reset the blocked-handler fixture and submit asynchronously', 'Restored the request, then left only the worker waiting.'],
  verify: ['send-input', 'Send input and schedule the UI', 'UI handled input; worker remained waiting.'],
})

const privateAddresses = probe({
  briefing: 'Two processes use virtual address 0x1000. Their private mappings initially hold different values. Write in process A, then read process B; no page-table expertise is needed.',
  prediction: check('Will writing A’s 0x1000 overwrite B’s 0x1000?',
    'No: these private mappings are separate.', 'Yes: equal address numbers identify the same memory everywhere.',
    'A virtual address is interpreted within an address space. These two private mappings have different backing.'),
  mechanism: check('Why did B retain its original value?',
    'The same virtual number resolved through different process address spaces.',
    'B ignored the write even though both mappings referred to one shared writable location.',
    'A changed to 8 while B remained 3. Equal virtual addresses alone do not establish sharing.'),
  required: ['a-mapping', 'b-mapping'],
  start: ['Equal numbers, different mappings', 'A and B both use 0x1000; their backing is private.', [
    evidence('maps-before', 'Before write', 'A: private A = 1; B: private B = 3', 'The address number is the same; the address-space context is not.'),
  ]],
  changed: ['Write in A', 'Only A’s mapped value changes from 1 to 8.', [
    evidence('a-mapping', 'A after write', 'PID 6100: VA 0x1000 -> private A; value 8', 'Writing through A’s mapping changed private A.'),
  ]],
  alternative: ['Write in B instead', 'The controlled contrast changes B from 3 to 9; A remains 1.', [
    evidence('b-write-branch', 'Alternate write', 'A = 1; B = 9', 'The selected address space determines the target.'),
  ]],
  verified: ['Read the peer', 'A is 8 and B is still 3 after the A-only write.', [
    evidence('a-mapping', 'A after write', 'PID 6100: VA 0x1000 -> private A; value 8', 'The A snapshot is retained for comparison.'),
    evidence('b-mapping', 'B after A write', 'PID 6104: VA 0x1000 -> private B; value 3', 'The read resolved using B’s separate mapping.'),
  ]],
  apply: ['write-a', 'Write 8 through A’s address', 'A changed 1 -> 8; B stayed 3.'],
  contrast: ['write-b', 'Write 9 through B’s address instead', 'B changed 3 -> 9; A stayed 1.'],
  recover: ['reset-write-a', 'Restore initial values, then write A', 'Restored A=1/B=3, then wrote A=8.'],
  verify: ['read-b', 'Read the same virtual number in B', 'Read B=3 through private B; A remains 8.'],
})

const addressTransfer = probe({
  briefing: 'A third process has no mapping at 0x1000. Compare reading that unmapped address with reading the valid private address 0x2000. A number used by a peer does not grant a mapping.',
  prediction: check('Can C read 0x1000 just because A uses that number?',
    'No: C needs its own valid mapping.', 'Yes: mappings are global for all processes.',
    'An unmapped address in C is not made valid by a mapping in A.'),
  mechanism: check('What explains one failed read and one successful read?',
    'C’s own address-space map contains 0x2000 but not 0x1000.',
    'Any memory read requires another process to be running first.',
    'The failing and succeeding probes differ in mapping availability within C, not in the spelling of the program name.'),
  required: ['unmapped-read', 'valid-read'],
  start: ['A different address map', 'C maps only 0x2000 to private C with value 5. A still maps 0x1000.', [
    evidence('c-map-before', 'C’s map', '0x1000 unmapped; 0x2000 -> private C = 5', 'This is a prepared map, not a live debugger read.'),
  ]],
  changed: ['Read refused', 'The controlled invalid probe reports failure without terminating the teaching fixture.', [
    evidence('unmapped-read', 'Read C at 0x1000', 'Failed: C has no mapping at 0x1000', 'A’s mapping does not populate C’s address space.'),
  ]],
  alternative: ['Read the mapped address first', 'C’s valid address returns its own value.', [
    evidence('valid-first', 'Read C at 0x2000', 'Succeeded: value 5', 'A successful read does not imply all other addresses are mapped.'),
  ]],
  verified: ['Probe the valid address', 'C can read its own mapping, even though the equal-number peer probe failed.', [
    evidence('unmapped-read', 'Read C at 0x1000', 'Failed: C has no mapping at 0x1000', 'The failed controlled probe is unchanged.'),
    evidence('valid-read', 'Read C at 0x2000', 'Succeeded: private C value 5', 'Different virtual address, valid mapping in C.'),
  ]],
  apply: ['read-peer-address', 'Probe C at the address used by A', 'C’s controlled read failed because 0x1000 is unmapped.'],
  contrast: ['read-own-address', 'Read C’s mapped address first', 'C read 5 from 0x2000.'],
  recover: ['probe-unmapped', 'Now probe C at 0x1000', 'The unmapped probe failed; C remains available for the next probe.'],
  verify: ['read-valid', 'Read C’s valid 0x2000 mapping', 'C read 5 from its own mapping.'],
})

const boundary = probe({
  briefing: 'A user-mode application requests a file handle. Trace the same PID and TID into a kernel-mode system service and back. Crossing privilege mode is not launching a new process.',
  prediction: check('Must the service request create a new PID or TID?',
    'No: this trace keeps the caller’s PID and TID while its mode changes.',
    'Yes: kernel mode is a separate process for every request.',
    'Mode describes execution privilege. This synchronous service trace keeps the caller’s process and thread identity.'),
  mechanism: check('Why could the file request be serviced without a new process?',
    'The caller entered a kernel service, which checked access and returned to user mode.',
    'The application turned its ordinary user-mode instructions into unrestricted privileged code.',
    'The trace shows controlled entry and return with unchanged identity, not a privilege upgrade for all application code.'),
  required: ['service-route', 'service-result'],
  start: ['Caller in user mode', 'PID 7100 / TID 7101 wants an allowed file handle.', [
    evidence('caller-before', 'Initial execution', 'PID 7100 / TID 7101; user mode; handles 0', 'The permission fixture allows this particular open.'),
  ]],
  changed: ['Kernel service entered', 'The same caller is now executing the modeled service route.', [
    evidence('mode-inside', 'Execution inside service', 'PID 7100 / TID 7101; kernel mode', 'System service code checks access; caller identity has not changed.'),
  ]],
  alternative: ['Direct privileged access refused', 'A normal user instruction cannot directly access the modeled kernel-only state.', [
    evidence('direct-attempt', 'Direct attempt', 'Refused; user mode; handles 0', 'The controlled probe leaves the caller alive.'),
  ]],
  verified: ['Return to the caller', 'The allowed open returns one handle, and the caller resumes user-mode execution.', [
    evidence('service-route', 'Mode and identity trace', 'PID 7100 / TID 7101: user -> kernel service -> user', 'The process and thread did not change during this synchronous route.'),
    evidence('service-result', 'Service outcome', 'Access checked; file handle returned', 'Handles 0 -> 1 in the caller; user mode resumes.'),
  ]],
  apply: ['request-service', 'Request a file handle through the service', 'Entered the kernel service with caller PID 7100 / TID 7101.'],
  contrast: ['direct-access', 'Probe direct kernel-only access from user mode', 'The protected probe was refused; no handle was created.'],
  recover: ['use-service', 'Use the supported service route instead', 'Entered the kernel service without changing PID or TID.'],
  verify: ['return-user', 'Finish the access check and return', 'Open succeeded; returned a handle and resumed user mode.'],
})

const boundaryTransfer = probe({
  briefing: 'This caller lacks permission to open a protected file. Test the system-service route and then an explicitly authorized public file. Kernel execution does not erase the caller’s access restrictions.',
  prediction: check('Does entering a kernel service guarantee a protected open succeeds?',
    'No: the service can deny access using the caller’s security context.',
    'Yes: everything in kernel mode is automatically allowed for the caller.',
    'A system service checks the request. Running service code in kernel mode does not grant the requesting application unlimited rights.'),
  mechanism: check('Why did the protected open fail while the public open succeeded?',
    'The same service enforced different permissions for the requested objects.',
    'The failed request never crossed into an OS service.',
    'Both used the service boundary. The object-specific access check, not a changed PID or privilege label, determined the result.'),
  required: ['denied-service', 'allowed-service'],
  start: ['Two files, different permissions', 'PID 7200 / TID 7201 has access only to public.txt.', [
    evidence('permissions-before', 'Prepared permissions', 'protected.txt denied; public.txt allowed; handles 0', 'The permission decision is a fixed fixture, not a full ACL simulation.'),
  ]],
  changed: ['Protected request denied', 'The service checks access and returns failure to the same caller.', [
    evidence('denied-service', 'Protected open route', 'PID 7200 / TID 7201: user -> kernel check -> user; access denied', 'No protected-file handle was returned.'),
  ]],
  alternative: ['Public request succeeds first', 'The public object permits the requested access.', [
    evidence('public-first', 'Public open', 'Handle returned for public.txt; protected permission unchanged', 'Opening a public file does not authorize protected.txt.'),
  ]],
  verified: ['Authorized request succeeds', 'A public-file open after the denial returns a handle through the same service.', [
    evidence('denied-service', 'Protected open route', 'PID 7200 / TID 7201: user -> kernel check -> user; access denied', 'The earlier protected denial remains the same observation.'),
    evidence('allowed-service', 'Public open route', 'Same PID/TID and mode route; public.txt handle returned', 'Object permissions changed the result; handles 0 -> 1 on the canonical path.'),
  ]],
  apply: ['open-protected', 'Request protected.txt', 'Access checked and denied; returned to user mode with no handle.'],
  contrast: ['open-public-first', 'Request public.txt first', 'The allowed open returned a public-file handle.'],
  recover: ['close-public-probe', 'Close that handle and probe protected.txt', 'Closed the public handle; protected open was denied.'],
  verify: ['open-public', 'Request the authorized public file', 'Public access allowed; handle returned to the same caller.'],
})

const architecture = probe({
  briefing: 'Follow a tiny file-read workload through cooperating components: application, system-service boundary, I/O manager, driver, and device. The scheduler separately gives its thread execution time.',
  prediction: check('Does the CPU scheduler alone provide file contents?',
    'No: it schedules threads; the I/O route serves the read.',
    'Yes: scheduling a process replaces the need for drivers.',
    'Execution scheduling and file/device services collaborate, but perform different jobs.'),
  mechanism: check('Which collaboration produced the buffer?',
    'A scheduled application thread requested I/O; the I/O manager and driver served the read.',
    'The user-mode application directly controlled the device through the scheduler.',
    'The service route and filled buffer show component cooperation rather than one component doing everything.'),
  required: ['architecture-route', 'architecture-buffer'],
  start: ['Thread ready, buffer empty', 'The thread has a file-read task. Components are present but no request has run.', [
    evidence('architecture-before', 'Work state', 'Thread ready; buffer empty; device idle', 'The scheduler selects a thread, not a whole process record.'),
  ]],
  changed: ['Request routed', 'A scheduling turn lets the application submit the selected read route.', [
    evidence('architecture-route', 'Component route', 'Application -> system service -> I/O manager -> driver -> device', 'Scheduler supplies execution turns; memory manager supports the mapped buffer.'),
  ]],
  alternative: ['Scheduling without a request', 'The thread runs arithmetic instead. No I/O has been submitted.', [
    evidence('schedule-only', 'After arithmetic turn', 'Thread ran; device idle; buffer empty', 'Execution time alone does not fill a file buffer.'),
  ]],
  verified: ['Device result reaches the caller', 'The driver and I/O route deliver the selected data to the application’s mapped buffer.', [
    evidence('architecture-route', 'Component route', 'Application -> system service -> I/O manager -> driver -> device', 'This is the chosen simplified read path.'),
    evidence('architecture-buffer', 'After completion', 'Buffer empty -> 4 bytes available to application', 'The read, not arithmetic scheduling alone, supplied the bytes.'),
  ]],
  apply: ['route-read', 'Schedule the caller and submit its read', 'Caller ran and routed the read through modeled I/O components.'],
  contrast: ['schedule-arithmetic', 'Schedule arithmetic without submitting I/O', 'Arithmetic ran; device and file buffer stayed unchanged.'],
  recover: ['submit-read', 'Submit the actual read on the next turn', 'Caller submitted the selected service/I/O/driver/device route.'],
  verify: ['complete-read', 'Complete device work and inspect the buffer', 'Four bytes reached the caller through the I/O return path.'],
})

const architectureTransfer = probe({
  briefing: 'The data is already in the modeled file cache. Compare a cache read with a cache miss: the I/O system can serve data without new device work, while a miss needs the driver/device route.',
  prediction: check('Must every file read cause fresh physical-device work?',
    'No: this cache hit can return data without new device work.',
    'Yes: all reads always use an identical device route.',
    'The architecture has cooperating services; not all requests take the same path. This fixture explicitly models one cache hit.'),
  mechanism: check('Why was the cached buffer filled while the device-work count stayed zero?',
    'The modeled cache supplied the data; the miss contrast needed device work.',
    'The application bypassed all OS services by being scheduled.',
    'The route and counters identify an OS cache path, not direct application device control.'),
  required: ['cache-route', 'cache-result'],
  start: ['Warm cache', 'The requested four bytes are already cached. A second file is not cached.', [
    evidence('cache-before', 'Prepared cache state', 'Requested file cached; alternate file absent; device work 0', 'Cache presence is the meaningful changed condition.'),
  ]],
  changed: ['Cache route chosen', 'The service and modeled cache manager satisfy the requested read.', [
    evidence('cache-route', 'Chosen route', 'Application -> service -> I/O/cache collaboration; no new device work', 'The already-present bytes make the short route possible.'),
  ]],
  alternative: ['Cache miss contrast', 'Reading the absent file requires modeled driver/device work.', [
    evidence('cache-miss', 'Alternate route', 'Cache miss -> driver/device; device work 1', 'The miss differs in data availability, not merely the application name.'),
  ]],
  verified: ['Cached data delivered', 'The hit returns data without issuing fresh physical-device work.', [
    evidence('cache-route', 'Chosen route', 'Application -> service -> I/O/cache collaboration; no new device work', 'The selected read used the warm cache.'),
    evidence('cache-result', 'Hit counters', 'Buffer 4 bytes; new device work 0', 'Before: empty buffer and no device work. After: filled buffer with no new device work.'),
  ]],
  apply: ['read-cached', 'Read the cached file', 'Selected the cache-hit service route.'],
  contrast: ['read-missing', 'Read the uncached file instead', 'The miss needed one modeled device operation.'],
  recover: ['reset-cache-hit', 'Reset counters, then read the warm cached file', 'Restored the fixture and selected the hit route.'],
  verify: ['inspect-cache-result', 'Deliver cached bytes and inspect counters', 'Four bytes delivered; no fresh device operation issued.'],
})

const workstation = probe({
  briefing: 'Inspect a healthy notes application rather than hunt for a fault. It has a process, UI/worker threads, a private buffer, and an allowed save service. Send input while the worker saves, then verify the result.',
  prediction: check('Can one application remain healthy while its worker waits for a save?',
    'Yes: the UI can run and the pending save can later complete.',
    'No: any waiting thread proves the whole process is broken.',
    'A process can own several threads with different states. A legitimate wait is not by itself a failure.'),
  mechanism: check('Which explanation fits the healthy workstation?',
    'A process owns private resources; its UI takes turns while a worker waits for an allowed OS save.',
    'The executable file itself is scheduled and all its threads must always run together.',
    'The identity/resource snapshot and completed save connect process ownership, thread execution, and OS services.'),
  required: ['foundation-state', 'foundation-result'],
  start: ['Healthy task pending', 'PID 7600 has UI 7601, worker 7602, and a private draft buffer with 12 bytes.', [
    evidence('foundation-before', 'Before save', 'One process; two threads; draft 12 bytes; saved 0 bytes', 'One logical CPU supplies execution turns.'),
  ]],
  changed: ['Save submitted without blocking UI', 'Worker waits for completion; UI remains runnable.', [
    evidence('foundation-state', 'Ownership and execution', 'PID 7600 owns private draft; UI ready; worker waiting on save', 'The allowed service request is pending, not failed.'),
  ]],
  alternative: ['UI blocked by synchronous save', 'Input queues while the UI waits for the same allowed save.', [
    evidence('foundation-blocked', 'Contrasting UI state', 'UI waiting; worker idle; input queued', 'A correct file permission does not guarantee UI responsiveness.'),
  ]],
  verified: ['Responsive input and completed save', 'The UI runs an input turn and the modeled save then completes.', [
    evidence('foundation-state', 'Ownership and execution', 'PID 7600 owns private draft; UI ready; worker waiting on save', 'This records the observed pending phase before completion.'),
    evidence('foundation-result', 'After turns and completion', 'Input handled; 12 bytes saved; worker ready; same PID', 'The application stayed in its own process; an OS service performed the save.'),
  ]],
  apply: ['save-worker', 'Submit save from the worker', 'Worker submitted the allowed service request and waited; UI remained ready.'],
  contrast: ['save-ui', 'Save synchronously on the UI instead', 'UI waited and input queued.'],
  recover: ['reset-save-worker', 'Reset the draft fixture and save from worker', 'Restored unsaved draft, then submitted worker save without blocking UI.'],
  verify: ['input-and-complete', 'Handle input, then complete save', 'UI handled input; allowed save wrote 12 bytes and woke the worker.'],
})

const workstationTransfer = probe({
  briefing: 'Now there are two isolated editor processes and the second editor has a CPU-bound worker, not a storage wait. Close the first editor while giving the second UI an execution turn, then verify its save.',
  prediction: check('Will closing editor A remove editor B’s threads and draft?',
    'No: B is an independent process and can continue its own work.',
    'Yes: using the same executable makes all instances one execution lifetime.',
    'Separate process instances have distinct lifetimes and resources; B’s CPU-bound worker can share turns with B’s UI.'),
  mechanism: check('Why did B remain responsive and save after A closed?',
    'B retained its process resources; its UI and worker shared CPU turns and used an allowed save service.',
    'A’s exit transformed B’s private memory into kernel code.',
    'The survivor and save trace join independent lifetimes, private ownership, thread turns, and the service boundary.'),
  required: ['integrated-survivor', 'integrated-save'],
  start: ['Two editors on one CPU', 'A is PID 7700; B is PID 7704 with a private 20-byte draft and two threads.', [
    evidence('integrated-before', 'Before intervention', '2 processes; B worker CPU-bound; B UI ready; saved 0 bytes', 'B’s worker is ready to calculate, not waiting on storage.'),
  ]],
  changed: ['A closed, B continues', 'Only A exited. B’s UI can take a turn between worker slices.', [
    evidence('integrated-survivor', 'Surviving ownership', 'A exited; B 7704 alive; private draft 20 bytes; UI input handled', 'One CPU alternated B worker -> B UI.'),
  ]],
  alternative: ['More work on B’s UI', 'A remains alive, but B’s UI begins inline calculation and queues input.', [
    evidence('integrated-inline', 'Alternate condition', 'A alive; B UI busy; B draft retained; input queued', 'The UI workload, not process count, causes this input delay.'),
  ]],
  verified: ['B’s own save completes', 'After the calculation, B submits the allowed save and receives its result.', [
    evidence('integrated-survivor', 'Surviving ownership', 'A exited; B 7704 alive; private draft 20 bytes; UI input handled', 'The observed survivor phase precedes the save.'),
    evidence('integrated-save', 'B service trace', 'B thread: user -> kernel save -> user; 20 bytes saved', 'The same process retained its draft and received a successful service result.'),
  ]],
  apply: ['close-a-and-input', 'Close A and give B’s UI a turn', 'A exited; B retained its draft and handled input between worker slices.'],
  contrast: ['calculate-on-ui', 'Run B’s calculation inline instead', 'B UI became busy while A remained alive.'],
  recover: ['restore-worker-close-a', 'Reset workload, use B worker, close A and send input', 'Restored B calculation, closed A only, and scheduled B UI between worker slices.'],
  verify: ['save-b', 'Finish B’s calculation and save its draft', 'B completed work and saved 20 bytes through the allowed OS service.'],
})

const creation = probe({
  briefing: 'Create a suspended process to separate creation from readiness. The image and initial thread can exist before that thread is eligible to execute.',
  prediction: check('Is a successfully created suspended initial thread already ready to run?',
    'No: it must be resumed before it is ready.', 'Yes: creation means application code has already run.',
    'Creation establishes a process and initial thread. A suspended creation deliberately delays execution eligibility.'),
  mechanism: check('What changed when the initial thread was resumed?',
    'The already-created thread became ready; it has not yet received an execution turn.',
    'A second process was created to replace the suspended one.',
    'The PID/TID creation snapshot and readiness snapshot distinguish resource creation from scheduling and application initialization.'),
  required: ['creation', 'readiness'],
  start: ['Image available', 'No child process exists yet. The image file is present.', [
    evidence('create-before', 'Before creation', 'Image on disk; no child PID/TID', 'Use the suspended flag to expose distinct phases.'),
  ]],
  changed: ['Created but suspended', 'The process owns a mapped image and a suspended initial thread.', [
    evidence('creation', 'Created resources', 'Image mapped; PID 8100; TID 8101 suspended', 'This fixture omits intermediate loader bookkeeping.'),
  ]],
  alternative: ['Default creation', 'Without suspension, the initial thread becomes ready immediately in this fixture.', [
    evidence('default-create', 'Default launch', 'PID 8100; TID 8101 ready; no execution turn yet', 'Ready still does not mean initialization already finished.'),
  ]],
  verified: ['Initial thread ready', 'Resume removes suspension; a later scheduling turn would begin user-mode loader and application work.', [
    evidence('creation', 'Created resources', 'Image mapped; PID 8100; TID 8101 suspended', 'This snapshot records the earlier created-but-suspended phase.'),
    evidence('readiness', 'After resume', 'TID 8101 ready; application initialization not yet executed', 'Ready means eligible for scheduling, not proof of executed code.'),
  ]],
  apply: ['create-suspended', 'Create with the initial thread suspended', 'Mapped image, created process and initial suspended thread.'],
  contrast: ['create-default', 'Create without suspension instead', 'Mapped image and created an initial ready thread, before any modeled execution turn.'],
  recover: ['restart-suspended', 'Close that fixture and create a fresh suspended process', 'Closed the default child; restored fixture and created it suspended.'],
  verify: ['resume', 'Resume the initial thread without scheduling it yet', 'TID 8101 changed suspended -> ready.'],
})

const creationTransfer = probe({
  briefing: 'Creation now fails because the requested executable is absent. Compare it with a present image, and separate successful creation from the later initialization turn.',
  prediction: check('Does a failed launch leave a ready application thread in this fixture?',
    'No: failure before resource creation leaves no child PID/TID.',
    'Yes: every launch request creates a running application.',
    'A launch request is not evidence of a created process. Here the missing image fails before any child is created.'),
  mechanism: check('What establishes that the repaired launch actually started initialization?',
    'A valid-image creation produced a ready initial thread, then a scheduling turn began initialization.',
    'The earlier missing-image request was enough to prove successful execution.',
    'The created resources and executed initialization are separate observations; the failed branch had neither.'),
  required: ['valid-creation', 'initialization-turn'],
  start: ['Requested image absent', 'missing-tool.exe is absent; valid-tool.exe is available.', [
    evidence('image-availability', 'Image fixture', 'Missing target absent; alternate target present; no child', 'This scenario changes creation success, not just the child name.'),
  ]],
  changed: ['Valid image created', 'Selecting the present image creates a ready initial thread, but it has not executed yet.', [
    evidence('valid-creation', 'Created resources', 'PID 8110; TID 8111 ready; image mapped', 'Creation succeeded after selecting the available executable.'),
  ]],
  alternative: ['Launch rejected', 'The unavailable executable cannot supply a child process.', [
    evidence('missing-launch', 'Failed request', 'Image not found; no child PID/TID', 'This bounded failure occurs before child resource creation.'),
  ]],
  verified: ['First execution turn', 'The initial thread receives CPU time and starts initialization.', [
    evidence('valid-creation', 'Created resources', 'PID 8110; TID 8111 ready; image mapped', 'This is the pre-execution creation observation.'),
    evidence('initialization-turn', 'After scheduling', 'TID 8111 executed one turn; initialization begun, not completed', 'A ready thread has now actually executed; initialization may take further work.'),
  ]],
  apply: ['choose-valid-image', 'Create from the available image', 'Created PID 8110 and ready TID 8111.'],
  contrast: ['launch-missing', 'Attempt the absent image', 'Launch failed before any child PID/TID existed.'],
  recover: ['repair-image', 'Select the present executable and retry', 'Created the valid image process and its ready initial thread.'],
  verify: ['schedule-initial', 'Give the initial thread one execution turn', 'Initial thread began loader/application initialization.'],
})

const anatomy = probe({
  briefing: 'Inspect prepared ownership records. Start with what a process owns, then what a thread belongs to. Synthetic EPROCESS/ETHREAD labels introduce debugger vocabulary without pretending to expose authentic offsets.',
  prediction: check('Do two threads in one process normally get separate private process address spaces?',
    'No: the process owns the address space; its threads execute within it.',
    'Yes: each thread is a miniature process with its own process handle table.',
    'Process-level resources and thread-level execution state are different. Threads share their process address space while retaining their own execution state.'),
  mechanism: check('How do these prepared records relate?',
    'The process owns resources; the thread record refers to its owning process and has execution state.',
    'The thread owns a second executable process whenever it is scheduled.',
    'The ownership and thread-link snapshots show two distinct conceptual records with a relationship, not universal memory offsets.'),
  required: ['process-record', 'thread-record'],
  start: ['Prepared record shelf', 'PID 8200 has TIDs 8201 and 8202. Select ownership or execution details.', [
    evidence('record-before', 'Fixture identity', 'PID 8200; two thread identities; synthetic records', 'All fields are curated teaching labels, not a memory dump.'),
  ]],
  changed: ['Process ownership', 'The prepared view groups address space and handle ownership at process level.', [
    evidence('process-record', 'Conceptual process record', 'Synthetic EPROCESS view: PID 8200 owns address space and handles', 'Build-specific structures contain more detail; no offsets are asserted.'),
  ]],
  alternative: ['Thread execution first', 'A thread view shows ready state and owner PID, not a second process handle table.', [
    evidence('thread-first', 'Execution view', 'TID 8202 ready; owner PID 8200; own execution context', 'The thread has its own execution context within the shared process space.'),
  ]],
  verified: ['Link execution to ownership', 'TID 8201 belongs to the same process and uses its resources.', [
    evidence('process-record', 'Conceptual process record', 'Synthetic EPROCESS view: PID 8200 owns address space and handles', 'The previously inspected ownership view is unchanged.'),
    evidence('thread-record', 'Conceptual thread record', 'Synthetic ETHREAD view: TID 8201 belongs to PID 8200', 'Its prepared state is ready; actual record layouts vary by build and architecture.'),
  ]],
  apply: ['inspect-process', 'Inspect prepared process ownership', 'Read the synthetic process resource view.'],
  contrast: ['inspect-worker-first', 'Inspect worker execution state first', 'Read TID 8202 state and owner link.'],
  recover: ['follow-owner', 'Follow the worker’s owner link', 'Reached PID 8200 and inspected its process resources.'],
  verify: ['inspect-thread', 'Inspect the initial thread’s owner and state', 'Read TID 8201 and verified it belongs to PID 8200.'],
})

const anatomyTransfer = probe({
  briefing: 'Now two process records both show local handle value 0x40, but for different objects. Follow one thread’s owner before resolving the handle. The same local number need not mean the same object.',
  prediction: check('Does handle 0x40 in two independent process tables prove one shared object?',
    'No: resolve it in the owning process’s handle table.',
    'Yes: every handle number has one global meaning.',
    'Handles are process-relative entries. Sharing an object can be arranged, but matching numeric entries alone do not establish it.'),
  mechanism: check('Why did the same number resolve to different objects?',
    'Each thread’s owner selected a different process handle table.',
    'Scheduling a thread automatically renumbered all system objects.',
    'The owner link and the two resolved entries establish process-relative interpretation in these synthetic records.'),
  required: ['handle-owner', 'handle-resolution'],
  start: ['Two synthetic tables', 'PID 8210 maps 0x40 to file A; PID 8214 maps 0x40 to event B.', [
    evidence('handle-before', 'Prepared records', 'TID 8211 owner 8210; TID 8215 owner 8214; local value 0x40 in each', 'These are conceptual ownership labels, not authentic dump offsets.'),
  ]],
  changed: ['Resolve the owner context', 'Follow TID 8211 to its owning process before interpreting 0x40.', [
    evidence('handle-owner', 'Thread-to-process link', 'Synthetic ETHREAD owner: TID 8211 -> PID 8210', 'The link selects PID 8210’s process resources.'),
  ]],
  alternative: ['Inspect the other table', 'PID 8214’s local entry refers to event B, not file A.', [
    evidence('other-table', 'Other process entry', 'PID 8214: 0x40 -> event B', 'This does not resolve TID 8211’s local handle.'),
  ]],
  verified: ['Same value, different entries', 'Compare both local entries after establishing the thread owner.', [
    evidence('handle-owner', 'Thread-to-process link', 'Synthetic ETHREAD owner: TID 8211 -> PID 8210', 'The selected thread still belongs to PID 8210.'),
    evidence('handle-resolution', 'Resolved handle entries', 'PID 8210: 0x40 -> file A; PID 8214: 0x40 -> event B', 'Process table context, not numeric equality, determines these targets.'),
  ]],
  apply: ['follow-thread-owner', 'Follow TID 8211’s owner', 'Selected PID 8210’s synthetic resource record.'],
  contrast: ['inspect-other-table', 'Resolve 0x40 in PID 8214 first', 'Resolved event B in the other process table.'],
  recover: ['select-owner-table', 'Follow TID 8211 to its actual owner', 'Selected PID 8210 instead of the unrelated process table.'],
  verify: ['resolve-both', 'Resolve 0x40 in both process tables', 'Resolved file A versus event B without changing the local numeric value.'],
})

const jobs: Experiment = {
  briefing: 'A job already has two active worker members and an active-process limit of two. Try admitting a third, release a slot, and retry. An unrelated process outside the job is not counted by this selected limit.',
  prediction: check('Can this job admit a third active member with its limit still two?',
    'No: admission is rejected while both slots are occupied.',
    'Yes: a job name automatically overrides its configured limits.',
    'The active-process limit bounds active member processes. A job groups work and enforces only its configured controls.'),
  initial: 'full',
  investigation: {
    ...check('Why did retry succeed after a member exited?',
      'Membership dropped below the configured limit; retry filled the freed slot.',
      'The job limit counted threads, and one thread stopped.',
      'The active-member count changed 2 -> 1 -> 2. Outsider PID 8399 was never a member and stayed unchanged.'),
    requiredEvidence: ['job-members', 'job-admission'],
  },
  nodes: {
    full: node('Two occupied slots', 'Job J has members 8300 and 8304, limit 2. Outsider 8399 is alive outside J.', [
      evidence('job-before', 'Configured membership', 'J: 2 active members; limit 2; outsider 8399 not a member', 'This is an active-process limit, not a CPU, memory, or thread-count limit.'),
    ], [
      action('admit-third', 'Create PID 8308 and attempt job assignment', 'rejected', 'Assignment exceeded limit 2; 8308 terminated and all its process handles closed. Original membership remains 2.'),
      action('finish-member', 'Let PID 8304 finish and close its process handles', 'slot', 'PID 8304 exited and its process handles closed; job active membership dropped to 1.'),
      action('inspect-outsider', 'Observe an unassigned outsider', 'outside', 'PID 8399 remains outside J and is not counted in its active-process limit.'),
    ]),
    rejected: node('Assignment rejected', 'Exceeding this limit terminates the attempted worker. Its process handles are also closed so the transient failed-assignment count is released.', [
      evidence('job-rejection', 'Third-member attempt', 'Rejected: 2 active members / limit 2', 'The original member processes remain alive.'),
      evidence('rejected-worker', 'Failed worker cleanup', 'PID 8308 terminated; all its process handles closed', 'Windows can retain the exceeded-limit count until the terminated process’s handles are closed; this fixture closes them.'),
    ], [
      action('finish-member', 'Let PID 8304 finish and close its process handles', 'slot', 'PID 8304 exited and its process handles closed; active membership 2 -> 1.'),
      action('reset-fixture', 'Reset the full-job fixture', 'full', 'Restored the original two-member fixture.'),
    ]),
    outside: node('Outside membership', 'The outsider is not affected by J’s selected active-process count limit.', [
      evidence('outside-job', 'Outsider observation', 'PID 8399 alive; not in J; J still 2 active members', 'Creating a process near a job does not itself prove job membership.'),
    ], [
      action('admit-third', 'Create PID 8308 and try assigning it to J', 'rejected', 'Assignment exceeded the limit; 8308 terminated and all its process handles closed.'),
      action('finish-member', 'Let a member finish and close its process handles', 'slot', 'PID 8304 exited and its process handles closed; the outsider stayed alive.'),
    ]),
    slot: node('One free slot', 'Worker 8300 remains; 8304 finished. The limit remains two.', [
      evidence('job-members', 'After member exit', '1 active member: PID 8300', 'Active members 2 -> 1; outsider 8399 remains outside the job.'),
    ], [action('retry-admission', 'Create fresh worker PID 8312 and admit it', 'admitted', 'New worker 8312 became an active member; job membership 1 -> 2.')]),
    admitted: node('Limit respected', 'The new member fills the freed slot. No blanket restriction was applied to the unrelated outsider.', [
      evidence('job-admission', 'After successful admission', '2 active members: PIDs 8300, 8312; outsider 8399 unchanged', 'The limit is still two. This fresh worker is not the terminated failed-assignment lifetime.'),
    ], [action('reset-fixture', 'Reset and compare another ordering', 'full', 'Closed fixture workers and restored initial members and limit.')], true),
  },
}

const jobTransfer = probe({
  briefing: 'A different job has one member and a limit of one; a second running worker is outside it. Compare outside execution with explicit assignment. A failed over-limit assignment terminates its attempted worker; adjust the limit before admitting a fresh replacement.',
  prediction: check('Does an unassigned outsider automatically consume this job’s only slot?',
    'No: the count applies to actual job members.',
    'Yes: every process on the workstation belongs to the nearest named job.',
    'Job membership must be established. This fixture declares the outsider unassigned, with no inherited job association.'),
  mechanism: check('Why could assignment succeed only after raising the active-process limit?',
    'The existing member occupied limit 1; after failed assignment cleanup, limit 2 allowed a fresh worker to become a second member.',
    'Changing the job label killed the outsider and removed the limit.',
    'The failed-assignment worker terminated. Its handles were closed, then a fresh replacement joined under limit two; an outside process is not counted before assignment.'),
  required: ['assignment-rejected', 'assignment-allowed'],
  start: ['One member, one outsider', 'J2 has member 8310 and limit 1; running 8318 is explicitly not a member.', [
    evidence('job2-before', 'Membership before assignment', 'J2: 1 active member / limit 1; 8318 outside', 'Outside execution does not increment J2’s count.'),
  ]],
  changed: ['Explicit assignment fails', 'Assignment exceeds the active-process limit, terminating attempted worker 8318. All its process handles are closed.', [
    evidence('assignment-rejected', 'Assignment attempt', 'Limit 1: 8318 terminated on failed assignment; 8310 remains sole member', 'Closing all failed-worker process handles releases the transient exceeded-limit count.'),
  ]],
  alternative: ['Another outside worker', 'Starting an unassigned process does not make it a member.', [
    evidence('unassigned-worker', 'Outside contrast', '8318 and 8320 outside; J2 active membership still 1', 'This fixture has no inherited job membership.'),
  ]],
  verified: ['Selected limit adjusted', 'Set active-process limit to two, create replacement 8324, and assign that new process.', [
    evidence('assignment-rejected', 'Assignment attempt', 'Limit 1: 8318 terminated on failed assignment; 8310 remains sole member', 'This is the earlier failed lifetime, not the replacement.'),
    evidence('assignment-allowed', 'After limit change and retry', 'Limit 2: active members 8310, 8324; member count 2', 'Changing this limit does not configure unrelated CPU or memory controls.'),
  ]],
  apply: ['assign-outsider', 'Try assigning the outside worker to J2', 'Over-limit assignment terminated 8318; all its process handles closed. Original member remains.'],
  contrast: ['launch-outside', 'Launch another explicitly unassigned worker', 'Started 8320 outside the job; J2 membership stayed one.'],
  recover: ['close-extra-and-assign', 'Close extra outsider and try assigning 8318', 'Closed 8320; over-limit assignment terminated 8318 and all its process handles closed.'],
  verify: ['raise-limit-retry', 'Raise limit to two, create a fresh worker and assign it', 'Created replacement 8324 and assigned it to J2; active membership became two.'],
})

const scheduling = probe({
  briefing: 'One logical CPU has three threads: 8401 and 8403 ready, 8402 waiting for I/O. Select a ready thread, then complete the wait and advance the scheduler. Observe eligibility separately from execution.',
  prediction: check('Can thread 8402 run before its I/O wait completes?',
    'No: it is waiting, not eligible for scheduling.',
    'Yes: the scheduler can run a waiting thread merely because the CPU is free.',
    'Ready threads are eligible. A waiting thread first needs its wait condition satisfied; waking makes it ready, not automatically running.'),
  mechanism: check('Why was the waiting thread absent from the first CPU turn?',
    'Only ready threads were eligible; I/O completion later moved the waiter to ready.',
    'The whole process had to run all its threads simultaneously.',
    'The lane snapshots show running, ready, and waiting as distinct states. With one CPU only one modeled thread is running.'),
  required: ['lanes', 'wake'],
  start: ['Three threads, one slot', '8401 ready; 8403 ready; 8402 waiting for the declared I/O completion.', [
    evidence('schedule-before', 'Initial states', '8401 ready; 8403 ready; 8402 waiting; CPU idle', 'The scheduler operates on threads.'),
  ]],
  changed: ['A ready thread runs', '8401 receives this bounded turn; the other ready thread remains eligible.', [
    evidence('lanes', 'During first CPU turn', '8401 running; 8403 ready; 8402 waiting', 'Exactly one thread is running on the one modeled CPU.'),
  ]],
  alternative: ['Waiter cannot be selected', 'The controlled attempt leaves the waiting thread blocked and the CPU idle.', [
    evidence('wait-attempt', 'Eligibility probe', 'TID 8402 waiting: not eligible to run', 'The pending I/O condition is not satisfied by wishing to schedule it.'),
  ]],
  verified: ['Completion makes a thread ready', 'I/O completes and 8401’s turn ends. This fixture gives the next turn to already-ready 8403.', [
    evidence('lanes', 'During first CPU turn', '8401 running; 8403 ready; 8402 waiting', 'This is the earlier lane observation.'),
    evidence('wake', 'After completion and context switch', '8402 waiting -> ready; 8403 running; 8401 ready', 'Wakeup establishes eligibility; this chosen next turn is not a universal Windows ordering.'),
  ]],
  apply: ['run-ready', 'Give ready 8401 the first turn', '8401 became running; 8403 stayed ready; 8402 stayed waiting.'],
  contrast: ['try-waiter', 'Try selecting waiting 8402 before completion', 'Rejected eligibility probe; waiting state unchanged.'],
  recover: ['run-ready', 'Select ready 8401 instead', '8401 began the CPU turn without changing 8402’s wait.'],
  verify: ['complete-io', 'Complete I/O, end turn, and schedule 8403', '8402 became ready; context switched from 8401 to 8403.'],
})

const schedulingTransfer = probe({
  briefing: 'Both threads are now waiting and the one CPU is idle. Deliver a specific event, then schedule its newly ready waiter. A free CPU cannot manufacture a satisfied wait condition.',
  prediction: check('Will extra scheduling attempts make progress while both threads wait?',
    'No: a relevant event must first make a thread ready.',
    'Yes: an idle CPU can execute any waiting thread without an event.',
    'No eligible work means no modeled execution. The event changes eligibility, and a later scheduling step changes ready to running.'),
  mechanism: check('What restored useful CPU execution?',
    'The event changed 8411 from waiting to ready, then the scheduler selected it.',
    'The idle CPU ran both waiting threads before the event.',
    'The readiness and running snapshots separate wakeup from execution. The other waiter’s unrelated condition stayed unsatisfied.'),
  required: ['event-ready', 'event-running'],
  start: ['No runnable thread', '8411 waits on event E; 8412 waits on unrelated storage. One CPU is idle.', [
    evidence('idle-before', 'Initial lanes', '8411 waiting on E; 8412 waiting on storage; CPU idle', 'This is a healthy bounded wait, not evidence of a deadlock.'),
  ]],
  changed: ['Event delivered', 'Event E satisfies only 8411’s wait; no CPU turn has occurred yet.', [
    evidence('event-ready', 'After event E', '8411 ready; 8412 waiting; CPU idle', 'Being ready is eligibility, not current execution.'),
  ]],
  alternative: ['Empty scheduling turn', 'Neither thread can run because both conditions remain unsatisfied.', [
    evidence('idle-attempt', 'Schedule without event', 'CPU remains idle; both threads waiting', 'No work counter advanced.'),
  ]],
  verified: ['Ready waiter executes', 'Select 8411 after it became ready; storage waiter remains waiting.', [
    evidence('event-ready', 'After event E', '8411 ready; 8412 waiting; CPU idle', 'This records the wakeup before scheduling.'),
    evidence('event-running', 'After selection', '8411 running; 8412 waiting; one unit completed', 'The ready thread, not the other waiter, received execution time.'),
  ]],
  apply: ['signal-event', 'Deliver event E', '8411 changed waiting -> ready; no thread ran yet.'],
  contrast: ['schedule-empty', 'Try scheduling before delivering any event', 'CPU stayed idle; no eligible thread existed.'],
  recover: ['signal-event', 'Deliver the wait condition’s event E', '8411 became ready while 8412 remained waiting.'],
  verify: ['schedule-awakened', 'Schedule the newly ready thread', '8411 became running and completed one unit.'],
})

const multicore = probe({
  briefing: 'Two independent CPU-only tasks each need four units. Compare one versus two logical CPUs, then measure completion. Independence permits overlap; the same total eight units of work still need doing.',
  prediction: check('With two independent four-unit tasks, what can two modeled CPUs change?',
    'Elapsed time can fall from eight units to four by overlap.',
    'The total computation disappears because two CPUs do twice as little work.',
    'Two execution slots can run independent tasks in parallel. Total work stays eight units; idealized elapsed time halves.'),
  mechanism: check('Why did elapsed time fall while total work remained eight units?',
    'Independent tasks overlapped on two logical CPUs.',
    'One thread ran on two CPUs at exactly the same instant.',
    'Each modeled task has its own runnable thread. Two CPUs allow two different threads to execute concurrently.'),
  required: ['parallel-work', 'parallel-completion'],
  start: ['Independent tasks ready', 'A and B each have four units, no dependency, and initially one logical CPU.', [
    evidence('parallel-before', 'One-CPU baseline', 'A 4 units + B 4 units; total 8; elapsed 8 on 1 CPU', 'The baseline omits overhead and assumes each task runs at one unit per turn.'),
  ]],
  changed: ['Two execution slots', 'Assign A and B to separate CPUs and advance four shared turns.', [
    evidence('parallel-work', 'Parallel timeline', '2 independent tasks x 4 units; 2 CPUs; elapsed 4 units', 'A and B both progressed each turn. Total completed work is still eight units.'),
  ]],
  alternative: ['One execution slot', 'Run the same tasks with one CPU; only one thread executes per turn.', [
    evidence('single-cpu-work', 'Serial execution of independent tasks', '1 CPU; total 8 units; elapsed 8 units', 'Independence alone does not create simultaneous execution slots.'),
  ]],
  verified: ['Measure completed work', 'Both tasks are done after the overlapping timeline.', [
    evidence('parallel-work', 'Parallel timeline', '2 independent tasks x 4 units; 2 CPUs; elapsed 4 units', 'This is the observed two-CPU run.'),
    evidence('parallel-completion', 'Completion counters', 'A done 4; B done 4; total work 8; elapsed 4', 'The improvement is elapsed time, not reduced work.'),
  ]],
  apply: ['use-two-cpus', 'Use two CPUs and execute independent work', 'A and B ran on distinct slots for four turns; both finished.'],
  contrast: ['use-one-cpu', 'Use one CPU and execute the same work', 'A and B shared one slot for eight turns.'],
  recover: ['rerun-two-cpus', 'Reset work counters and rerun with two CPUs', 'Restored both tasks, then completed them in four overlapping turns.'],
  verify: ['measure', 'Inspect per-task and elapsed counters', 'Measured eight completed work units over four elapsed units.'],
})

const multicoreTransfer = probe({
  briefing: 'Task B now needs A’s result before it can start. Both still need four units. Compare one and two CPUs without changing this dependency.',
  prediction: check('Will a second CPU halve time when B cannot start until A finishes?',
    'No: the unchanged dependency makes the eight-unit chain serial.',
    'Yes: every workload scales perfectly with CPU count.',
    'An extra execution slot helps only when there is eligible independent work to fill it. B cannot overlap A here.'),
  mechanism: check('Why did the second CPU fail to improve this chain?',
    'B was not eligible until A completed, so their four-unit intervals could not overlap.',
    'The scheduler deliberately refused all parallelism even though B was independent.',
    'The declared dependency and completed timeline explain eight elapsed units on either CPU count.'),
  required: ['serial-work', 'serial-completion'],
  start: ['Dependent task chain', 'A produces B’s input; B cannot execute first. There are eight total work units.', [
    evidence('dependency-before', 'Dependency', 'A 4 units -> B 4 units; B initially waiting for A result', 'This workload changes the dependency, not merely the task names.'),
  ]],
  changed: ['Two CPUs, one eligible task', 'A runs for four turns, then B runs for four. The second slot cannot run B early.', [
    evidence('serial-work', 'Dependency-constrained run', 'B waits for A: 4 + 4 units; elapsed 8 units', 'The chain remained serial with two logical CPUs.'),
  ]],
  alternative: ['One-CPU comparison', 'Run A then B on one CPU. The dependency already forbids overlap.', [
    evidence('serial-one', 'One-CPU result', 'A then B; elapsed 8 units; total work 8', 'This baseline matches the two-CPU elapsed time.'),
  ]],
  verified: ['Measure the chain', 'Both tasks completed, but never overlapped.', [
    evidence('serial-work', 'Dependency-constrained run', 'B waits for A: 4 + 4 units; elapsed 8 units', 'B started only after A produced its result.'),
    evidence('serial-completion', 'Two-CPU completion counters', '2 CPUs: elapsed 8 units; no overlap between A and B', 'Unused capacity cannot remove a data dependency.'),
  ]],
  apply: ['use-two-cpus', 'Run the dependent chain on two CPUs', 'A finished in four turns; only then B ran for four more.'],
  contrast: ['use-one-cpu', 'Run the same chain on one CPU', 'A then B completed in eight turns.'],
  recover: ['rerun-two-cpus', 'Reset the chain and compare with two CPUs', 'Reran the unchanged dependency; elapsed remained eight.'],
  verify: ['measure', 'Inspect the dependency timeline and counters', 'No A/B overlap; eight work units and eight elapsed units.'],
})

const termination = probe({
  briefing: 'An editor has an unsaved draft, two threads, private memory, and open handles. Compare an orderly exit that saves the draft with forced termination. OS cleanup and application finalization are not the same.',
  prediction: check('Does forced termination guarantee the application saves its unsaved draft?',
    'No: OS cleanup occurs, but the application’s save/finalization can be skipped.',
    'Yes: releasing the address space automatically writes all drafts to files.',
    'The OS tears down the process’s execution and owned resources. It does not perform arbitrary application-specific finalization on its behalf.'),
  mechanism: check('Why did only the orderly run preserve the draft?',
    'The application saved before exiting; both exit paths released modeled process resources.',
    'Forced termination leaves every process thread executing forever.',
    'Compare the orderly output with resource cleanup. A forced run also cleans up OS-managed resources but skips the application save handler.'),
  required: ['orderly-resources', 'orderly-output'],
  start: ['Draft not saved', 'PID 8500 owns two threads, private draft memory and three process handles.', [
    evidence('exit-before', 'Before exit', '2 live threads; 3 handles; draft unsaved', 'The configured orderly handler saves the draft; no job-specific effects are involved.'),
  ]],
  changed: ['Orderly exit finished', 'The application ran its save/finalization handler, then exited.', [
    evidence('orderly-output', 'Application output', 'Draft saved; application finalization ran', 'The save happened before process teardown.'),
  ]],
  alternative: ['Forced termination finished', 'The forced path skips the application’s handler but tears down modeled execution and owned resources.', [
    evidence('forced-resources', 'OS-managed cleanup', '0 live threads; address space released; process handles closed', 'Other references can keep kernel objects alive; a closed handle is not proof all objects vanished.'),
    evidence('forced-output', 'Application output', 'Unsaved draft lost; application finalization skipped', 'OS cleanup did not substitute for the application’s save operation.'),
  ]],
  verified: ['Inspect orderly cleanup', 'The saved file remains after the process resources are released.', [
    evidence('orderly-output', 'Application output', 'Draft saved; application finalization ran', 'Saved by the application before exit.'),
    evidence('orderly-resources', 'OS-managed cleanup', '0 live threads; address space released; process handles closed', 'The process object or other referenced objects may outlive this process execution.'),
  ]],
  apply: ['orderly-exit', 'Ask the application to save and exit', 'Application saved the draft, finalized, then exited.'],
  contrast: ['force-exit', 'Force termination without asking the application', 'Threads stopped and process resources were released; unsaved draft lost.'],
  recover: ['restart-orderly', 'Create a fresh equivalent draft fixture and exit orderly', 'Restarted a new teaching lifetime with the same unsaved draft, then saved and exited.'],
  verify: ['inspect-cleanup', 'Inspect saved output and process resource counts', 'No live threads or process handles remain; the saved draft exists.'],
})

const terminationTransfer = probe({
  briefing: 'A parent launcher and its independent child are not in a kill-on-close job. Force the parent to exit, then inspect the child. Compare a separate fixture with a job explicitly configured to terminate members on last-handle close.',
  prediction: check('Does every parent exit automatically terminate its child?',
    'No: parent-child creation alone is not a universal kill rule.',
    'Yes: Windows always kills all descendants whenever a parent exits.',
    'Child lifetime depends on explicit behavior and configured controls. This parent and child have no kill-on-close job association.'),
  mechanism: check('Why did the child survive the parent exit in the primary fixture?',
    'It was an independent process with no configured job kill-on-close relationship.',
    'The parent was still secretly executing because children cannot outlive it.',
    'The parent teardown and child probe establish distinct lifetimes. The separate configured job contrast demonstrates a specific policy, not a universal parent-exit rule.'),
  required: ['parent-cleanup', 'child-survivor'],
  start: ['Parent and child alive', 'Parent 8600 created child 8604; each owns its resources. Neither belongs to a kill-on-close job.', [
    evidence('family-before', 'Lifetime fixture', 'Parent 8600 alive; child 8604 alive; no kill-on-close job', 'There is no application rule instructing the child to exit with the parent.'),
  ]],
  changed: ['Parent forced out', 'The parent’s modeled resources are reclaimed; child resources are separate.', [
    evidence('parent-cleanup', 'Parent teardown', 'Parent threads 0; parent handles closed; parent address space released', 'Parent finalization was skipped. Child status requires a separate observation.'),
  ]],
  alternative: ['Configured job contrast', 'In a separate fixture, both processes are members of a kill-on-close job. Closing its last handle terminates both.', [
    evidence('job-kill-contrast', 'Explicit policy result', 'Last job handle closed; configured member processes both terminated', 'This is a job configuration effect, not the result of parentage alone.'),
  ]],
  verified: ['Probe the child independently', 'The primary-fixture child still has a live thread and its own resources.', [
    evidence('parent-cleanup', 'Parent teardown', 'Parent threads 0; parent handles closed; parent address space released', 'The earlier primary-fixture parent has exited.'),
    evidence('child-survivor', 'Independent child probe', 'Parent 8600 exited; child 8604 alive; no kill-on-close job', 'Child thread executes a bounded turn after the parent is gone.'),
  ]],
  apply: ['terminate-parent', 'Force only the non-job parent to exit', 'Parent terminated; no child-termination policy was invoked.'],
  contrast: ['close-kill-job', 'Use a separate kill-on-close job fixture and close its last handle', 'Configured job terminated both member processes.'],
  recover: ['reset-nonjob-parent', 'Restore the non-job pair and force only the parent out', 'Created fresh independent lifetimes without that job policy; parent alone terminated.'],
  verify: ['inspect-child', 'Give the child a turn and inspect its lifetime', 'Child executed after parent exit and retained its own resources.'],
})

export const levels12: Scene[] = [
  scene('l1-1', 'First Contact', 'PID',
    'Distinguish a program file from independent live process instances.',
    firstContact, firstTransfer, [
      { term: 'Program', explanation: 'A file containing instructions and data; it is not itself a running instance.', depth: 'Launching an image creates process resources and threads. Applications can choose a single-instance design; this fixture explicitly launches independent instances.' },
      { term: 'Process and PID', explanation: 'A process is a live execution container with its own identity and resources.', depth: 'A PID is unique among live processes, not a permanent identity across all time. Tools may need creation-time or lifetime context to disambiguate reuse.' },
    ], ['Count the live instances, not the files.', 'Launch twice and compare the two PIDs before closing one.', 'Pair the two-PID observation with the survivor; in transfer, pair exit with a new lifetime.'],
    [source('Processes and threads', 'windows/win32/procthread/about-processes-and-threads'),
      source('Process handles and identifiers', 'windows/win32/procthread/process-handles-and-identifiers')],
    'Browser-local snapshots, fictional PIDs and lifetime markers. Independent-instance launching is declared, not universal application behavior; immediate PID reuse is a deliberate transfer fixture.'),
  scene('l1-2', 'Who Does the Work?', 'CPU',
    'Explain how UI and worker threads share one logical CPU and how waiting differs from working.',
    threads, threadTransfer, [
      { term: 'Thread', explanation: 'A thread is a unit of execution inside a process.', depth: 'Threads have separate execution context and share process resources. Windows schedules threads rather than process containers.' },
      { term: 'Responsiveness', explanation: 'The UI must receive execution turns and return to handling input.', depth: 'A worker is not a guarantee: a UI thread that waits synchronously for it can still stop responding. One CPU permits alternating execution, not simultaneous execution of these threads.' },
    ], ['Watch whether the UI is busy, ready, or waiting.', 'Compare inline calculation with the worker route, then send input.', 'Use the input result and CPU trace; in transfer, the storage waiter never runs during its wait.'],
    [source('Processes and threads', 'windows/win32/procthread/about-processes-and-threads'),
      source('Thread scheduling', 'windows/win32/procthread/scheduling-priorities')],
    'One logical CPU, bounded units and chosen turns. Real scheduling order and latency vary; no priorities, affinity, or timing guarantees are modeled.'),
  scene('l1-3', 'A Private Address Book', 'VA',
    'Interpret a virtual address in its process context, then test separate mappings.',
    privateAddresses, addressTransfer, [
      { term: 'Virtual address', explanation: 'An address number is interpreted through an address-space map.', depth: 'Translation associates process virtual addresses with backing memory. Equal virtual numbers in different processes do not by themselves imply the same backing.' },
      { term: 'Private mapping', explanation: 'In this fixture A’s write changes A’s memory, not B’s.', depth: 'Windows also supports deliberately shared mappings; privacy here is declared. Mapping, protection, backing and residency are distinct topics explored later.' },
    ], ['Identify the process before interpreting 0x1000.', 'Write only in A, then read B without changing B.', 'Select the A-after-write and B-after-read snapshots. Transfer compares unmapped with mapped addresses in C.'],
    [source('Virtual address spaces', 'windows-hardware/drivers/gettingstarted/virtual-address-spaces')],
    'Tiny declared private maps, not real addresses or page tables. Invalid reads are controlled probe results, not live crashes. Sharing and copy-on-write belong to later memory scenes.'),
  scene('l1-4', 'Crossing the Boundary', 'MODE',
    'Follow a controlled service request without confusing privilege mode with process identity.',
    boundary, boundaryTransfer, [
      { term: 'User and kernel mode', explanation: 'Modes describe execution privilege, not separate application lifetimes.', depth: 'Applications normally execute in user mode. Controlled service entry runs OS code with kernel privileges; a return resumes application code in user mode.' },
      { term: 'System service', explanation: 'An application asks the OS to perform an operation and receives a checked result.', depth: 'This synchronous trace keeps the same caller PID/TID. Other request paths may involve additional threads; kernel-mode execution does not override the caller’s object permissions.' },
    ], ['Track PID, TID and mode separately.', 'Use the service route after the refused direct-access probe.', 'Pair the route with its result. In transfer, compare protected denial and public success through the same boundary.'],
    [source('User mode and kernel mode', 'windows-hardware/drivers/gettingstarted/user-mode-and-kernel-mode')],
    'A simplified synchronous service trace and prepared permission decisions. No host files, kernel execution, full access-check algorithm or unrestricted privileges are exposed.'),
  scene('l1-5', 'Inside the Machine', 'MAP',
    'Explain how scheduling, memory support, OS services and drivers collaborate on a selected request.',
    architecture, architectureTransfer, [
      { term: 'Architecture collaboration', explanation: 'Different components cooperate: execution turns are not the same as I/O service.', depth: 'The kernel supplies low-level scheduling and coordination; executive services include I/O and memory management. The HAL abstracts hardware details rather than replacing every driver.' },
      { term: 'Driver and device', explanation: 'A driver participates in the selected device request path.', depth: 'Drivers, I/O services and caches can cooperate on different paths. A cache hit need not issue new device I/O; this model is not a universal diagram for every read.' },
    ], ['Separate “thread got a turn” from “request was submitted.”', 'Submit a read and observe the component route before completing device work.', 'Use route and buffer evidence. Transfer’s cached data changes whether fresh device work is needed.'],
    [source('Windows kernel-mode components', 'windows-hardware/drivers/kernel/overview-of-windows-components'),
      source('File caching', 'windows/win32/fileio/file-caching')],
    'Selected synchronous device and cache routes, with no authentic IRPs, drivers or hardware. Component collaboration is conceptual and omits subsystem and return-path details.'),
  scene('l1-6', 'Explain the Workstation', 'DESK',
    'Integrate process ownership, thread turns, private memory and an OS service into a healthy-workstation explanation.',
    workstation, workstationTransfer, [
      { term: 'Healthy wait', explanation: 'A pending operation can leave one thread waiting while another handles input.', depth: 'Thread state alone does not prove a fault. Relate an observed wait to the declared operation and its eventual completion.' },
      { term: 'Connected foundations', explanation: 'A process owns resources, threads execute, and services perform checked OS work.', depth: 'Separate instances retain separate lifetimes and declared private buffers. On one logical CPU, UI and CPU-bound worker execution alternate rather than occur simultaneously.' },
    ], ['Check ownership and each thread’s state before blaming a fault.', 'Try the worker save, then give the UI a turn and complete the save.', 'Join the ownership/pending observation to the successful result; transfer also requires an independent survivor.'],
    [source('Processes and threads', 'windows/win32/procthread/about-processes-and-threads'),
      source('User mode and kernel mode', 'windows-hardware/drivers/gettingstarted/user-mode-and-kernel-mode')],
    'A healthy fictional application with declared private buffers, permitted saves and chosen scheduling turns. No real workstation diagnosis or live application observations are claimed.'),
  scene('l2-1', 'Birth of a Process', 'NEW',
    'Distinguish requested launch, successful creation, initial-thread readiness and execution.',
    creation, creationTransfer, [
      { term: 'Creation', explanation: 'Successful creation establishes a process and an initial thread.', depth: 'Windows creation involves image mapping and resource setup; later initial-thread execution includes user-mode loader/application initialization. The fixture compresses creation internals.' },
      { term: 'Suspended versus ready', explanation: 'A suspended thread exists but cannot execute until resumed.', depth: 'CREATE_SUSPENDED delays initial execution eligibility. Resuming makes the thread ready in this fixture; readiness alone is not proof of a CPU turn or completed initialization.' },
    ], ['Existence, eligibility and actual execution are different observations.', 'Use suspended creation, then resume without scheduling.', 'Pair created resources with readiness. Transfer’s missing-image failure must be repaired before any initialization turn.'],
    [source('Creating processes', 'windows/win32/procthread/creating-processes'),
      source('Process creation flags', 'windows/win32/procthread/process-creation-flags')],
    'Bounded creation snapshots, not a full loader implementation. Ready is shown before an explicit scheduling action; real scheduling can occur immediately. Missing-image failure is chosen to occur before child creation.'),
  scene('l2-2', 'Anatomy of a Process', 'REC',
    'Relate conceptual process resource ownership to prepared process and thread record views.',
    anatomy, anatomyTransfer, [
      { term: 'Process resource record', explanation: 'The process groups address-space and handle ownership.', depth: 'EPROCESS is an executive process structure. These curated labels introduce relationships only; fields and layouts depend on Windows build and architecture.' },
      { term: 'Thread resource relationship', explanation: 'The thread has execution state and a link to its owning process.', depth: 'ETHREAD is an executive thread structure. Threads use their process address space and process-relative handle table; identical local handle numbers in different tables can target different objects.' },
    ], ['Ask which record owns resources and which records describe execution.', 'Follow a thread’s owner link instead of inventing another process.', 'Pair process ownership with the thread link. Transfer requires resolving the local handle in each owner’s table.'],
    [source('Processes and threads', 'windows/win32/procthread/about-processes-and-threads'),
      source('Process handles and identifiers', 'windows/win32/procthread/process-handles-and-identifiers')],
    'Prepared synthetic EPROCESS/ETHREAD views, not authentic dumps, fixed offsets or debugger commands. Only conceptual ownership and selected local-handle relationships are modeled.'),
  scene('l2-3', 'Keeping Work Together', 'JOB',
    'Apply a configured active-process limit to actual job membership and test admission recovery.',
    jobs, jobTransfer, [
      { term: 'Job membership', explanation: 'A job groups associated processes; an unrelated outsider is not automatically a member.', depth: 'Processes may acquire job association through assignment or inheritance rules. This fixture explicitly declares membership and excludes automatic inherited associations.' },
      { term: 'Active-process limit', explanation: 'The selected limit bounds active member process count, not thread count.', depth: 'Assignment that exceeds this limit fails and terminates the attempted process. Its process handles must also close to release the transient exceeded-limit count. Jobs support other independent controls; kill-on-close is a separate policy.' },
    ], ['Count active members, not all workstation processes.', 'Try a third admission at limit two, let one member finish, and retry.', 'Pair the freed-slot snapshot with successful membership; transfer changes both the limit and explicit assignment.'],
    [source('Job objects', 'windows/win32/procthread/job-objects'),
      source('Job limit information', 'windows/win32/api/winnt/ns-winnt-jobobject_basic_limit_information')],
    'Only explicitly declared membership and one configured active-process limit are simulated. Failed over-limit assignment terminates its worker; all process handles close before further admission. Transient count timing, nested jobs, inheritance details, CPU limits and memory accounting are omitted.'),
  scene('l2-4', 'One Processor, Many Threads', 'TURN',
    'Distinguish ready, running and waiting, and separate wakeup from scheduling.',
    scheduling, schedulingTransfer, [
      { term: 'Ready, running, waiting', explanation: 'Ready is eligible, running is executing, waiting needs a condition satisfied.', depth: 'The teaching lanes compress Windows thread states. One logical CPU executes at most one of these modeled threads at an instant.' },
      { term: 'Context switch', explanation: 'Execution moves from one thread to another while preserving each thread’s context.', depth: 'Wait completion can make a thread ready without selecting it immediately. Real choices involve priorities, affinity and other policies omitted from the fixture.' },
    ], ['Find an eligible thread before selecting a CPU turn.', 'Try the waiter, then run a ready thread and complete the stated I/O wait.', 'Pair the first lanes with wakeup. Transfer first needs event E; only then can its waiter run.'],
    [source('Thread scheduling', 'windows/win32/procthread/scheduling-priorities'),
      source('Context switches', 'windows/win32/procthread/context-switches')],
    'One CPU, curated scheduling order and three teaching states. No Windows fairness, latency or priority guarantees are implied. Event and I/O completions are supplied actions, not real asynchronous host events.'),
  scene('l2-5', 'More Cores, Different Results', 'CORE',
    'Compare idealized multicore overlap for independent work with an unchanged serial dependency.',
    multicore, multicoreTransfer, [
      { term: 'Concurrency and parallelism', explanation: 'Concurrency allows overlapping lifetimes; parallelism executes distinct work at the same instant.', depth: 'Independent runnable threads can use separate logical processors. A logical processor is a scheduling slot; real physical cores and SMT need not provide identical throughput.' },
      { term: 'Dependency', explanation: 'A task needing a predecessor’s result cannot start early just because another CPU is free.', depth: 'The serial part of a workload bounds speedup. Work, elapsed time, scheduling overhead, storage waits and CPU topology all influence real results.' },
    ], ['Keep total work separate from elapsed time.', 'Compare two independent tasks on one and two CPU slots.', 'Select the parallel timeline and completion counters. In transfer, preserve B’s need for A’s result when comparing CPUs.'],
    [source('Multiple processors', 'windows/win32/procthread/multiple-processors')],
    'Ideal equal-throughput logical CPU slots, one unit per turn and no overhead, contention or SMT effects. Four- and eight-unit outcomes are model arithmetic, not real performance promises.'),
  scene('l2-6', 'A Clean Exit', 'EXIT',
    'Separate OS-managed process teardown from application finalization and explicit child-lifetime policies.',
    termination, terminationTransfer, [
      { term: 'Orderly and forced exit', explanation: 'An orderly application can finalize; a forced exit can skip that work.', depth: 'Both paths stop modeled threads and release address-space and process handle ownership. Closing a handle does not necessarily destroy the referenced object if other references remain; the process object may remain observable after execution ends.' },
      { term: 'Child lifetime', explanation: 'Creating a child does not universally require it to exit with its parent.', depth: 'Application behavior and job policies can tie lifetimes together. A job’s kill-on-close effect requires that policy and the last job handle closing, not merely the existence of a parent-child link.' },
    ], ['Separate saved output from counts of threads and process-owned resources.', 'Compare orderly exit with forced termination; use a fresh fixture to retry an irreversible exit.', 'Pair orderly output and teardown; transfer independently observes parent cleanup and a surviving non-job child.'],
    [source('Terminating a process', 'windows/win32/procthread/terminating-a-process'),
      source('Job objects', 'windows/win32/procthread/job-objects')],
    'Selected final snapshots omit asynchronous teardown timing and outstanding kernel references. The orderly save handler is application-specific; forced exit never promises it. Child survival and kill-on-close are explicitly separate fixtures.'),
]
