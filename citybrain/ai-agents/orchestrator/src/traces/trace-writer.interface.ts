import type { AgentResult, SixAgentName } from '../agents/agent.interface.js';
import type { CrisisRunState } from '@citybrain/shared';

export interface TraceWriter {
  writeStarted(state: CrisisRunState, agent: SixAgentName): Promise<void>;
  writeCompleted(state: CrisisRunState, agent: SixAgentName, result: AgentResult): Promise<void>;
  appendDomainEvent(
    crisisId: string,
    eventType: string,
    payload: Record<string, unknown>,
    correlationId: string
  ): Promise<void>;
}
