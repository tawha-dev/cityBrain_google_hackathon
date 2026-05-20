import type { CrisisRunState } from '@citybrain/shared';
import type { FailedMitigation } from '@citybrain/shared';
import type { ExecutionReport } from '@citybrain/shared';

export function analyzeFailedMitigations(
  state: CrisisRunState,
  executionReport?: ExecutionReport
): FailedMitigation[] {
  const failed: FailedMitigation[] = [];

  if (executionReport?.steps) {
    for (const step of executionReport.steps) {
      if (step.status === 'failed' || step.status === 'partial') {
        failed.push({
          actionId: step.actionId,
          planActionType: step.planActionType,
          tool: step.tool,
          reason: step.log.slice(0, 200),
          impact:
            step.status === 'failed'
              ? 'Mitigation did not execute — residual risk remains'
              : 'Partial execution — incomplete mitigation',
        });
      }
    }
    return failed;
  }

  for (const r of state.executionResults ?? []) {
    if (r.status === 'failed' || r.status === 'partial') {
      failed.push({
        actionId: r.actionId,
        planActionType: inferTypeFromLog(r.log),
        tool: r.tool,
        reason: r.log,
        impact:
          r.status === 'failed'
            ? 'Action failed in simulation'
            : 'Partial success — follow-up required',
      });
    }
  }

  return failed;
}

function inferTypeFromLog(log: string): string {
  if (/reroute|traffic|road/i.test(log)) return 'traffic_reroute';
  if (/pump|deploy/i.test(log)) return 'deploy_pumps';
  if (/alert|citizen/i.test(log)) return 'citizen_alert';
  if (/hospital|ambulance|rescue|dispatch/i.test(log)) return 'dispatch_emergency';
  return 'unknown';
}
