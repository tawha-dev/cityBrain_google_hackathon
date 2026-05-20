import { z } from 'zod';
import { CrisisCandidateSchema, GeoPointSchema } from './schemas.js';

/** Single CoT reasoning step (chain-of-thought skill). */
export const ReasoningStepSchema = z.object({
  step: z.number().int().min(1),
  title: z.string(),
  analysis: z.string(),
  evidence: z.array(z.string()).default([]),
  conclusion: z.string().optional(),
});

export const SignalClusterSchema = z.object({
  id: z.string(),
  areaLabel: z.string(),
  centroid: GeoPointSchema,
  signalIds: z.array(z.string()),
  size: z.number().int(),
  dominantEventType: z.string(),
  geographicSpreadKm: z.number(),
  repeatedComplaintCount: z.number().int(),
  avgConfidence: z.number().min(0).max(1),
  sources: z.array(z.string()),
  hasWeatherAlert: z.boolean(),
  hasCongestionSpike: z.boolean(),
  strandedVehicleSignals: z.number().int(),
});

export const EscalationRiskSchema = z.object({
  level: z.enum(['low', 'medium', 'high', 'imminent']),
  score: z.number().min(0).max(1),
  predictedEscalationLevel: z.enum(['watch', 'advisory', 'operational', 'critical']),
  factors: z.array(z.string()),
  rationale: z.string(),
  timeHorizonMinutes: z.number().int().optional(),
});

export const CrisisDetectionReportSchema = z.object({
  candidate: CrisisCandidateSchema.nullable(),
  preliminarySeverity: z.enum(['low', 'medium', 'high', 'critical']),
  escalationRisk: EscalationRiskSchema,
  clusters: z.array(SignalClusterSchema),
  reasoningTrace: z.array(ReasoningStepSchema),
  confidence: z.number().min(0).max(1),
  thought: z.string(),
  verified: z.boolean(),
  method: z.enum(['cot_gemini', 'cot_rules']),
  memoryInsight: z.string().optional(),
});

export type ReasoningStep = z.infer<typeof ReasoningStepSchema>;
export type SignalCluster = z.infer<typeof SignalClusterSchema>;
export type EscalationRisk = z.infer<typeof EscalationRiskSchema>;
export type CrisisDetectionReport = z.infer<typeof CrisisDetectionReportSchema>;
