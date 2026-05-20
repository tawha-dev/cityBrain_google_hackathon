import { z } from 'zod';
import { ReflectionReportSchema } from './schemas.js';

export const ReflectionReasoningStepSchema = z.object({
  step: z.number().int().min(1),
  title: z.string(),
  analysis: z.string(),
  evidence: z.array(z.string()).default([]),
  conclusion: z.string().optional(),
});

export const UnresolvedRiskSchema = z.object({
  id: z.string(),
  category: z.enum([
    'congestion',
    'flooding',
    'hospital_capacity',
    'rescue_delay',
    'infrastructure',
    'public_safety',
  ]),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  description: z.string(),
  evidence: z.array(z.string()),
  zone: z.string().optional(),
});

export const FailedMitigationSchema = z.object({
  actionId: z.string(),
  planActionType: z.string(),
  tool: z.string(),
  reason: z.string(),
  impact: z.string(),
});

export const AdaptiveDirectiveSchema = z.object({
  type: z.enum([
    'escalate_severity',
    'expand_rerouting',
    'dispatch_secondary_teams',
    'broaden_alerts',
  ]),
  priority: z.number().int().min(1).max(10),
  rationale: z.string(),
  payload: z.record(z.unknown()).optional(),
});

export const EscalationWorkflowSchema = z.object({
  fromLevel: z.string(),
  toLevel: z.string(),
  triggeredBy: z.array(z.string()),
  autoApproved: z.boolean(),
});

export const ReflectionAnalysisSchema = z.object({
  report: ReflectionReportSchema,
  reasoningTrace: z.array(ReflectionReasoningStepSchema),
  unresolvedRisks: z.array(UnresolvedRiskSchema),
  failedMitigations: z.array(FailedMitigationSchema),
  adaptiveDirectives: z.array(AdaptiveDirectiveSchema),
  escalationWorkflow: EscalationWorkflowSchema.optional(),
  replanRequired: z.boolean(),
  maxReplanReached: z.boolean(),
  thought: z.string(),
  method: z.enum(['cot_rules', 'gemini']),
});

export type ReflectionReasoningStep = z.infer<typeof ReflectionReasoningStepSchema>;
export type UnresolvedRisk = z.infer<typeof UnresolvedRiskSchema>;
export type FailedMitigation = z.infer<typeof FailedMitigationSchema>;
export type AdaptiveDirective = z.infer<typeof AdaptiveDirectiveSchema>;
export type ReflectionAnalysis = z.infer<typeof ReflectionAnalysisSchema>;
