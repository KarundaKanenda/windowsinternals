export type Stage = 0 | 1 | 2 | 3 | 4 | 5

export interface SimulatedProcess {
  pid: number
  image: 'atlas-notes.exe'
}

export interface MissionState {
  stage: Stage
  processes: SimulatedProcess[]
  selectedPid: number | null
  nextPid: number
  events: string[]
  question: number
  feedback: string
}

export type Action =
  | { type: 'inspect-program' }
  | { type: 'launch' }
  | { type: 'inspect-process'; pid: number }
  | { type: 'close'; pid: number }
  | { type: 'answer'; choice: number }
  | { type: 'reset' }

export const questions = [
  {
    prompt: 'A different program, PhotoBatch.exe, supports independent instances. You start it twice. What has been created?',
    options: ['One process shared by both instances', 'Two processes using the same executable', 'Two new executable files on disk'],
    correct: 1,
    explanation: 'Each independent instance creates a process. The executable is the program on disk; launching it does not create another executable file.',
  },
  {
    prompt: 'One PhotoBatch instance exits normally. The other is still open. What remains?',
    options: ['The other process and the executable file', 'Only the executable file; both processes exit', 'The other process, but the executable is deleted'],
    correct: 0,
    explanation: 'Closing one independent instance ends its process, not its sibling. Process termination does not normally delete its executable file.',
  },
  {
    prompt: 'You want to identify one particular running instance. Which piece of information distinguishes it from another instance of the same program?',
    options: ['Its executable filename', 'The folder containing the executable', 'Its process ID (PID)'],
    correct: 2,
    explanation: 'The running instances share a filename and location, but have different PIDs. A PID identifies a process while it exists; Windows can reuse it after termination.',
  },
]

export function createMission(completed = false): MissionState {
  return {
    stage: completed ? 5 : 0,
    processes: [],
    selectedPid: null,
    nextPid: 4100,
    events: ['Workstation ready. Atlas Notes is installed; no instance is running.'],
    question: 0,
    feedback: '',
  }
}

function record(state: MissionState, event: string): string[] {
  return [event, ...state.events].slice(0, 8)
}

export function missionReducer(state: MissionState, action: Action): MissionState {
  switch (action.type) {
    case 'inspect-program':
      return {
        ...state,
        stage: state.stage === 0 ? 1 : state.stage,
        events: record(state, 'Inspected atlas-notes.exe. The executable exists on disk, independently of running instances.'),
      }
    case 'launch': {
      if (state.stage === 0 || state.processes.length >= 4) return state
      const process: SimulatedProcess = { pid: state.nextPid, image: 'atlas-notes.exe' }
      return {
        ...state,
        processes: [...state.processes, process],
        selectedPid: process.pid,
        nextPid: state.nextPid + 4,
        events: record(state, `Launched Atlas Notes. Created process ${process.pid} from the existing executable.`),
      }
    }
    case 'inspect-process': {
      if (!state.processes.some(p => p.pid === action.pid)) return state
      const stage = state.stage === 1 ? 2
        : state.stage === 2 && state.processes.length >= 2 ? 3 : state.stage
      return {
        ...state,
        selectedPid: action.pid,
        stage,
        events: record(state, `Inspected PID ${action.pid}. Running instance of atlas-notes.exe.`),
      }
    }
    case 'close': {
      if (!state.processes.some(p => p.pid === action.pid)) return state
      const processes = state.processes.filter(p => p.pid !== action.pid)
      return {
        ...state,
        processes,
        selectedPid: state.selectedPid === action.pid ? processes[0]?.pid ?? null : state.selectedPid,
        stage: state.stage === 3 && processes.length >= 1 ? 4 : state.stage,
        events: record(state, `PID ${action.pid} exited normally. The executable remains installed; ${processes.length} instance(s) remain.`),
      }
    }
    case 'answer': {
      if (state.stage !== 4) return state
      const question = questions[state.question]
      if (action.choice !== question.correct) {
        return { ...state, feedback: `Not quite. ${question.explanation}` }
      }
      const complete = state.question === questions.length - 1
      return {
        ...state,
        stage: complete ? 5 : 4,
        question: complete ? state.question : state.question + 1,
        feedback: complete ? '' : `Correct. ${question.explanation}`,
        events: complete ? record(state, 'Transfer challenge complete. Program, process, and PID concepts verified.') : state.events,
      }
    }
    case 'reset':
      return createMission()
  }
}
