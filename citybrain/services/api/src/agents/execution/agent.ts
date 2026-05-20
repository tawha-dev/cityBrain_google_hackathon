import { v4 as uuid } from 'uuid';
import {
  ExecutionReportSchema,
  ExecutionResultSchema,
  type CrisisRunState,
  type ExecutionReport,
  type ExecutionResult,
} from '@citybrain/shared';
import type { ToolContext } from '@citybrain/agent-tools';
import { broadcast } from '../../ws/hub.js';
import * as repo from '../../db/repository.js';
import { EXECUTION_TOOL_HANDLERS } from './tools.js';
import { resolveToolsForAction } from './resolver.js';
import { executeWithRetry, mergeToolResults } from './retry.js';
import type { ExecutionToolHandlerName } from './tools.js';
import { buildMapDeltaPayload } from '../../map/state-overlays.js';

export interface ExecutionAgentResult {
  report: ExecutionReport;
  results: ExecutionResult[];
}

type ExtendedState = CrisisRunState & { executionReport?: ExecutionReport };

function buildMetrics(state: CrisisRunState, after = false) {
  const base = {
    congestionIndex: state.severity?.estimatedImpact?.congestionIndex ?? 0.82,
    strandedVehicles: state.severity?.estimatedImpact?.strandedVehicles ?? 80,
    activeAlerts: state.alerts?.length ?? 0,
    resourcesDeployed: state.resources?.length ?? 0,
  };
  if (after) {
    return {
      ...base,
      congestionIndex: Math.max(0.35, base.congestionIndex - 0.32),
      strandedVehicles: Math.round(base.strandedVehicles * 0.82),
    };
  }
  return base;
}

/**
 * Execution Agent — runs planned actions via tool-calling with retry, logs, and WS fan-out.
 */
export async function runExecutionAgent(
  state: CrisisRunState,
  ctx: ToolContext,
  crisisId: string
): Promise<ExecutionAgentResult> {
  const start = Date.now();
  const actions = state.plan?.actions ?? [];
  const results: ExecutionResult[] = [];
  const steps: ExecutionReport['steps'] = [];

  await repo.createSnapshot(crisisId, 'before', buildMetrics(state), buildMapDeltaPayload(state));

  broadcast({
    type: 'execution.started',
    crisisId,
    timestamp: new Date().toISOString(),
    payload: { totalActions: actions.length, planVersion: state.planVersion },
  });

  await runDashboardTool(state, ctx, crisisId, {
    phase: 'before',
    progress: { completed: 0, total: actions.length, currentAction: 'Starting execution' },
  });

  let completed = 0;
  let failed = 0;

  for (let i = 0; i < actions.length; i++) {
    const action = actions[i];
    const toolCalls = resolveToolsForAction(action, state, crisisId);
    const invokedTools: ExecutionToolHandlerName[] = [];
    const rawResults: import('@citybrain/shared').ExecutionToolResult[] = [];
    let totalAttempts = 0;

    broadcast({
      type: 'execution.progress',
      crisisId,
      timestamp: new Date().toISOString(),
      payload: {
        index: i + 1,
        total: actions.length,
        actionId: action.id,
        title: action.title,
        tools: toolCalls.map((t) => t.tool),
      },
    });

    const actionDbId = await repo.createAction(crisisId, action);

    for (const call of toolCalls) {
      invokedTools.push(call.tool);
      const handler = EXECUTION_TOOL_HANDLERS[call.tool];

      const { result, attempts } = await executeWithRetry((attempt) =>
        handler({ ...call.args, _attempt: attempt }, state, ctx)
      );
      totalAttempts += attempts;
      rawResults.push(result.toJSON());

      await ctx.logExecution({
        tool: call.tool,
        actionId: actionDbId,
        request: { ...call.args, attempt: attempts },
        response: result.toJSON(),
        stateDelta: result.data ?? {},
        status: result.success ? 'success' : 'failed',
      });
    }

    const merged = mergeToolResults(rawResults);
    if (merged.status === 'failed') failed += 1;
    else completed += 1;

    applyStateDelta(state, action, merged.stateDelta);

    const step = {
      actionId: action.id,
      planActionType: action.type,
      tool: invokedTools.join('+'),
      toolsInvoked: invokedTools,
      status: merged.status,
      attempts: totalAttempts,
      stateDelta: merged.stateDelta,
      log: merged.log,
      results: rawResults,
    };
    steps.push(step);

    const execResult = ExecutionResultSchema.parse({
      actionId: action.id,
      status: merged.status,
      tool: step.tool,
      stateDelta: merged.stateDelta,
      log: merged.log.slice(0, 500),
    });
    results.push(execResult);

    broadcast({
      type: 'action.executed',
      crisisId,
      timestamp: new Date().toISOString(),
      payload: execResult,
    });

    if (merged.status === 'failed' && isCriticalAction(action.type)) {
      broadcast({
        type: 'execution.failed',
        crisisId,
        timestamp: new Date().toISOString(),
        payload: { actionId: action.id, reason: merged.log },
      });
    }

    await runDashboardTool(state, ctx, crisisId, {
      phase: 'executing',
      progress: {
        completed: i + 1,
        total: actions.length,
        currentAction: action.title,
      },
    });
  }

  const overallStatus =
    failed === 0 ? 'success' : completed > 0 ? 'partial' : 'failed';

  const report = ExecutionReportSchema.parse({
    crisisId,
    totalActions: actions.length,
    succeeded: completed,
    failed,
    partial: steps.filter((s) => s.status === 'partial').length,
    steps,
    overallStatus,
    thought: buildThought(overallStatus, completed, actions.length, Date.now() - start),
    durationMs: Date.now() - start,
  });

  await runDashboardTool(state, ctx, crisisId, {
    phase: 'after',
    progress: { completed: actions.length, total: actions.length, currentAction: 'Complete' },
  });

  const afterMetrics = buildMetrics(state, true);
  await repo.createSnapshot(crisisId, 'after', afterMetrics, buildMapDeltaPayload(state, true));

  broadcast({
    type: 'execution.completed',
    crisisId,
    timestamp: new Date().toISOString(),
    payload: {
      overallStatus,
      succeeded: completed,
      failed,
      durationMs: report.durationMs,
    },
  });

  broadcast({
    type: 'map.delta',
    crisisId,
    timestamp: new Date().toISOString(),
    payload: buildMapDeltaPayload(state, true),
  });

  await repo.updateCrisis(crisisId, {
    status: overallStatus === 'failed' ? 'monitoring' : 'reflecting',
  });

  return { report, results };
}

async function runDashboardTool(
  state: CrisisRunState,
  ctx: ToolContext,
  crisisId: string,
  opts: { phase: string; progress?: Record<string, unknown> }
) {
  const result = await EXECUTION_TOOL_HANDLERS.updateDashboard(
    { crisisId, phase: opts.phase, progress: opts.progress },
    state,
    ctx
  );

  if (result.success && result.data) {
    broadcast({
      type: 'dashboard.updated',
      crisisId,
      timestamp: new Date().toISOString(),
      payload: result.data,
    });
  }
}

function applyStateDelta(
  state: CrisisRunState,
  action: { type: string; payload?: Record<string, unknown> },
  delta: Record<string, unknown>
) {
  if (delta.congestionDelta != null && state.severity?.estimatedImpact) {
    const cur = state.severity.estimatedImpact.congestionIndex ?? 0.82;
    state.severity.estimatedImpact.congestionIndex = Math.max(
      0.2,
      cur + Number(delta.congestionDelta)
    );
  }

  if (action.type === 'traffic_reroute' && delta.alternateRoute) {
    const c = state.candidate?.centroid ?? { lat: 33.6844, lng: 73.0479 };
    state.routes = [
      ...(state.routes ?? []),
      {
        id: uuid(),
        from: c,
        to: { lat: c.lat + 0.01, lng: c.lng + 0.01 },
        alternatePolyline: [c, { lat: c.lat + 0.005, lng: c.lng + 0.008 }],
        reason: String(delta.alternateRoute),
        congestionDelta: Number(delta.congestionDelta ?? -0.32),
      },
    ];
  }

  if (delta.ticketId) {
    state.resources = [
      ...(state.resources ?? []),
      {
        unitId: String(delta.ticketId),
        type: 'ticket',
        lat: state.candidate?.centroid?.lat ?? 33.68,
        lng: state.candidate?.centroid?.lng ?? 73.04,
        task: 'dispatched',
        etaMinutes: 10,
      },
    ];
  }
}

function isCriticalAction(type: string): boolean {
  return type === 'dispatch_emergency' || type === 'deploy_pumps';
}

function buildThought(
  status: string,
  succeeded: number,
  total: number,
  durationMs: number
): string {
  return (
    `Execution ${status}: ${succeeded}/${total} actions succeeded in ${durationMs}ms. ` +
    `Tools: traffic, rescue, alerts, hospitals, tickets, dashboard.`
  );
}

export function applyExecutionToState(
  state: CrisisRunState,
  result: ExecutionAgentResult
): void {
  state.executionResults = result.results;
  (state as ExtendedState).executionReport = result.report;
}
