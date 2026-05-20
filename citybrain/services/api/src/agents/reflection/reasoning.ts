import type { ReflectionReasoningStep } from '@citybrain/shared';
import type { EffectivenessMetrics } from './effectiveness.js';
import type { UnresolvedRisk, FailedMitigation, AdaptiveDirective } from '@citybrain/shared';

export interface ReflectionCoTContext {
  metrics: EffectivenessMetrics;
  risks: UnresolvedRisk[];
  failedMitigations: FailedMitigation[];
  directives: AdaptiveDirective[];
  replanRequired: boolean;
  isReplanPass: boolean;
}

export function buildReflectionCoT(ctx: ReflectionCoTContext): ReflectionReasoningStep[] {
  return [
    {
      step: 1,
      title: 'Compare metrics',
      analysis: `Before congestion ~${ctx.metrics.beforeCongestion.toFixed(2)}, after ~${ctx.metrics.afterCongestion.toFixed(2)}. Outcome score ${ctx.metrics.outcomeScore}.`,
      evidence: [
        `Congestion reduction ${(ctx.metrics.congestionReduction * 100).toFixed(0)}%`,
        `Stranded reduction ${(ctx.metrics.strandedReduction * 100).toFixed(0)}%`,
        `Alerts delivered: ${ctx.metrics.alertsDelivered}`,
      ],
      conclusion:
        ctx.metrics.congestionReduction >= 0.25
          ? 'Metrics show meaningful improvement'
          : 'Improvement below operational threshold',
    },
    {
      step: 2,
      title: 'Per-action review',
      analysis: `Action success rate ${(ctx.metrics.actionSuccessRate * 100).toFixed(0)}%. ${ctx.failedMitigations.length} failed/partial mitigations.`,
      evidence: ctx.failedMitigations.map((f) => `${f.planActionType}: ${f.reason.slice(0, 50)}`),
      conclusion:
        ctx.failedMitigations.length === 0
          ? 'All planned mitigations executed'
          : 'Some mitigations require secondary response',
    },
    {
      step: 3,
      title: 'Residual risk identification',
      analysis: `${ctx.risks.length} unresolved risk(s) detected across corridors and services.`,
      evidence: ctx.risks.map((r) => `[${r.category}] ${r.description}`),
      conclusion:
        ctx.risks.some((r) => r.severity === 'critical')
          ? 'Critical residual risks remain'
          : 'Residual risks manageable with adaptive plan',
    },
    {
      step: 4,
      title: 'Replan decision',
      analysis: ctx.isReplanPass
        ? 'Post-replan reflection pass — evaluating v2 outcomes.'
        : `Replan required: ${ctx.replanRequired}`,
      evidence: ctx.directives.map((d) => d.type),
      conclusion: ctx.replanRequired
        ? 'Initiating adaptive replan (max version 2)'
        : 'No replan — objectives met or max replan reached',
    },
    {
      step: 5,
      title: 'Memory and lessons',
      analysis: 'Extract institutional lessons for crisis_memory.',
      evidence: [],
      conclusion: 'Persist summary and lessons via write_memory',
    },
  ];
}

export function formatReflectionThought(
  trace: ReflectionReasoningStep[],
  summary: string
): string {
  const step4 = trace.find((s) => s.step === 4)?.conclusion ?? '';
  return `CoT reflection: ${summary} ${step4}`.trim();
}
