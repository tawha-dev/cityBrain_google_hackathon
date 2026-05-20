import type { CrisisRunState } from '@citybrain/shared';
import type { SixAgentName } from '../agents/agent.interface.js';

export interface ConfidenceBundle {
  detection: number;
  severity: number;
  plan: number;
  execution: number;
  outcome: number;
  overall: number;
}

export class ConfidenceScorer {
  computeDetection(state: CrisisRunState): number {
    const signals = state.normalizedSignals;
    if (signals.length === 0) return 0;
    const density = Math.min(1, signals.length / 4);
    const sources = new Set(signals.map((s) => s.source)).size;
    const diversity = sources / 4;
    const memoryBoost = state.candidate?.confidence ? 0.15 : 0;
    return Math.min(1, 0.35 * density + 0.25 * diversity + 0.25 * (state.candidate?.confidence ?? 0.5) + memoryBoost);
  }

  update(state: CrisisRunState, agent: SixAgentName, agentConfidence: number): ConfidenceBundle {
    const bundle: ConfidenceBundle = {
      detection: (state as CrisisRunState & { confidence?: ConfidenceBundle }).confidence?.detection ?? 0,
      severity: (state as CrisisRunState & { confidence?: ConfidenceBundle }).confidence?.severity ?? 0,
      plan: (state as CrisisRunState & { confidence?: ConfidenceBundle }).confidence?.plan ?? 0,
      execution: (state as CrisisRunState & { confidence?: ConfidenceBundle }).confidence?.execution ?? 0,
      outcome: (state as CrisisRunState & { confidence?: ConfidenceBundle }).confidence?.outcome ?? 0,
      overall: 0,
    };

    switch (agent) {
      case 'crisis_detection':
        bundle.detection = agentConfidence;
        break;
      case 'severity_reasoning':
        bundle.severity = agentConfidence;
        break;
      case 'planning':
        bundle.plan = agentConfidence;
        break;
      case 'execution':
        bundle.execution = agentConfidence;
        break;
      case 'reflection':
        bundle.outcome = agentConfidence;
        break;
    }

    bundle.overall =
      0.3 * bundle.detection +
      0.3 * bundle.severity +
      0.2 * bundle.plan +
      0.2 * (bundle.outcome || bundle.execution);

    return bundle;
  }
}
