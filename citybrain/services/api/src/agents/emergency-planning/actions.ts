import type { CrisisType, EmergencyActionKind } from '@citybrain/shared';
import type { ActionType } from '@citybrain/shared';

export interface ActionTemplate {
  kind: EmergencyActionKind;
  planActionType: ActionType;
  title: string;
  defaultPhase: 'immediate' | 'containment' | 'recovery';
  baseScores: {
    lifeSafety: number;
    congestionRelief: number;
    resourceEfficiency: number;
    speedToEffect: number;
  };
  buildPayload: (ctx: ActionContext) => Record<string, unknown>;
}

export interface ActionContext {
  areaLabel: string;
  crisisType: CrisisType;
  congestionIndex: number;
  strandedVehicles: number;
  planVersion: number;
}

/** Maps pipeline action type + payload back to emergency kind */
export function kindFromPlanAction(
  type: ActionType,
  payload: Record<string, unknown>
): EmergencyActionKind {
  if (type === 'deploy_pumps') return 'allocate_pumps';
  if (type === 'citizen_alert') return 'send_alerts';
  if (type === 'dispatch_emergency') {
    return payload.task === 'hospital_notify' ? 'notify_hospitals' : 'dispatch_rescue';
  }
  if (type === 'traffic_reroute' && payload.closeRoad) return 'close_roads';
  return 'reroute_traffic';
}

const FLOOD_ACTIONS: ActionTemplate[] = [
  {
    kind: 'dispatch_rescue',
    planActionType: 'dispatch_emergency',
    title: 'Dispatch rescue teams to flooded zone',
    defaultPhase: 'immediate',
    baseScores: { lifeSafety: 95, congestionRelief: 40, resourceEfficiency: 70, speedToEffect: 90 },
    buildPayload: (ctx) => ({ unit: 'rescue', task: 'rescue', zone: ctx.areaLabel }),
  },
  {
    kind: 'allocate_pumps',
    planActionType: 'deploy_pumps',
    title: 'Allocate pump units to waterlogging',
    defaultPhase: 'immediate',
    baseScores: { lifeSafety: 75, congestionRelief: 55, resourceEfficiency: 80, speedToEffect: 70 },
    buildPayload: (ctx) => ({ units: ctx.planVersion > 1 ? 4 : 3, zone: ctx.areaLabel }),
  },
  {
    kind: 'close_roads',
    planActionType: 'traffic_reroute',
    title: 'Close submerged road segments',
    defaultPhase: 'containment',
    baseScores: { lifeSafety: 85, congestionRelief: 60, resourceEfficiency: 85, speedToEffect: 80 },
    buildPayload: (ctx) => ({ closeRoad: true, segment: ctx.areaLabel }),
  },
  {
    kind: 'reroute_traffic',
    planActionType: 'traffic_reroute',
    title: 'Reroute traffic via alternate corridor',
    defaultPhase: 'containment',
    baseScores: { lifeSafety: 50, congestionRelief: 92, resourceEfficiency: 75, speedToEffect: 65 },
    buildPayload: (ctx) => ({
      corridor: ctx.planVersion > 1 ? 'Murree Rd → Kashmir Hwy' : 'Murree Rd',
      adaptive: ctx.planVersion > 1,
    }),
  },
  {
    kind: 'notify_hospitals',
    planActionType: 'dispatch_emergency',
    title: 'Notify hospitals — surge capacity standby',
    defaultPhase: 'containment',
    baseScores: { lifeSafety: 88, congestionRelief: 20, resourceEfficiency: 90, speedToEffect: 75 },
    buildPayload: (ctx) => ({ unit: 'hospital', task: 'hospital_notify', zone: ctx.areaLabel }),
  },
  {
    kind: 'send_alerts',
    planActionType: 'citizen_alert',
    title: 'Send multilingual citizen flood alerts',
    defaultPhase: 'recovery',
    baseScores: { lifeSafety: 60, congestionRelief: 35, resourceEfficiency: 95, speedToEffect: 85 },
    buildPayload: (ctx) => ({ zones: [ctx.areaLabel], channels: ['sms', 'app'] }),
  },
];

const ACCIDENT_ACTIONS: ActionTemplate[] = [
  {
    kind: 'dispatch_rescue',
    planActionType: 'dispatch_emergency',
    title: 'Dispatch ambulance and rescue to incident',
    defaultPhase: 'immediate',
    baseScores: { lifeSafety: 98, congestionRelief: 30, resourceEfficiency: 75, speedToEffect: 95 },
    buildPayload: (ctx) => ({ unit: 'ambulance', task: 'rescue', zone: ctx.areaLabel }),
  },
  {
    kind: 'notify_hospitals',
    planActionType: 'dispatch_emergency',
    title: 'Alert trauma centers — incoming casualties',
    defaultPhase: 'immediate',
    baseScores: { lifeSafety: 90, congestionRelief: 10, resourceEfficiency: 88, speedToEffect: 80 },
    buildPayload: (ctx) => ({ unit: 'hospital', task: 'hospital_notify' }),
  },
  {
    kind: 'close_roads',
    planActionType: 'traffic_reroute',
    title: 'Close accident lane — establish cordon',
    defaultPhase: 'containment',
    baseScores: { lifeSafety: 80, congestionRelief: 70, resourceEfficiency: 82, speedToEffect: 85 },
    buildPayload: (ctx) => ({ closeRoad: true, segment: ctx.areaLabel }),
  },
  {
    kind: 'reroute_traffic',
    planActionType: 'traffic_reroute',
    title: 'Establish detour to clear corridor',
    defaultPhase: 'containment',
    baseScores: { lifeSafety: 45, congestionRelief: 95, resourceEfficiency: 70, speedToEffect: 60 },
    buildPayload: (ctx) => ({ corridor: 'Srinagar Hwy → Murree Rd', detour: true }),
  },
  {
    kind: 'send_alerts',
    planActionType: 'citizen_alert',
    title: 'Warn drivers — avoid incident corridor',
    defaultPhase: 'recovery',
    baseScores: { lifeSafety: 55, congestionRelief: 50, resourceEfficiency: 92, speedToEffect: 88 },
    buildPayload: () => ({ channels: ['sms', 'variable_message_sign'] }),
  },
];

const HEAT_ACTIONS: ActionTemplate[] = [
  {
    kind: 'dispatch_rescue',
    planActionType: 'heat_shelter_open',
    title: 'Open cooling shelters and mobile relief',
    defaultPhase: 'immediate',
    baseScores: { lifeSafety: 92, congestionRelief: 20, resourceEfficiency: 85, speedToEffect: 75 },
    buildPayload: () => ({ shelters: 2, mode: 'cooling' }),
  },
  {
    kind: 'notify_hospitals',
    planActionType: 'dispatch_emergency',
    title: 'Notify hospitals — heatstroke surge protocol',
    defaultPhase: 'immediate',
    baseScores: { lifeSafety: 85, congestionRelief: 15, resourceEfficiency: 90, speedToEffect: 80 },
    buildPayload: () => ({ unit: 'hospital', task: 'hospital_notify', protocol: 'heat' }),
  },
  {
    kind: 'dispatch_rescue',
    planActionType: 'dispatch_emergency',
    title: 'Deploy mobile medical rescue units',
    defaultPhase: 'containment',
    baseScores: { lifeSafety: 80, congestionRelief: 20, resourceEfficiency: 72, speedToEffect: 70 },
    buildPayload: (ctx) => ({ unit: 'rescue', task: 'rescue', mode: 'heat' }),
  },
  {
    kind: 'send_alerts',
    planActionType: 'citizen_alert',
    title: 'Issue heatwave safety alerts',
    defaultPhase: 'recovery',
    baseScores: { lifeSafety: 70, congestionRelief: 25, resourceEfficiency: 95, speedToEffect: 90 },
    buildPayload: () => ({ advisory: 'heatwave', shelter: true }),
  },
];

const INFRA_ACTIONS: ActionTemplate[] = [
  {
    kind: 'dispatch_rescue',
    planActionType: 'dispatch_emergency',
    title: 'Dispatch engineers and rescue standby',
    defaultPhase: 'immediate',
    baseScores: { lifeSafety: 75, congestionRelief: 25, resourceEfficiency: 70, speedToEffect: 75 },
    buildPayload: () => ({ unit: 'engineer', task: 'rescue' }),
  },
  {
    kind: 'close_roads',
    planActionType: 'traffic_reroute',
    title: 'Close intersections with failed signals',
    defaultPhase: 'containment',
    baseScores: { lifeSafety: 70, congestionRelief: 65, resourceEfficiency: 80, speedToEffect: 78 },
    buildPayload: (ctx) => ({ closeRoad: true, segment: ctx.areaLabel, reason: 'grid_failure' }),
  },
  {
    kind: 'reroute_traffic',
    planActionType: 'traffic_reroute',
    title: 'Manual traffic reroute at key junctions',
    defaultPhase: 'containment',
    baseScores: { lifeSafety: 50, congestionRelief: 88, resourceEfficiency: 72, speedToEffect: 55 },
    buildPayload: () => ({ manualControl: true }),
  },
  {
    kind: 'notify_hospitals',
    planActionType: 'dispatch_emergency',
    title: 'Notify hospitals — backup power check',
    defaultPhase: 'containment',
    baseScores: { lifeSafety: 82, congestionRelief: 10, resourceEfficiency: 88, speedToEffect: 70 },
    buildPayload: () => ({ unit: 'hospital', task: 'hospital_notify', check: 'power' }),
  },
  {
    kind: 'send_alerts',
    planActionType: 'citizen_alert',
    title: 'Citizen advisory — grid outage zones',
    defaultPhase: 'recovery',
    baseScores: { lifeSafety: 55, congestionRelief: 30, resourceEfficiency: 93, speedToEffect: 85 },
    buildPayload: () => ({}),
  },
];

const BLOCKAGE_ACTIONS: ActionTemplate[] = [
  ...ACCIDENT_ACTIONS.map((a) => ({
    ...a,
    title: a.title.replace('accident', 'blockage').replace('incident', 'blockage'),
  })),
];

export function getActionCatalog(crisisType: CrisisType): ActionTemplate[] {
  switch (crisisType) {
    case 'flood':
      return FLOOD_ACTIONS;
    case 'accident':
      return ACCIDENT_ACTIONS;
    case 'heatwave':
      return HEAT_ACTIONS;
    case 'infrastructure_failure':
      return INFRA_ACTIONS;
    case 'road_blockage':
      return BLOCKAGE_ACTIONS;
    default:
      return FLOOD_ACTIONS;
  }
}
