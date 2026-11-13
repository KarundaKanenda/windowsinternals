export interface Check {
  prompt: string
  options: string[]
  correct: number
  explanation: string
}

export interface Evidence {
  id: string
  label: string
  value: string
  detail: string
}

export interface SceneAction {
  id: string
  label: string
  next: string
  log: string
}

export interface SceneNode {
  title: string
  description: string
  evidence: Evidence[]
  actions: SceneAction[]
  assess?: boolean
}

export interface Experiment {
  briefing: string
  prediction: Check
  initial: string
  nodes: Record<string, SceneNode>
  investigation: Check & { requiredEvidence: string[] }
}

export interface Scene {
  id: string
  level: number
  title: string
  objective: string
  icon: string
  guided: Experiment
  transfer: Experiment
  concepts: { term: string; explanation: string; depth: string }[]
  hints: string[]
  sources: { label: string; url: string }[]
  simplification: string
}
