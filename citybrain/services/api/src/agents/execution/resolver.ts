import type { CrisisRunState } from '@citybrain/shared';
import type { ExecutionToolHandlerName } from './tools.js';

export interface ResolvedToolCall {
  tool: ExecutionToolHandlerName;
  args: Record<string, unknown>;
}

/**
 * Maps planned actions → execution tools (may invoke multiple tools per action).
 */
export function resolveToolsForAction(
  action: {
    id: string;
    type: string;
    title: string;
    payload?: Record<string, unknown>;
  },
  state: CrisisRunState,
  crisisId: string
): ResolvedToolCall[] {
  const payload = (action.payload ?? {}) as Record<string, unknown>;
  const kind = String(payload.emergencyKind ?? '');
  const c = state.candidate?.centroid;
  const base = { crisisId, zone: state.candidate?.areaLabel };

  if (action.type === 'traffic_reroute') {
    return [
      {
        tool: 'updateTrafficRoutes',
        args: {
          ...base,
          corridor: payload.corridor,
          closeRoad: Boolean(payload.closeRoad),
          segment: payload.segment ?? state.candidate?.areaLabel,
          centroid: c,
        },
      },
    ];
  }

  if (action.type === 'dispatch_emergency') {
    if (payload.task === 'hospital_notify' || kind === 'notify_hospitals') {
      return [
        {
          tool: 'notifyHospitals',
          args: {
            ...base,
            protocol: payload.protocol ?? inferHospitalProtocol(state),
            zone: payload.zone ?? state.candidate?.areaLabel,
          },
        },
        {
          tool: 'createEmergencyTicket',
          args: { ...base, unit: 'hospital', task: 'surge_standby', priority: 'high' },
        },
      ];
    }
    return [
      {
        tool: 'dispatchRescueTeams',
        args: {
          ...base,
          unitType: mapUnitType(payload.unit ?? 'rescue'),
          count: payload.count ?? 2,
        },
      },
      {
        tool: 'createEmergencyTicket',
        args: {
          ...base,
          unit: String(payload.unit ?? 'ambulance'),
          task: String(payload.task ?? action.title),
          priority: 'critical',
        },
      },
    ];
  }

  if (action.type === 'citizen_alert' || kind === 'send_alerts') {
    return [
      {
        tool: 'sendEmergencyAlerts',
        args: {
          ...base,
          zones: payload.zones ?? [state.candidate?.areaLabel],
          channels: payload.channels ?? ['sms', 'app'],
        },
      },
    ];
  }

  if (action.type === 'deploy_pumps' || kind === 'allocate_pumps') {
    return [
      {
        tool: 'dispatchRescueTeams',
        args: { ...base, unitType: 'pump', count: payload.units ?? 3 },
      },
      {
        tool: 'createEmergencyTicket',
        args: { ...base, unit: 'pump', task: 'deploy_pumps', priority: 'high' },
      },
    ];
  }

  if (action.type === 'heat_shelter_open') {
    return [
      {
        tool: 'dispatchRescueTeams',
        args: { ...base, unitType: 'shelter', count: payload.shelters ?? 2 },
      },
    ];
  }

  if (action.type === 'infrastructure_isolate') {
    return [
      {
        tool: 'updateTrafficRoutes',
        args: {
          ...base,
          closeRoad: true,
          segment: payload.segment ?? state.candidate?.areaLabel,
          corridor: 'manual_control',
        },
      },
      {
        tool: 'createEmergencyTicket',
        args: { ...base, unit: 'engineer', task: 'grid_isolation', priority: 'critical' },
      },
    ];
  }

  return [
    {
      tool: 'createEmergencyTicket',
      args: { ...base, unit: 'ops', task: action.title, priority: 'medium' },
    },
  ];
}

function mapUnitType(unit: unknown): string {
  const u = String(unit);
  if (u === 'hospital') return 'ambulance';
  if (['rescue', 'ambulance', 'pump', 'tow', 'engineer', 'shelter'].includes(u)) return u;
  return 'rescue';
}

function inferHospitalProtocol(state: CrisisRunState): string {
  const t = state.candidate?.type;
  if (t === 'flood') return 'flood';
  if (t === 'heatwave') return 'heat';
  if (t === 'accident' || t === 'road_blockage') return 'trauma';
  return 'general';
}
