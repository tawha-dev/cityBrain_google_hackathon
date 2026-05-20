import { z } from 'zod';

export const GeoPointSchema = z.object({
  lat: z.number(),
  lng: z.number(),
});

export const SignalSchema = z.object({
  id: z.string().optional(),
  source: z.enum(['social', 'weather', 'traffic', 'field_report', 'sensor']),
  rawText: z.string(),
  normalizedText: z.string().optional(),
  language: z.enum(['en', 'ur', 'roman_ur', 'mixed']).default('en'),
  location: GeoPointSchema.optional(),
  areaLabel: z.string().optional(),
  entities: z.array(z.string()).optional().default([]),
  sentiment: z.number().min(-1).max(1).optional(),
  confidence: z.number().min(0).max(1).default(0.7),
  ingestedAt: z.string().datetime().optional(),
});

export const CrisisCandidateSchema = z.object({
  type: z.enum([
    'flood',
    'heatwave',
    'accident',
    'infrastructure_failure',
    'road_blockage',
  ]),
  title: z.string(),
  areaLabel: z.string(),
  centroid: GeoPointSchema,
  signalIds: z.array(z.string()),
  confidence: z.number().min(0).max(1),
  summary: z.string(),
});

export const SeverityReportSchema = z.object({
  level: z.enum(['low', 'medium', 'high', 'critical']),
  escalationLevel: z.enum(['watch', 'advisory', 'operational', 'critical']),
  confidence: z.number().min(0).max(1),
  rationale: z.string(),
  factors: z.array(z.string()),
  estimatedImpact: z.object({
    strandedVehicles: z.number().optional(),
    congestionIndex: z.number().optional(),
    affectedPopulation: z.number().optional(),
  }),
});

export const PlannedActionSchema = z.object({
  id: z.string(),
  type: z.enum([
    'traffic_reroute',
    'dispatch_emergency',
    'citizen_alert',
    'infrastructure_isolate',
    'heat_shelter_open',
    'deploy_pumps',
  ]),
  title: z.string(),
  payload: z.record(z.unknown()),
  priority: z.number().min(1).max(10),
});

export const ResponsePlanSchema = z.object({
  version: z.number(),
  summary: z.string(),
  actions: z.array(PlannedActionSchema),
});

export const ResourceAssignmentSchema = z.object({
  unitId: z.string(),
  type: z.string(),
  lat: z.number(),
  lng: z.number(),
  task: z.string(),
  etaMinutes: z.number(),
});

export const RouteOverrideSchema = z.object({
  id: z.string(),
  from: GeoPointSchema,
  to: GeoPointSchema,
  alternatePolyline: z.array(GeoPointSchema),
  reason: z.string(),
  congestionDelta: z.number(),
});

export const CitizenAlertSchema = z.object({
  id: z.string(),
  zoneLabel: z.string(),
  languages: z.object({
    en: z.string(),
    ur: z.string().optional(),
    romanUr: z.string().optional(),
  }),
  reachEstimate: z.number(),
});

export const ExecutionResultSchema = z.object({
  actionId: z.string(),
  status: z.enum(['success', 'partial', 'failed']),
  tool: z.string(),
  stateDelta: z.record(z.unknown()),
  log: z.string(),
});

export const ReflectionReportSchema = z.object({
  outcomeScore: z.number().min(0).max(1),
  lessons: z.array(z.string()),
  replanRequired: z.boolean(),
  summary: z.string(),
  metricsDelta: z.object({
    congestionReduction: z.number(),
    strandedReduction: z.number(),
    alertsDelivered: z.number(),
  }),
});

export const CrisisRunStateSchema = z.object({
  runId: z.string(),
  crisisId: z.string().optional(),
  scenarioKey: z.string().optional(),
  stepCount: z.number(),
  maxSteps: z.number().default(24),
  currentAgent: z.string().optional(),
  rawSignals: z.array(SignalSchema),
  normalizedSignals: z.array(SignalSchema),
  candidate: CrisisCandidateSchema.optional(),
  severity: SeverityReportSchema.optional(),
  plan: ResponsePlanSchema.optional(),
  resources: z.array(ResourceAssignmentSchema).optional(),
  routes: z.array(RouteOverrideSchema).optional(),
  alerts: z.array(CitizenAlertSchema).optional(),
  executionResults: z.array(ExecutionResultSchema).optional(),
  reflection: ReflectionReportSchema.optional(),
  replanRequired: z.boolean().default(false),
  planVersion: z.number().default(1),
  error: z.string().optional(),
});

export type Signal = z.infer<typeof SignalSchema>;
export type CrisisCandidate = z.infer<typeof CrisisCandidateSchema>;
export type SeverityReport = z.infer<typeof SeverityReportSchema>;
export type ResponsePlan = z.infer<typeof ResponsePlanSchema>;
export type CrisisRunState = z.infer<typeof CrisisRunStateSchema>;
export type ExecutionResult = z.infer<typeof ExecutionResultSchema>;
export type ReflectionReport = z.infer<typeof ReflectionReportSchema>;
