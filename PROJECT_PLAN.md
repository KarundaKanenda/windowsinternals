# Inside the Machine: Windows Internals Learning Game

> Living product and learning plan. Update this file as we develop, validate, and
> revise the game. Keep implemented features separate from planned capabilities.

**Last updated:** 2026-11-13  
**Current milestone:** Playable five-level browser campaign and four capstones  
**Next milestone:** Learner feedback and separately validated advanced Windows labs

## 1. What we want to achieve

Build a structured, progressive Windows internals training game that takes a
learner from basic operating-system concepts to evidence-based investigation of
processes, threads, kernel coordination, memory, I/O, and security.

The learner should understand mechanisms, not just memorize terms, debugger
commands, or fixes. Simulations provide an accessible starting point; optional
Windows field labs connect the concepts to real observations and tools.

The project owner is also learning Windows internals. Our development process
must support that learning journey rather than assume expert knowledge upfront.

### End-to-end learner journey

1. Enter without prior Windows internals knowledge.
2. Learn one small concept through a guided visual model.
3. Predict behaviour before changing the model.
4. Experiment and observe consistent consequences.
5. Explain the mechanism using evidence.
6. Apply it to an unfamiliar scenario.
7. Optionally repeat a related exercise in an isolated Windows environment.
8. Complete an integrated investigation across the five levels.

### End-to-end product goal

- A playable browser campaign covering all five levels below.
- Clear prerequisites, learning objectives, and mastery checks for every mission.
- Consistent simulations with explicit simplifications and source references.
- Saved learner progress and a useful record of concepts mastered.
- Optional, reproducible Windows field labs with setup and recovery instructions.
- A capstone that tests investigation and verification, not guessed fixes.
- A maintainable content and simulation structure that supports future missions.

## 2. Agreed direction and working proposals

### Agreed direction

- Start with simulated missions.
- Build foundations before troubleshooting; do not begin with lock analysis.
- Organize the curriculum into five progressively deeper levels.
- Include advanced scenes that connect learning to practical Windows VM work.
- Design for a learner who is not yet a Windows internals expert.

### Working design

- Working title: **Inside the Machine**.
- Narrative: join a systems engineering team responsible for a training workstation.
- Reuse the workstation across chapters so earlier concepts become later evidence.
- Use the learning loop: discover, predict, experiment, investigate, field lab.
- Begin with manual field-lab instructions; consider VM automation later.
- Use competency gates rather than timers or points as the primary progression rule.

These proposals can change when learner feedback or technical validation warrants it.

## 3. Learning and game-design principles

### Understanding before terminology

Introduce only a few new concepts per mission. Reveal detailed terminology,
structures, and tools when the learner has a reason to use them.

### Interaction before quizzes

The main experience is manipulating and investigating a system. Questions check
understanding; they are not a substitute for experimentation.

### Prediction and explanation

Ask what will happen before an action, then compare the prediction with the result.
Completion should require a supported explanation, not only the correct button.

### Transfer, not repetition

Use a new application, workload, or evidence layout to check whether the learner
can apply the concept beyond the guided example.

### Helpful feedback

Identify the faulty assumption and explain the mechanism. Hints are progressive,
optional, and do not penalize the learner. A later independent challenge checks
understanding after guided help.

### Honest simulation

- Derive views, counters, and event logs from a consistent state model.
- Label teaching simplifications and distinguish them from real Windows behaviour.
- Never present browser simulation output as live operating-system evidence.
- Do not reward explanations that contradict the model or the source material.

### Accessible and approachable

Support keyboard use, readable layouts, small screens, and reduced motion. Use
text and diagrams together; do not rely on colour alone. No mandatory countdown.

## 4. Curriculum

Each level follows the learning loop and ends with an unfamiliar application or
investigation scenario. Optional field labs reinforce learning; lack of a suitable
VM must not prevent completion of the core browser campaign.

### Level 1: Meet the operating system

**Goal:** Explain applications, processes, threads, virtual address spaces,
system architecture, and user/kernel mode at a foundational level.

| Mission | Core concept | Intended activity |
| --- | --- | --- |
| First Contact | Program versus process; PID | Inspect an executable, launch independent instances, close one, explain a new scenario |
| Who Does the Work? | Threads and execution | Observe tasks executed by threads within a process |
| A Private Address Book | Virtual memory and isolation | Compare the same virtual address in different processes |
| Crossing the Boundary | User mode and kernel mode | Follow a request into OS services and back |
| Inside the Machine | Windows architecture | Assemble a map from already-introduced components |
| Explain the Workstation | Integrated foundations | Explain a healthy application's operation using evidence |

**Field lab:** Observe a supplied application using Task Manager and Process Explorer.

**Mastery gate:** Distinguish a program, process, thread, address space, and
operating-system request without relying on memorized definitions alone.

### Level 2: Processes, jobs, threads, and scheduling

**Goal:** Understand execution lifecycle, resource ownership, job objects,
thread scheduling, and multiprocessing.

| Mission | Core concept | Intended activity |
| --- | --- | --- |
| Birth of a Process | Creation and initialization | Step through image loading and initial thread creation |
| Anatomy of a Process | Records and data structures | Start with conceptual fields, then inspect prepared EPROCESS/ETHREAD evidence |
| Keeping Work Together | Job objects | Apply selected limits to a group of worker processes |
| One Processor, Many Threads | Scheduling and context switches | Compare ready, running, and waiting threads |
| More Cores, Different Results | Concurrency and parallelism | Change logical processor count and workload dependencies |
| A Clean Exit | Termination and cleanup | Compare orderly exit with forced termination |

**Field lab:** Run bounded child-process, job-limit, and CPU/wait demonstrations.

**Mastery gate:** Explain an unfamiliar workload's lifecycle and execution pattern.

**Accuracy constraints:** Windows schedules threads. Internal structure layouts
depend on build and architecture; do not teach fixed offsets as universal facts.

### Level 3: Kernel coordination, objects, and debugging

**Goal:** Understand kernel responsibilities, interrupts, exceptions, object
management, synchronization, and introductory debugging.

| Mission | Core concept | Intended activity |
| --- | --- | --- |
| Who Handles What? | Kernel and executive | Route work to the appropriate component |
| Something Happened | Interrupts and exceptions | Compare asynchronous notifications with execution-related events |
| Urgent Work, Deferred Work | IRQL and DPCs | Separate immediate handling from deferred work |
| Objects and Handles | References and lifetime | Open and close handles while observing object lifetime |
| Sharing Safely | Synchronization and races | Investigate shared access and apply appropriate coordination |
| The Frozen Application | Waits and deadlocks | Inspect thread evidence and identify a lock cycle |

**Field lab:** Inspect controlled user-mode race/deadlock examples and dumps with
WinDbg. Begin kernel exercises with prepared evidence before live debugging.

**Mastery gate:** Distinguish race, deadlock, exception, and interrupt; support a
diagnosis with evidence and verify the proposed intervention.

**Accuracy constraints:** IRQL, thread priority, and privilege mode are different
concepts. A fix for one lock-order cycle is not a universal deadlock solution.

### Level 4: Memory management

**Goal:** Reason about reservation, commitment, residency, protection, translation,
sharing, and memory use in user and kernel modes.

| Mission | Core concept | Intended activity |
| --- | --- | --- |
| Reserve, Commit, Touch | Allocation stages | Compare address reservation, commitment, and page access |
| Translate This Address | Page tables and TLB | Walk an explicitly simplified translation model |
| The Page Was Not Here | Page faults | Resolve cases with and without storage access |
| Permission to Access | Protection | Test controlled reads, writes, and execution permissions |
| Shared Without Being Identical | Sharing and copy-on-write | Observe shared backing and private changes |
| Memory Under Pressure | Commitment and working sets | Investigate a bounded workload without assuming every increase is a leak |
| Memory in Kernel Mode | Paged/nonpaged pool | Relate allocation requirements to execution constraints |

**Field lab:** Use a bounded allocation helper with VMMap and read-only RAMMap
observations.

**Mastery gate:** Explain commitment versus residency and investigate a new
memory-pressure scenario.

**Accuracy constraints:** A page fault is not necessarily an error or a page-file
read. Address-space availability is not the same as available physical RAM.

### Level 5: Windows I/O and security

**Goal:** Follow requests through the I/O system and reason about identity,
access decisions, boot trust, and isolated security protections.

#### Track A: I/O

| Mission | Core concept | Intended activity |
| --- | --- | --- |
| From Application to Device | I/O manager and drivers | Follow a request through a simplified driver stack |
| The Request Packet | IRPs | Inspect operation data and stack locations |
| Pending Is Not Failed | Asynchronous work | Track a pending request through completion |
| The Return Journey | Completion processing | Follow status and ownership through the stack |
| Cancellation and Failure | Request lifetime | Investigate controlled cancellation and error paths |

#### Track B: Security

| Mission | Core concept | Intended activity |
| --- | --- | --- |
| Identity of the Caller | Tokens | Identify the effective security context |
| The Access Decision | Security descriptors and permissions | Explain a requested-access decision |
| Least Privilege | Appropriate rights | Resolve an access problem without excessive grants |
| Trust at Startup | Secure Boot | Explore a simplified verified boot chain |
| Protecting Beyond the Normal Kernel | VBS and memory integrity | Identify the protected boundary and its purpose |
| A Secure Service | Integrated security | Preserve intended access while protecting a lab object |

**Field labs:** Observe file activity with Process Monitor, inspect tokens, and
verify permissions on dedicated lab objects. Initially inspect Secure Boot/VBS
status rather than changing protection settings.

**Mastery gate:** Explain an I/O outcome and an access decision using evidence.

**Accuracy constraints:** IRP means I/O request packet. Actual IRP processing
belongs to drivers; not all I/O follows one identical IRP path. Secure Boot and
VBS are not interchangeable.

## 5. Capstone: The workstation is unreliable

A supplied service processes queued files using child processes, threads, memory,
I/O, and protected output.

Provide several scenario variants, not every fault at once. Examples include
waiting workers, retained allocations, storage delays, and legitimate access denial.

The learner must:

1. Describe the symptom and choose appropriate evidence.
2. Form and test a hypothesis.
3. Explain the responsible mechanism.
4. Apply a justified, bounded intervention.
5. Verify recovery and check for unintended consequences.

Restoring service temporarily is not enough if the underlying cause remains.

## 6. Mission specification and acceptance criteria

Before implementing a mission, define:

- Prerequisites and a small, explicit learning objective.
- New terms and concepts deliberately deferred to later missions.
- Opening state and the scenario's rules.
- Available actions and how they change the simulation.
- Observable evidence, including what it cannot establish.
- At least one prediction exercise.
- Guided experiment and unfamiliar transfer challenge.
- Incorrect hypotheses and useful feedback.
- Progressive hints.
- Completion conditions and replay/reset behaviour.
- Sources, Windows build/architecture assumptions, and labelled simplifications.
- Optional field lab, when appropriate.

A mission is ready when its state transitions and evidence agree, its checks
measure the stated objective, its UI is accessible, and a learner can explain
the mechanism after completing it. Advanced Windows claims require additional
technical review before being presented as authoritative.

## 7. Technical direction

### Current implementation

- React and TypeScript browser application built with Vite.
- 36 playable scenes across five levels, plus four workstation-rescue variants.
- Shared typed scenario graphs and pure assessment reducer.
- Prediction, contrasting experiments, evidence selection, mechanism checks,
  and changed-condition transfer for every scene.
- Progressive hints, optional depth, source references, explicit model limits,
  and a mastery notebook.
- Sequential core prerequisites and independent capstones after core mastery.
- Versioned browser-local mastery with legacy First Contact migration, visible
  storage failures, preserved corrupt records, and retryable saves.
- Original First Contact free-launch sandbox retained as optional practice.
- Separate advanced Windows scene previews; no automatic VM creation.
- Vitest model/content/journey tests, production/type build, and Oxlint.

Transient workstation state is not currently persisted. There is no account
system, automated VM provisioning, or live Windows inspection.

### Planned evolution

- Refine guided explanation and interaction using actual learner feedback.
- Expand the architecture-map presentation as the learner's mental model grows.
- Add genuine, build-specific evidence only after Windows validation.
- Consider progress export or synchronization only if learners need it.
- Keep Windows helpers and VM integration separate from the browser simulation.

Do not implement a full Windows emulator. Model only what a mission needs and
clearly state the boundaries.

## 8. Windows field-lab strategy

### First stage: manual and reproducible

Each lab specifies a tested Windows build and architecture, tools, known starting
state, bounded actions, expected observations, evidence submission, and cleanup.

Use an authorized Windows environment with appropriate licensing. Prefer
disposable VMs and recovery checkpoints for exercises that change system state.
Do not alter the learner's everyday machine to demonstrate kernel failures.

### Later stage: optional automation

A separate launcher may provision or connect to supported environments after
the manual labs are reliable. A browser alone cannot manage arbitrary local VMs.

Prepared evidence remains an alternative where hardware, licensing, architecture,
or nested virtualization prevents a practical lab. Linux/macOS browser support
does not imply support for every Windows VM configuration.

### Safety boundaries

- Read-only observation first.
- Bounded workloads; no uncontrolled resource exhaustion.
- No experiments on production systems or unfamiliar system processes.
- No disabling host protections as a prerequisite.
- Kernel debugging and real driver development are advanced, isolated extensions.

## 9. Delivery milestones

### Milestone 0: First Contact prototype

- [x] Create the project in `~/windowsinternals`.
- [x] Establish a browser application and responsive workspace.
- [x] Include the five-level curriculum roadmap.
- [x] Implement executable discovery and independent process instances.
- [x] Implement selected-instance inspection and normal exit.
- [x] Add concept explanations, hints, and an observation log.
- [x] Add a transfer challenge and saved completion.
- [x] Include a manual Windows observation guide.
- [x] Check model behaviour, browser walkthrough, reload persistence, and mobile layout.
- [x] Create this living plan.
- [ ] Review the prototype with the project owner and record learning feedback.

### Milestone 1: Complete Level 1

- [x] Refine First Contact with an explicit pre-action prediction step.
- [x] Specify and implement Who Does the Work?
- [x] Specify and implement A Private Address Book.
- [x] Specify and implement Crossing the Boundary.
- [x] Specify and implement Inside the Machine.
- [x] Implement the Level 1 mastery investigation.
- [x] Add prerequisites and saved multi-mission progression.
- [ ] Validate the Level 1 Windows field lab on a documented environment.
- [ ] Review learner comprehension and technical accuracy before deeper chapters.

### Milestone 2: Execution and coordination

- [x] Complete Level 2 browser process/job/scheduling missions.
- [ ] Validate Level 2 Windows field labs.
- [x] Introduce labelled synthetic structure evidence without requiring fixed offsets.
- [ ] Validate genuine build-specific Windows structure evidence.
- [x] Complete Level 3 browser objects/events/synchronization missions.
- [ ] Add progressive debugging and controlled user-mode dump labs.

### Milestone 3: Memory, I/O, and security

- [x] Complete Level 4 browser missions.
- [ ] Validate bounded Windows memory labs.
- [x] Complete Level 5 browser I/O and security tracks.
- [x] Label prepared teaching evidence and separate advanced platform requirements.
- [ ] Supply validated advanced Windows evidence and exact environment prerequisites.

### Milestone 4: End-to-end campaign

- [x] Implement four capstone variants and evidence-based completion criteria.
- [x] Validate progression, replay, persistence, keyboard navigation, and responsive browser layouts.
- [ ] Validate with actual assistive technology and learner feedback.
- [ ] Review mission accuracy and test transfer to unfamiliar scenarios.
- [ ] Document at least one supported practical lab environment per applicable chapter.
- [ ] Keep an evidence-based alternative for platform-constrained learners.

### Milestone 5: Optional VM integration

- [ ] Select supported host/guest configurations based on actual learner needs.
- [ ] Define launcher permissions, isolation, recovery, and data handling.
- [ ] Automate only previously validated manual labs.
- [ ] Evaluate isolated live kernel debugging and driver-development extensions.

## 10. Validation and scope boundaries

### Validation

- Model tests for transitions, constraints, and evidence consistency.
- Build/type and lint checks for code changes.
- Browser walkthroughs for mission progression, incorrect answers, reset, and persistence.
- Accessibility and responsive-layout checks.
- Concept checks using unfamiliar scenarios, not only the guided example.
- Windows field-lab verification on documented builds.
- Technical review of deeper mechanisms and explicit records of simplifications.

### Not required for the first release

- Full operating-system emulation.
- Real-time inspection of the host's processes or memory.
- Multiplayer, leaderboards, or time-based scoring.
- Accounts, cloud hosting, or paid infrastructure.
- An AI tutor or unrestricted automatic grading of explanations.
- Arbitrary VM provisioning, real driver development, or live kernel debugging.

Reconsider these only when they support validated learning needs.

## 11. Decisions still open

- How much guided explanation learners need before independent investigation.
- Structured evidence selection plus mechanism choices assess explanations;
  broader free-form assessment remains deferred.
- Which Windows builds, architectures, and VM hosts practical labs will support.
- Whether future progress should remain local or support export/synchronization.
- When additional technical reviewers are needed for advanced content.
- How much narrative and visual polish improves learning rather than distracting.

Record decisions here when made; do not treat unresolved proposals as requirements.

## 12. How to maintain this file

- Update the date and current/next milestone after meaningful changes.
- Check off work only when implemented and verified.
- Revise curriculum objectives when learner feedback reveals missing prerequisites.
- Record material scope changes and decisions in the log below.
- Keep product goals here; keep technical truth in the code and tests.
- Do not record credentials, personal learner data, or confidential system evidence.

### Progress and decision log

| Date | Change | Status / implication |
| --- | --- | --- |
| 2026-11-13 | Established the five-level learning campaign | Foundations precede analysis; practical labs follow simulations |
| 2026-11-13 | Built First Contact prototype | Only this mission is playable; the rest is a visible roadmap |
| 2026-11-13 | Added this living plan | End-to-end goals, acceptance criteria, milestones, and open decisions recorded |
| 2026-11-13 | Approved browser campaign design after parallel scenario brainstorming | Shared runner; 36 scenes plus four capstones; VM work remains optional advanced scope |
| 2026-11-13 | Implemented and independently reviewed all browser scene groups | Prediction, experiment, evidence-backed explanation, and changed-condition transfer in every scene |
| 2026-11-13 | Executed all 40 scene journeys in the browser and verified reload mastery | Keyboard return, reset, notebook, and 390px responsive checks; Windows labs and actual learner/assistive-technology validation remain deferred |
| 2026-11-13 | Added optional five-minute Level 1 video pilot | AI-authored diagram presentation with local synthetic narration, English captions, chapter seeking, transcript, and speed controls; never gates mastery |

## 13. Technical reference anchors

Attach more specific sources to individual missions as they are authored.

- [Processes and threads](https://learn.microsoft.com/en-us/windows/win32/procthread/about-processes-and-threads)
- [Kernel-mode architecture](https://learn.microsoft.com/en-us/windows-hardware/drivers/kernel/)
- [Process and thread manager](https://learn.microsoft.com/en-us/windows-hardware/drivers/kernel/windows-kernel-mode-process-and-thread-manager)
- [Virtual address spaces](https://learn.microsoft.com/en-us/windows-hardware/drivers/gettingstarted/virtual-address-spaces)
- [Virtualization-based security](https://learn.microsoft.com/en-us/windows-hardware/design/device-experiences/oem-vbs)

## 14. Browser campaign delivery design — approved

### Intent and scope

Deliver all 36 curriculum scenes as a connected, self-paced workstation-rescue
game. A beginner predicts, manipulates a small model, observes consequences,
explains them using evidence, and applies the concept to a changed scenario.
Keep concise explanations up front and optional deeper explanations alongside
explicit simulation limitations and Microsoft reference links.

VM creation, real host inspection, driver execution, and live kernel debugging
remain optional advanced scenes. They never block browser completion. No
accounts, extra infrastructure, timers, leaderboard, or new dependencies.

### Approaches

1. Independent bespoke games: richest individual interaction, but duplicates
   progression, assessment, persistence, and accessibility across 36 scenes.
2. Shared scenario engine with mission-specific state and evidence: consistent
   learning loop, meaningful branches, reusable UI, and independently authored
   content. Recommended implementation choice.
3. Quiz-only campaign: fastest, but rejected because it does not let learners
   experiment or verify mechanisms.

Keep React, TypeScript, Vite, Vitest, and Oxlint. Preserve First Contact's
existing process model; add its missing explicit prediction. Use declarative,
bounded scenario transitions for the other missions rather than a Windows
emulator. Evidence must be a view of scenario state, not unrelated decoration.

### Learning scenarios

| Level | Connected experiments |
| --- | --- |
| 1 | Independent app instances; UI/worker execution; private address maps; user/kernel request trace; architecture routing; healthy-workstation evidence investigation |
| 2 | Creation versus readiness; process/thread ownership; job membership and limits; ready/running/waiting lanes; independent versus dependent multicore work; orderly versus forced exit |
| 3 | Component dispatch; interrupts versus exceptions; ISR/DPC/worker stages with separate IRQL/mode/priority labels; handles and retained references; lost-update interleavings; lock-cycle versus legitimate wait investigation |
| 4 | Reserve/commit/touch counters; toy translation and TLB; soft/hard/invalid faults; R/W/X protection; copy-on-write versus writable sharing; commitment versus residency pressure; paged/nonpaged execution requirements |
| 5 | Selected driver request route; packet parameters; pending versus final completion; return-path ownership; cancellation races; effective token; declared ACL subset; narrow permission repair; verified boot fixtures; VBS versus memory integrity; secure-service positive and negative probes |

Add four bounded capstone variants: waiting workers, retained allocations,
storage delay, and legitimate access denial. Each presents one root cause,
requires selected evidence and a causal explanation, and verifies a bounded
intervention without introducing a second problem.

### Mission contract

Each authored mission contains a stable ID, level, prerequisite, briefing,
objective, initial evidence state, actionable transitions, pre-action
prediction, progressive hints, concept explanation, reference links, explicit
simplifications, and an unfamiliar transfer assessment.

A shared runner keeps prediction, experiment, evidence-backed explanation,
transfer, and completion separate. Wrong answers give mechanism-specific
feedback, with retries and no score penalty. Experiments allow contrasting
outcomes; completion requires the specified observations, not clicking every
button. Transfer changes a meaningful condition, not only application names.

Use native keyboard-accessible controls, readable state cards/timelines,
responsive layouts, and reduced-motion support. Celebrate verified concepts
with chapter completion and a growing mastery notebook, not arbitrary points.

### Progress and advanced scenes

Persist versioned mission completion locally. Preserve the existing First
Contact completion record through migration. Reset clears practice only;
mastery remains. Prerequisites unlock sequentially; completed scenes are
replayable. Invalid or unavailable storage produces a visible notice, not
silent loss. Optional advanced Windows labs appear separately and explicitly
remain unvalidated until checked on a documented Windows environment.

### Independent implementation ownership

- Shared typed scenario engine, model tests, and mission runner.
- Level 1–2 authored content and content-specific tests.
- Level 3–4 authored content and content-specific tests.
- Level 5 and capstone authored content and content-specific tests.
- Campaign integration, persistence/migration, progression, and visual polish.

Agents brainstormed these scenario groups independently. Implementers must
share a fixed content contract and edit disjoint files. An independent final
review checks integration and technical claims; model tests, type/build,
lint, and browser walkthroughs verify the delivered campaign.

Builder-review decisions: scope is 36 missions plus four capstone variants.
Use one ordered prerequisite chain across chapters; locked briefings remain
inspectable and completed scenes replayable. All capstones unlock after the
36 core missions, and campaign completion includes all four variants.
Grade structured evidence selection and mechanism choices, not arbitrary
prose. Grandfather legacy First Contact mastery without relocking it; its
replay includes the new prediction and changed-condition transfer.
For legitimate-denial recovery, authorized delivery must succeed while
unauthorized work remains denied. Freeze the typed content/state/action
contract before implementation agents edit their separate content files.

### Acceptance and deferred work

Acceptance requires every listed core mission to open and complete without
a VM, meaningful prediction and experiment gates, evidence-consistent state,
unfamiliar transfer, replay, migrated saved progress, and keyboard/mobile use.
Verify complete curriculum coverage and representative branch failures in
automated tests; exercise unlocks and reload persistence in the browser.

Do not label practical labs validated, deeper claims authoritative, or learner
comprehension established merely because automated checks pass. Windows lab
validation and real learner feedback remain separate follow-up milestones.

## 15. Browser Campaign Implementation Plan

> For agentic workers: use subagent-driven development with disjoint file
> ownership, as explicitly requested by the project owner.

**Goal:** Deliver 36 browser missions and four capstones with saved mastery.
**Architecture:** Typed, deterministic scene graphs provide bounded model
states and derived evidence. A shared runner enforces prediction, experiment,
evidence selection, explanation, and transfer; existing First Contact remains
available as a richer practice sandbox alongside its new assessment.
**Tech stack:** Existing React/TypeScript/Vite/Vitest/Oxlint; no new dependencies.
**Spec:** Section 14 of this file, approved by the project owner.

### Global constraints

- All core missions must be completable without VM creation.
- Only browser-local fictional state; advanced Windows labs remain optional.
- No mandatory timer or penalty for predictions and retries.
- Evidence and action outcomes must agree with each scenario's bounded state.
- Preserve legacy First Contact mastery and replay without erasing mastery.
- Parallel agents edit only their assigned files; no commits or repo creation
  because this project directory is not a Git repository.

### Review focus

- Malformed, unavailable, and legacy storage: visible errors and safe migration.
- Premature completion: prediction, observations, evidence, and transfer gate it.
- Branch detours: learners can recover; no unreachable required observations.
- Cross-level unlocks and replay: only mastery changes prerequisites.
- Technical simplifications: distinguish model fixtures from live Windows data.

### Task 1: Shared scene runner

Files: `src/scenes/types.ts`, `src/sceneEngine.ts`,
`src/sceneEngine.test.ts`, `src/ScenePlayer.tsx`, `src/ScenePlayer.css`.
Consumes `Scene` and `Experiment` from the fixed content contract. Produces
`ScenePlayer({ scene, mastered, onComplete, onExit })` and pure engine exports.

- [x] Write and run failing model tests for blocked early actions, incorrect
  explanation/evidence, transfer gates, branch recovery, and reset.
- [x] Implement pure transitions with full observed-evidence history and
  explicit rejection feedback; render current state cards and selectable evidence.
- [x] Build responsive keyboard-accessible runner with hints, optional depth, source
  links, mastery celebration, and native keyboard controls.
- [x] Run targeted model tests, then independent scoped review.

### Task 2: Foundations and execution scenarios

Files: `src/scenes/levels12.ts`, `src/scenes/levels12.test.ts`.
Produces `levels12: Scene[]`, ordered Level 1 then Level 2.

- [x] Author tests for independent-instance outcomes, thread waiting, private
  mappings, job limits, multicore dependencies, and termination branches.
- [x] Implement all 12 scenes with guided and changed-condition transfer graphs.
- [x] Verify every required evidence ID is reachable; inspect accurate limits.
- [x] Run targeted tests and independent scoped review.

### Task 3: Kernel and memory scenarios

Files: `src/scenes/levels34.ts`, `src/scenes/levels34.test.ts`.
Produces `levels34: Scene[]`, ordered Level 3 then Level 4.

- [x] Author tests for reference lifetime, lock cycles, IRQL constraints,
  commitment/residency, fault sources, and COW isolation.
- [x] Implement all 13 guided and transfer scenes with consistent snapshots.
- [x] Verify reachability, branching and stated Windows simplifications.
- [x] Run targeted tests and independent scoped review.

### Task 4: I/O, security, and capstones

Files: `src/scenes/level5.ts`, `src/scenes/level5.test.ts`.
Produces `level5: Scene[]` (11 scenes), `capstones: Scene[]` (four, level 6).

- [x] Author tests for pending/completed outcomes, cancellation races, token
  context, least privilege probes, and Secure Boot/VBS distinctions.
- [x] Implement all scenes and standalone one-fault capstone fixtures.
- [x] Verify recovery includes intended delivery plus negative security probes.
- [x] Run targeted tests and independent scoped review.

### Task 5: Campaign and persistence integration

Files: `src/App.tsx`, `src/App.css`, `src/progress.ts`,
`src/progress.test.ts`, `src/scenes/index.ts`, `src/scenes/campaign.test.ts`,
`README.md`, this project plan.

- [x] Write failing tests for migration, invalid storage, sequential unlocks,
  completion deduplication, and full guided/transfer graph reachability.
- [x] Implement typed progress reads/writes and campaign navigation; expose
  all mission briefings, unlocks, capstones, mastery counts, and legacy sandbox.
- [x] Run test suite, build/type check, lint; perform browser progression,
  wrong-answer/recovery, reload, keyboard, and mobile walkthrough.
- [x] Resolve independent final review findings and record actual delivery,
  keeping unvalidated Windows labs and learner feedback explicitly deferred.

## 16. Optional introductory videos

**Approved direction:** Start with a Level 1 pilot before producing the other
four chapter briefings. Each video introduces the chapter's problem, central
mental model, experiments, and learning outcomes in an approachable
presentational format. It supports rather than replaces interactive learning.

The Level 1 pilot is a five-minute, 720p narrated presentation. Its script and
original diagrams are AI-authored; frames are locally rendered, and speech is
synthesized locally with Piper's `en_US-ljspeech-medium` voice from the
public-domain LJ Speech dataset. The model repository declares MIT licensing;
source links and the model hash accompany the published assets. The original
macOS System Voice recording was replaced before public distribution.
It is not cinematic generative
footage, a human presenter recording, or live Windows evidence. No paid or
external video-generation service is used.

The portal exposes an optional player on the Level 1 overview with native
controls, English WebVTT captions, speed selection, chapter seeking, a
transcript, and explicit loading-error feedback. It does not autoplay or alter
prerequisites, mastery, or saved progress.

`src/briefing/level1.json` is the source for presentation content, narration,
transcript, and chapter times. `scripts/video/render.py` creates MP4/poster/
captions/transcript/production assets under `public/media/level-1`. Captions
follow measured speech segments; no narration is silently truncated.

The remaining four videos, a shorter highlight edition, actual learner
feedback, assistive-technology trials, and any externally generated presenter
or cinematic version remain deferred. Voice/media licensing must be checked
before public or commercial distribution.

Pilot validation: the full MP4 decoded as 300 seconds of H.264/AAC with audible
narration and 36 caption cues. Browser checks covered real playback, pause,
chapter seeking without autoplay, custom/native speed synchronization,
captions, transcript, keyboard close/focus, and 390px layout. Blocking either
the video or captions produced explicit fallback notices; leaving the overview
paused playback and did not change mastery. Independent review and existing
test/build/lint checks completed.

## 17. Linux container deployment

The requested public Docker Hub image is `karunda/windowsinternals:latest`,
targeting `linux/amd64`. A native Node build stage compiles the portal; an
unprivileged Nginx runtime serves the campaign and pre-rendered video on 8080.
No Windows guest, database, or speech model is required in the runtime image.

The allow-listed context excludes local dependencies, environments, secrets,
and unrelated artifacts. Deployment supports a read-only filesystem with a
temporary `/tmp`, a health endpoint, SPA navigation, caption MIME types, and
MP4 range requests. Missing asset and media requests return 404.

Public publication follows local container and browser verification. Player
mastery remains browser-local and independent of container replacement.

Published to Docker Hub and pulled back successfully:
`karunda/windowsinternals@sha256:78579b800f994c734376660b2f4cdfad1833a98d1d4c2e1e217ffe11e1bbb5ca`.
The remote runtime manifest is Linux AMD64. Verification covered the production
build, 181 application tests, lint, five renderer tests including real Piper
synthesis, full five-minute media decoding, and a healthy non-root container
with a read-only filesystem. HTTP checks confirmed exact media bytes, range
seeking, caption MIME, SPA fallback, cache behavior, and missing-file 404s.
Browser checks covered narration playback, pause, chapter seeking, 36 caption
cues, mobile layout, and a prediction/model-action journey without premature
mastery. The temporary verification container was removed.
