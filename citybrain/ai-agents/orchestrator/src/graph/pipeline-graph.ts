import type { CrisisRunState } from '@citybrain/shared';
import type { SixAgentName } from '../agents/agent.interface.js';

export interface GraphNode {
  name: SixAgentName;
}

export interface PipelineGraph {
  nodes: GraphNode[];
  shouldRun(node: GraphNode, state: CrisisRunState): boolean;
  isTerminalEarly(node: GraphNode, state: CrisisRunState): boolean;
}

const SIX_AGENT_ORDER: SixAgentName[] = [
  'signal_extraction',
  'crisis_detection',
  'severity_reasoning',
  'planning',
  'execution',
  'reflection',
];

const DETECTION_THRESHOLD = 0.65;

export function buildSixAgentGraph(): PipelineGraph {
  const nodes = SIX_AGENT_ORDER.map((name) => ({ name }));

  return {
    nodes,
    shouldRun(node, state) {
      if (state.stepCount >= state.maxSteps) return false;
      if (node.name === 'severity_reasoning' || node.name === 'planning' || node.name === 'execution') {
        const c = state.candidate?.confidence ?? 0;
        if (c < DETECTION_THRESHOLD) return false;
      }
      if (node.name === 'planning' || node.name === 'execution') {
        const esc = state.severity?.escalationLevel;
        if (esc === 'watch' || esc === 'advisory') return false;
      }
      return true;
    },
    isTerminalEarly(node, state) {
      return node.name === 'crisis_detection' && !state.candidate;
    },
  };
}
