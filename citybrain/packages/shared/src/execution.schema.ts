import { z } from 'zod';

export const ExecutionToolNameSchema = z.enum([
  'updateTrafficRoutes',
  'dispatchRescueTeams',
  'sendEmergencyAlerts',
  'notifyHospitals',
  'createEmergencyTicket',
  'updateDashboard',
]);

export const ExecutionErrorTypeSchema = z.enum([
  'validation_error',
  'not_found',
  'rate_limit',
  'timeout',
  'external_service',
  'internal_error',
]);

export const ExecutionToolCallSchema = z.object({
  tool: ExecutionToolNameSchema,
  args: z.record(z.unknown()),
  actionId: z.string().optional(),
  attempt: z.number().int().min(1).optional(),
});

export const ExecutionToolResultSchema = z.object({
  success: z.boolean(),
  content: z.string(),
  errorType: ExecutionErrorTypeSchema.optional(),
  suggestions: z.array(z.string()).optional(),
  data: z.record(z.unknown()).optional(),
  isError: z.boolean().optional(),
});

export const ExecutionStepResultSchema = z.object({
  actionId: z.string(),
  planActionType: z.string(),
  tool: z.string(),
  toolsInvoked: z.array(ExecutionToolNameSchema),
  status: z.enum(['success', 'partial', 'failed']),
  attempts: z.number().int(),
  stateDelta: z.record(z.unknown()),
  log: z.string(),
  results: z.array(ExecutionToolResultSchema),
});

export const ExecutionReportSchema = z.object({
  crisisId: z.string(),
  totalActions: z.number(),
  succeeded: z.number(),
  failed: z.number(),
  partial: z.number(),
  steps: z.array(ExecutionStepResultSchema),
  overallStatus: z.enum(['success', 'partial', 'failed']),
  thought: z.string(),
  durationMs: z.number(),
});

export type ExecutionToolName = z.infer<typeof ExecutionToolNameSchema>;
export type ExecutionToolResult = z.infer<typeof ExecutionToolResultSchema>;
export type ExecutionStepResult = z.infer<typeof ExecutionStepResultSchema>;
export type ExecutionReport = z.infer<typeof ExecutionReportSchema>;
