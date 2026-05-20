import type { SeverityLevel, EscalationLevel } from '@citybrain/shared';
import type { AdaptiveDirective, UnresolvedRisk } from '@citybrain/shared';

const SEVERITY_ORDER: SeverityLevel[] = ['low', 'medium', 'high', 'critical'];
const ESCALATION_ORDER: EscalationLevel[] = ['watch', 'advisory', 'operational', 'critical'];

export interface EscalationResult {
  previousSeverity: SeverityLevel;
  newSeverity: SeverityLevel;
  previousEscalation: EscalationLevel;
  newEscalation: EscalationLevel;
  triggeredBy: string[];
  applied: boolean;
}

export function buildEscalationWorkflow(
  result: EscalationResult
): {
  fromLevel: string;
  toLevel: string;
  triggeredBy: string[];
  autoApproved: boolean;
} {
  return {
    fromLevel: result.previousEscalation,
    toLevel: result.newEscalation,
    triggeredBy: result.triggeredBy,
    autoApproved: result.applied,
  };
}

export function applySeverityEscalation(
  currentSeverity: SeverityLevel | undefined,
  currentEscalation: EscalationLevel | undefined,
  directive: AdaptiveDirective | undefined,
  risks: UnresolvedRisk[]
): EscalationResult {
  const prevSev = currentSeverity ?? 'high';
  const prevEsc = currentEscalation ?? 'operational';
  const triggeredBy: string[] = [];

  if (!directive || directive.type !== 'escalate_severity') {
    return {
      previousSeverity: prevSev,
      newSeverity: prevSev,
      previousEscalation: prevEsc,
      newEscalation: prevEsc,
      triggeredBy: [],
      applied: false,
    };
  }

  for (const r of risks.filter((x) => x.severity === 'critical')) {
    triggeredBy.push(`${r.category}: ${r.description.slice(0, 60)}`);
  }

  const bump = Number((directive.payload as { bumpLevels?: number })?.bumpLevels ?? 1);
  const targetEsc =
    ((directive.payload as { escalationTo?: EscalationLevel })?.escalationTo as EscalationLevel) ??
    'critical';

  const newSeverity = bumpSeverity(prevSev, bump);
  const newEscalation = maxEscalation(prevEsc, targetEsc);

  return {
    previousSeverity: prevSev,
    newSeverity,
    previousEscalation: prevEsc,
    newEscalation,
    triggeredBy: triggeredBy.length ? triggeredBy : [directive.rationale],
    applied: newSeverity !== prevSev || newEscalation !== prevEsc,
  };
}

function bumpSeverity(current: SeverityLevel, levels: number): SeverityLevel {
  const idx = SEVERITY_ORDER.indexOf(current);
  return SEVERITY_ORDER[Math.min(SEVERITY_ORDER.length - 1, idx + levels)];
}

function maxEscalation(a: EscalationLevel, b: EscalationLevel): EscalationLevel {
  return ESCALATION_ORDER.indexOf(b) > ESCALATION_ORDER.indexOf(a) ? b : a;
}
