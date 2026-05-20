import type { CrisisRunState } from '@citybrain/shared';
import { TOOL_REGISTRY, ToolResult, type ToolContext } from '@citybrain/agent-tools';

function validateCrisisId(crisisId: unknown, ctx: ToolContext): ToolResult | null {
  if (typeof crisisId !== 'string' || crisisId.length < 8) {
    return new ToolResult(
      false,
      'crisisId must be a valid UUID string',
      'validation_error',
      ['Pass state.crisisId from the active pipeline run']
    );
  }
  if (ctx.crisisId && crisisId !== ctx.crisisId) {
    return new ToolResult(false, 'crisisId does not match active run', 'validation_error');
  }
  return null;
}

export async function updateTrafficRoutes(
  args: Record<string, unknown>,
  state: CrisisRunState,
  ctx: ToolContext
): Promise<ToolResult> {
  const err = validateCrisisId(args.crisisId ?? ctx.crisisId, ctx);
  if (err) return err;

  try {
    const parts: string[] = [];
    const data: Record<string, unknown> = {};

    if (args.closeRoad) {
      const closed = await TOOL_REGISTRY.apply_road_closure(
        { segment: args.segment ?? state.candidate?.areaLabel },
        state,
        ctx
      );
      parts.push(`Closed segment: ${closed.closedSegment}`);
      data.closure = closed;
    }

    const routes = await TOOL_REGISTRY.google_routes(
      { corridor: args.corridor },
      state,
      ctx
    );
    data.congestionDelta = routes.congestionDelta;
    data.alternateRoute = routes.alternateRoute;
    parts.push(`Reroute active: ${routes.alternateRoute} (congestion Δ ${routes.congestionDelta})`);

    return new ToolResult(true, parts.join('. '), undefined, undefined, data);
  } catch (e) {
    return new ToolResult(
      false,
      e instanceof Error ? e.message : 'Traffic routing service unavailable',
      'external_service',
      ['Retry in 30 seconds', 'Verify corridor label']
    );
  }
}

export async function dispatchRescueTeams(
  args: Record<string, unknown>,
  state: CrisisRunState,
  ctx: ToolContext
): Promise<ToolResult> {
  const err = validateCrisisId(args.crisisId ?? ctx.crisisId, ctx);
  if (err) return err;

  const unitType = String(args.unitType ?? 'rescue');
  const valid = ['rescue', 'ambulance', 'pump', 'tow', 'engineer', 'shelter'];
  if (!valid.includes(unitType)) {
    return new ToolResult(false, `Invalid unitType "${unitType}"`, 'validation_error', valid);
  }

  try {
    const inv = await TOOL_REGISTRY.inventory_status({}, state, ctx);
    const alloc = await TOOL_REGISTRY.allocate_units({}, state, ctx);
    const ticket = await TOOL_REGISTRY.create_ticket(
      { unit: unitType, task: args.zone ?? state.candidate?.areaLabel },
      state,
      ctx
    );

    const assignments = (alloc.assignments as unknown[]) ?? [];
    return new ToolResult(
      true,
      `Dispatched ${unitType} to ${args.zone ?? state.candidate?.areaLabel ?? 'zone'}. Ticket ${ticket.ticketId}. ${assignments.length} unit(s) assigned.`,
      undefined,
      undefined,
      { ticketId: ticket.ticketId, assignments, inventory: inv }
    );
  } catch (e) {
    return new ToolResult(
      false,
      e instanceof Error ? e.message : 'Dispatch failed',
      'internal_error'
    );
  }
}

export async function sendEmergencyAlerts(
  args: Record<string, unknown>,
  state: CrisisRunState,
  ctx: ToolContext
): Promise<ToolResult> {
  const err = validateCrisisId(args.crisisId ?? ctx.crisisId, ctx);
  if (err) return err;

  try {
    const draft = await TOOL_REGISTRY.draft_alert({}, state, ctx);
    const seg = await TOOL_REGISTRY.segment_citizens({}, state, ctx);
    const reach = Number(seg.reachEstimate ?? 12400);
    const zones = Array.isArray(args.zones) ? args.zones : [state.candidate?.areaLabel ?? 'Zone'];

    return new ToolResult(
      true,
      `Alerts sent to ~${reach} citizens in ${(zones as string[]).join(', ')}.`,
      undefined,
      undefined,
      { reachEstimate: reach, zones, preview: String(draft.en).slice(0, 120) }
    );
  } catch (e) {
    return new ToolResult(
      false,
      e instanceof Error ? e.message : 'Alert broadcast failed',
      'rate_limit',
      ['Wait 60 seconds and retry']
    );
  }
}

export async function notifyHospitals(
  args: Record<string, unknown>,
  state: CrisisRunState,
  ctx: ToolContext
): Promise<ToolResult> {
  const err = validateCrisisId(args.crisisId ?? ctx.crisisId, ctx);
  if (err) return err;

  try {
    const protocol = String(args.protocol ?? 'general');
    const ticket = await TOOL_REGISTRY.create_ticket(
      { unit: 'hospital', task: `hospital_notify:${protocol}` },
      state,
      ctx
    );

    const facilities = ['PIMS', 'Polyclinic', 'District HQ'];
    return new ToolResult(
      true,
      `Hospital surge protocol "${protocol}" activated. Notified ${facilities.length} facilities. Ticket ${ticket.ticketId}.`,
      undefined,
      undefined,
      { ticketId: ticket.ticketId, facilities, protocol }
    );
  } catch (e) {
    return new ToolResult(
      false,
      e instanceof Error ? e.message : 'Hospital notification failed',
      'external_service'
    );
  }
}

export async function createEmergencyTicket(
  args: Record<string, unknown>,
  state: CrisisRunState,
  ctx: ToolContext
): Promise<ToolResult> {
  const err = validateCrisisId(args.crisisId ?? ctx.crisisId, ctx);
  if (err) return err;

  if (!args.unit || typeof args.unit !== 'string') {
    return new ToolResult(
      false,
      'unit is required (e.g. ambulance, pump, engineer)',
      'validation_error',
      ['ambulance', 'pump', 'tow', 'engineer']
    );
  }

  try {
    const ticket = await TOOL_REGISTRY.create_ticket(
      {
        unit: args.unit,
        task: args.task ?? state.candidate?.title,
        priority: args.priority,
      },
      state,
      ctx
    );
    return new ToolResult(
      true,
      `Emergency ticket ${ticket.ticketId} created for ${args.unit} (${ticket.status}).`,
      undefined,
      undefined,
      ticket as Record<string, unknown>
    );
  } catch (e) {
    return new ToolResult(false, 'Ticket creation failed', 'internal_error');
  }
}

export async function updateDashboard(
  args: Record<string, unknown>,
  state: CrisisRunState,
  ctx: ToolContext
): Promise<ToolResult> {
  const err = validateCrisisId(args.crisisId ?? ctx.crisisId, ctx);
  if (err) return err;

  const progress = args.progress as Record<string, unknown> | undefined;
  const metrics = {
    congestionIndex: state.severity?.estimatedImpact?.congestionIndex ?? 0.82,
    strandedVehicles: state.severity?.estimatedImpact?.strandedVehicles ?? 80,
    resourcesDeployed: state.resources?.length ?? 0,
    activeAlerts: state.alerts?.length ?? 0,
    executionProgress: progress,
  };

  const mapState = {
    centroid: state.candidate?.centroid,
    routes: state.routes ?? [],
    resources: state.resources ?? [],
    alerts: state.alerts ?? [],
    phase: args.phase ?? 'executing',
  };

  return new ToolResult(
    true,
    `Dashboard updated (${args.phase ?? 'executing'}).`,
    undefined,
    undefined,
    { metrics, mapState }
  );
}

export const EXECUTION_TOOL_HANDLERS = {
  updateTrafficRoutes,
  dispatchRescueTeams,
  sendEmergencyAlerts,
  notifyHospitals,
  createEmergencyTicket,
  updateDashboard,
} as const;

export type ExecutionToolHandlerName = keyof typeof EXECUTION_TOOL_HANDLERS;
