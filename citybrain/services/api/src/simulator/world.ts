import type { CrisisRunState } from '@citybrain/shared';
import type { SimulationMetrics, SimulationPhase } from '@citybrain/shared';

export interface SimulationWorld {
  crisisId: string;
  crisisType: string;
  scenarioKey?: string;
  centroid: { lat: number; lng: number };
  areaLabel: string;
  phase: SimulationPhase;
  tick: number;
  simTimeMs: number;
  metrics: SimulationMetrics;
  floodRadiusM: number;
  congestionIndex: number;
  strandedVehicles: number;
  rescueUnits: Array<{
    id: string;
    type: string;
    lat: number;
    lng: number;
    targetLat: number;
    targetLng: number;
    progress: number;
    etaMinutes: number;
    status: string;
  }>;
  routes: Array<{
    id: string;
    polyline: Array<{ lat: number; lng: number }>;
    congestionDelta: number;
    active: boolean;
  }>;
  alertReach: number;
  rerouteAdoption: number;
}

export function createWorld(state: CrisisRunState, crisisId: string): SimulationWorld {
  const c = state.candidate?.centroid ?? { lat: 33.6844, lng: 73.0479 };
  const type = state.candidate?.type ?? 'flood';
  const congestion = state.severity?.estimatedImpact?.congestionIndex ?? 0.82;
  const stranded = state.severity?.estimatedImpact?.strandedVehicles ?? 80;

  const rescueUnits =
    state.resources?.map((r, i) => ({
      id: r.unitId,
      type: r.type,
      lat: c.lat - 0.02 + i * 0.003,
      lng: c.lng - 0.02,
      targetLat: r.lat,
      targetLng: r.lng,
      progress: 0,
      etaMinutes: r.etaMinutes,
      status: 'dispatched',
    })) ?? defaultRescueUnits(c, type);

  const routes =
    state.routes?.map((r) => ({
      id: r.id,
      polyline: r.alternatePolyline,
      congestionDelta: r.congestionDelta,
      active: false,
    })) ?? [];

  return {
    crisisId,
    crisisType: type,
    scenarioKey: state.scenarioKey,
    centroid: c,
    areaLabel: state.candidate?.areaLabel ?? 'Islamabad',
    phase: 'crisis_active',
    tick: 0,
    simTimeMs: 0,
    metrics: buildMetrics(0, congestion, stranded, type, rescueUnits.length, 0, 0),
    floodRadiusM: type === 'flood' ? 400 : 0,
    congestionIndex: congestion,
    strandedVehicles: stranded,
    rescueUnits,
    routes,
    alertReach: state.alerts?.[0]?.reachEstimate ?? 0,
    rerouteAdoption: 0,
  };
}

function defaultRescueUnits(c: { lat: number; lng: number }, type: string) {
  const units = [
    { id: 'AMB-07', type: 'ambulance' },
    { id: 'PUMP-03', type: type === 'flood' ? 'pump' : 'tow' },
  ];
  return units.map((u, i) => ({
    ...u,
    lat: c.lat - 0.015,
    lng: c.lng - 0.01 + i * 0.005,
    targetLat: c.lat + 0.005 * i,
    targetLng: c.lng + 0.008,
    progress: 0,
    etaMinutes: 10 + i * 5,
    status: 'dispatched',
  }));
}

export function buildMetrics(
  simTimeMinutes: number,
  congestion: number,
  stranded: number,
  crisisType: string,
  activeRescue: number,
  rerouteAdoption: number,
  alertReach: number
): SimulationMetrics {
  const floodKm2 =
    crisisType === 'flood' ? Math.PI * Math.pow(0.4 + simTimeMinutes * 0.02, 2) : 0;
  return {
    simTimeMinutes,
    congestionIndex: Math.round(congestion * 100) / 100,
    floodCoverageKm2: Math.round(floodKm2 * 100) / 100,
    strandedVehicles: Math.round(stranded),
    activeRescueUnits: activeRescue,
    avgRescueEtaMinutes:
      activeRescue > 0 ? Math.max(5, 18 - simTimeMinutes * 0.8) : 0,
    rerouteAdoptionPct: Math.round(rerouteAdoption * 100),
    alertsReach: alertReach,
  };
}
