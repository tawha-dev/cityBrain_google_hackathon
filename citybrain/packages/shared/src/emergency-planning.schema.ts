import { z } from 'zod';

/** User-facing emergency action kinds */
export const EmergencyActionKindSchema = z.enum([
  'reroute_traffic',
  'dispatch_rescue',
  'notify_hospitals',
  'send_alerts',
  'close_roads',
  'allocate_pumps',
]);

export const PlanPhaseSchema = z.enum(['immediate', 'containment', 'recovery']);

export const ActionImpactEstimateSchema = z.object({
  congestionDelta: z.number().describe('Expected change in congestion index (-1 to 0)'),
  strandedReduction: z.number().min(0).max(1).describe('Fraction of stranded vehicles relieved'),
  livesRiskReduction: z.number().min(0).max(1).describe('Relative life-safety improvement'),
  etaMinutes: z.number().int().min(1),
});

export const RankedEmergencyActionSchema = z.object({
  id: z.string(),
  kind: EmergencyActionKindSchema,
  planActionType: z.enum([
    'traffic_reroute',
    'dispatch_emergency',
    'citizen_alert',
    'infrastructure_isolate',
    'heat_shelter_open',
    'deploy_pumps',
  ]),
  title: z.string(),
  priority: z.number().int().min(1).max(10),
  rankScore: z.number().min(0).max(100),
  sequenceOrder: z.number().int(),
  phase: PlanPhaseSchema,
  payload: z.record(z.unknown()),
  impact: ActionImpactEstimateSchema,
  rationale: z.string(),
  criteriaScores: z.record(z.number()).optional(),
});

export const AggregateImpactSchema = z.object({
  totalCongestionDelta: z.number(),
  totalStrandedReduction: z.number(),
  estimatedClearanceMinutes: z.number(),
  actionsCount: z.number(),
});

export const EmergencyPlanReportSchema = z.object({
  version: z.number(),
  summary: z.string(),
  rankedActions: z.array(RankedEmergencyActionSchema),
  executionSequence: z.array(z.string()),
  aggregateImpact: AggregateImpactSchema,
  criteriaWeights: z.record(z.number()),
  thought: z.string(),
  method: z.enum(['decision_matrix', 'gemini']),
  adaptiveNote: z.string().optional(),
  sopId: z.string().optional(),
});

export type EmergencyActionKind = z.infer<typeof EmergencyActionKindSchema>;
export type PlanPhase = z.infer<typeof PlanPhaseSchema>;
export type ActionImpactEstimate = z.infer<typeof ActionImpactEstimateSchema>;
export type RankedEmergencyAction = z.infer<typeof RankedEmergencyActionSchema>;
export type EmergencyPlanReport = z.infer<typeof EmergencyPlanReportSchema>;
