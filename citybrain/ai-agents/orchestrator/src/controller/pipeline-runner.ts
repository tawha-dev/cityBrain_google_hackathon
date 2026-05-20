/**
 * Six-agent pipeline controller.
 * Production implementation: services/api/src/orchestrator/graph.ts
 * This module defines the target architecture; wire to API via import or gradual migration.
 */
import { v4 as uuid } from 'uuid';
import type { CrisisRunState, Signal } from '@citybrain/shared';
import { buildSixAgentGraph } from '../graph/pipeline-graph.js';
import { ConfidenceScorer } from '../confidence/confidence-scorer.js';
import { ReplanController } from './replan-controller.js';
import type { SixAgentName } from '../agents/agent.interface.js';

export interface PipelineInput {
  crisisId: string;
  rawSignals: Signal[];
  scenarioKey?: string;
  planVersion?: number;
}

export interface PipelineCallbacks {
  onAgentStep: (payload: {
    agent: SixAgentName;
    status: 'started' | 'completed';
    thought?: string;
    output?: unknown;
    latencyMs?: number;
  }) => Promise<void>;
}

/**
 * Entry point for orchestration layer.
 * Delegates to runtime graph in services/api until full migration.
 */
export async function runPipeline(
  input: PipelineInput,
  callbacks: PipelineCallbacks
): Promise<CrisisRunState> {
  const { runPipeline: runtimeRun } = await import(
    '../../../../services/api/src/orchestrator/graph.js'
  );

  return runtimeRun(
    {
      rawSignals: input.rawSignals,
      scenarioKey: input.scenarioKey,
      crisisId: input.crisisId,
      planVersion: input.planVersion,
    },
    input.crisisId,
    {
      onAgentStep: callbacks.onAgentStep as PipelineCallbacks['onAgentStep'] & {
        agent: string;
      },
    }
  );
}

export function initPipelineState(input: PipelineInput): CrisisRunState {
  return {
    runId: uuid(),
    crisisId: input.crisisId,
    scenarioKey: input.scenarioKey,
    stepCount: 0,
    maxSteps: 24,
    rawSignals: input.rawSignals,
    normalizedSignals: [],
    replanRequired: false,
    planVersion: input.planVersion ?? 1,
  };
}

export { buildSixAgentGraph, ConfidenceScorer, ReplanController };
