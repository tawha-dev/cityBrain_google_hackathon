import {
  EmergencyPlanReportSchema,
  type CrisisRunState,
  type EmergencyPlanReport,
} from '@citybrain/shared';
import { generateStructuredJson } from '../../orchestrator/gemini-structured.js';
import type { PrioritizationContext } from './prioritization.js';
import type { ActionContext } from './actions.js';
import { getActionCatalog } from './actions.js';
import { rankActions } from './ranking.js';
import { sequenceActions, buildExecutionSequence } from './sequencing.js';
import { aggregateImpact } from './impact.js';
import { CRITERIA_WEIGHTS } from './prioritization.js';
import { filterViableActions } from './prioritization.js';

const SYSTEM = `You are CityBrain Emergency Planning. Use a weighted decision matrix:
- Life safety 35%, Congestion relief 25%, Resources 15%, Speed 15%, Escalation fit 10%.
Sequence: immediate (rescue, hospitals) → containment (close roads, pumps, reroute) → recovery (alerts).
Minimize congestion while optimizing rescue deployment.`;

export async function planWithGemini(
  state: CrisisRunState,
  prioCtx: PrioritizationContext,
  actionCtx: ActionContext,
  sopId: string
): Promise<EmergencyPlanReport | null> {
  const catalog = filterViableActions(getActionCatalog(prioCtx.crisisType), prioCtx);

  const raw = await generateStructuredJson<Record<string, unknown>>({
    systemInstruction: SYSTEM,
    userPrompt: `Build emergency response plan.

Crisis: ${state.candidate?.title}
Type: ${prioCtx.crisisType}
Area: ${actionCtx.areaLabel}
Severity: ${prioCtx.severity}
Escalation: ${prioCtx.escalationLevel}
Congestion: ${prioCtx.congestionIndex}
Stranded vehicles: ${prioCtx.strandedVehicles}
SOP: ${sopId}
Plan version: ${prioCtx.planVersion}

Available action kinds (use only these): reroute_traffic, dispatch_rescue, notify_hospitals, send_alerts, close_roads, allocate_pumps

Return rankedActions with kind, title, phase, rankScore 0-100, and brief rationale.`,
    responseSchema: {
      type: 'object',
      properties: {
        summary: { type: 'string' },
        rankedActions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              kind: { type: 'string' },
              title: { type: 'string' },
              phase: { type: 'string' },
              rankScore: { type: 'number' },
              rationale: { type: 'string' },
            },
          },
        },
      },
    },
  });

  if (!raw) return null;

  const rulesRanked = rankActions(catalog, prioCtx, actionCtx);
  const sequenced = sequenceActions(rulesRanked);
  const aggregate = aggregateImpact(sequenced);

  const report: EmergencyPlanReport = {
    version: prioCtx.planVersion,
    summary: String(raw.summary ?? `Gemini-assisted ${prioCtx.crisisType} plan`),
    rankedActions: sequenced,
    executionSequence: buildExecutionSequence(sequenced),
    aggregateImpact: aggregate,
    criteriaWeights: CRITERIA_WEIGHTS,
    thought: `Gemini-assisted decision matrix; ${sequenced.length} actions sequenced.`,
    method: 'gemini',
    sopId,
  };

  const parsed = EmergencyPlanReportSchema.safeParse(report);
  return parsed.success ? parsed.data : null;
}
