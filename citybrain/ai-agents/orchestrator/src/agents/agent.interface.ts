import type { CrisisRunState } from '@citybrain/shared';
import type { ToolContext } from '@citybrain/agent-tools';

export type SixAgentName =
  | 'signal_extraction'
  | 'crisis_detection'
  | 'severity_reasoning'
  | 'planning'
  | 'execution'
  | 'reflection';

export interface EvidenceRef {
  type: 'signal' | 'report' | 'memory' | 'weather' | 'traffic' | 'tool';
  id: string;
  excerpt: string;
}

export interface AgentContext {
  state: CrisisRunState;
  crisisId: string;
  correlationId: string;
  toolCtx: ToolContext;
  scenarioKey?: string;
}

export interface AgentResult {
  thought: string;
  cotSteps?: string[];
  evidenceRefs: EvidenceRef[];
  confidence: number;
  patch: Partial<CrisisRunState>;
  shouldAbort?: boolean;
}

export interface CityBrainAgent {
  readonly name: SixAgentName;
  readonly tools: readonly string[];
  run(ctx: AgentContext): Promise<AgentResult>;
}
