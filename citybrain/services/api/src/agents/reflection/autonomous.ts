import type { CrisisRunState, SeverityReport } from '@citybrain/shared';
import type { AdaptiveDirective, ReflectionAnalysis } from '@citybrain/shared';
import { applySeverityEscalation } from './escalation.js';

export interface AutonomousAdjustmentResult {
  severityUpdated: boolean;
  directivesApplied: string[];
}

/**
 * Autonomously apply reflection directives to live pipeline state.
 */
export function applyAutonomousAdjustments(
  state: CrisisRunState,
  analysis: ReflectionAnalysis
): AutonomousAdjustmentResult {
  const applied: string[] = [];
  const escalateDirective = analysis.adaptiveDirectives.find(
    (d) => d.type === 'escalate_severity'
  );

  const escalation = applySeverityEscalation(
    state.severity?.level,
    state.severity?.escalationLevel,
    escalateDirective,
    analysis.unresolvedRisks
  );

  if (escalation.applied && state.severity) {
    state.severity = {
      ...state.severity,
      level: escalation.newSeverity,
      escalationLevel: escalation.newEscalation,
      rationale: `${state.severity.rationale} | Autonomous escalation: ${escalation.triggeredBy.join('; ')}`,
      factors: [
        ...state.severity.factors,
        'reflection_autonomous_escalation',
      ],
    };
    applied.push('escalate_severity');
  } else if (escalation.applied && !state.severity) {
    state.severity = buildSeverityFromEscalation(escalation, state);
    applied.push('escalate_severity');
  }

  state.replanRequired = analysis.replanRequired;

  const ext = state as CrisisRunState & {
    reflectionAnalysis?: ReflectionAnalysis;
    adaptiveDirectives?: AdaptiveDirective[];
  };
  ext.reflectionAnalysis = analysis;
  ext.adaptiveDirectives = analysis.adaptiveDirectives;

  for (const d of analysis.adaptiveDirectives) {
    if (d.type !== 'escalate_severity') {
      applied.push(d.type);
    }
  }

  return {
    severityUpdated: escalation.applied,
    directivesApplied: applied,
  };
}

function buildSeverityFromEscalation(
  escalation: ReturnType<typeof applySeverityEscalation>,
  state: CrisisRunState
): SeverityReport {
  return {
    level: escalation.newSeverity,
    escalationLevel: escalation.newEscalation,
    confidence: 0.85,
    rationale: 'Autonomous severity escalation from reflection agent',
    factors: ['reflection_escalation'],
    estimatedImpact: {
      strandedVehicles: state.candidate?.type === 'flood' ? 120 : 40,
      congestionIndex: 0.82,
      affectedPopulation: 15000,
    },
  };
}
