import type { SeverityReport } from '@citybrain/shared';

export type EscalationLevel = 'watch' | 'advisory' | 'operational' | 'critical';

export interface EscalationDecision {
  level: EscalationLevel;
  autoPlan: boolean;
  autoExecute: boolean;
  reason: string;
}

/**
 * Decision tree for autonomous escalation (energy-procurement style branching).
 */
export class EscalationEngine {
  decide(severity: SeverityReport, detectionConfidence: number): EscalationDecision {
    if (detectionConfidence < 0.65) {
      return {
        level: 'watch',
        autoPlan: false,
        autoExecute: false,
        reason: 'Insufficient signal confidence for autonomous response',
      };
    }

    switch (severity.level) {
      case 'low':
        return {
          level: 'watch',
          autoPlan: false,
          autoExecute: false,
          reason: 'Low severity — monitoring only',
        };
      case 'medium':
        return {
          level: 'advisory',
          autoPlan: false,
          autoExecute: false,
          reason: 'Medium severity — advisory mode',
        };
      case 'high':
        return {
          level: 'operational',
          autoPlan: true,
          autoExecute: true,
          reason: 'High severity — autonomous operational response',
        };
      case 'critical':
      default:
        return {
          level: 'critical',
          autoPlan: true,
          autoExecute: true,
          reason: 'Critical severity — full autonomous execution with replan allowed',
        };
    }
  }
}
