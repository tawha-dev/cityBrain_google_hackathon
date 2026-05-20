import { create } from 'zustand';
import type { MapOverlayFull, MapHotspot } from './map/types';

export type { MapOverlayFull, MapHotspot };

export interface TraceStep {
  agent: string;
  status: string;
  thought?: string;
  latencyMs?: number;
  timestamp: string;
}

export interface LiveSignal {
  id?: string;
  source: string;
  rawText: string;
  areaLabel?: string;
  lat?: number;
  lng?: number;
  priority?: 'normal' | 'high' | 'critical';
  timestamp: string;
}

export interface ExecutionLogEntry {
  id: string;
  tool: string;
  status: string;
  actionId?: string;
  request?: unknown;
  response?: unknown;
  timestamp: string;
}

export interface SimulationFrameLite {
  tick: number;
  phase: string;
  metrics: {
    congestionIndex: number;
    floodCoverageKm2?: number;
    strandedVehicles: number;
    activeRescueUnits?: number;
  };
  overlayCount: number;
}

export interface TimelineEventLite {
  id: string;
  tick: number;
  category: string;
  label: string;
  timestamp: string;
}

export interface ResourceUnit {
  id: string;
  type: string;
  name: string;
  lat: number;
  lng: number;
  status: string;
}

export interface AlertItem {
  id: string;
  zoneLabel: string;
  reachEstimate: number;
  preview?: string;
  timestamp: string;
}

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';

interface CrisisStore {
  selectedCrisisId: string | null;
  setSelectedCrisis: (id: string | null) => void;

  connectionStatus: ConnectionStatus;
  setConnectionStatus: (s: ConnectionStatus) => void;

  escalationLevel: string;
  setEscalation: (level: string) => void;

  traces: TraceStep[];
  addTrace: (step: TraceStep) => void;
  clearTraces: () => void;

  signals: LiveSignal[];
  addSignal: (s: LiveSignal) => void;
  clearSignals: () => void;

  executionLogs: ExecutionLogEntry[];
  addExecutionLog: (e: ExecutionLogEntry) => void;
  clearExecutionLogs: () => void;

  mapOverlays: MapOverlayFull[];
  setMapOverlays: (o: MapOverlayFull[]) => void;
  mapHotspots: MapHotspot[];
  addMapHotspot: (h: MapHotspot) => void;
  mapMetrics: Record<string, number>;
  setMapMetrics: (m: Record<string, number>) => void;

  simulationFrame: SimulationFrameLite | null;
  setSimulationFrame: (f: SimulationFrameLite | null) => void;
  simulationPhase: string;
  setSimulationPhase: (p: string) => void;

  timelineEvents: TimelineEventLite[];
  addTimelineEvent: (e: TimelineEventLite) => void;
  clearTimelineEvents: () => void;

  resources: ResourceUnit[];
  setResources: (r: ResourceUnit[]) => void;

  alerts: AlertItem[];
  addAlert: (a: AlertItem) => void;

  beforeMetrics: Record<string, number>;
  afterMetrics: Record<string, number>;
  setBeforeAfter: (before: Record<string, number>, after: Record<string, number>) => void;

  pipelineStatus: string;
  setPipelineStatus: (s: string) => void;

  resetLiveState: () => void;
}

export const useCrisisStore = create<CrisisStore>((set) => ({
  selectedCrisisId: null,
  setSelectedCrisis: (id) => set({ selectedCrisisId: id }),

  connectionStatus: 'connecting',
  setConnectionStatus: (connectionStatus) => set({ connectionStatus }),

  escalationLevel: 'watch',
  setEscalation: (escalationLevel) => set({ escalationLevel }),

  traces: [],
  addTrace: (step) => set((s) => ({ traces: [...s.traces, step].slice(-40) })),
  clearTraces: () => set({ traces: [] }),

  signals: [],
  addSignal: (sig) => set((s) => ({ signals: [sig, ...s.signals].slice(0, 50) })),
  clearSignals: () => set({ signals: [] }),

  executionLogs: [],
  addExecutionLog: (e) =>
    set((s) => ({ executionLogs: [e, ...s.executionLogs].slice(0, 80) })),
  clearExecutionLogs: () => set({ executionLogs: [] }),

  mapOverlays: [],
  setMapOverlays: (mapOverlays) => set({ mapOverlays }),
  mapHotspots: [],
  addMapHotspot: (h) =>
    set((s) => ({
      mapHotspots: [h, ...s.mapHotspots.filter((x) => x.id !== h.id)].slice(0, 30),
    })),
  mapMetrics: {},
  setMapMetrics: (mapMetrics) => set({ mapMetrics }),

  simulationFrame: null,
  setSimulationFrame: (simulationFrame) => set({ simulationFrame }),
  simulationPhase: 'idle',
  setSimulationPhase: (simulationPhase) => set({ simulationPhase }),

  timelineEvents: [],
  addTimelineEvent: (e) =>
    set((s) => ({ timelineEvents: [...s.timelineEvents, e].slice(-60) })),
  clearTimelineEvents: () => set({ timelineEvents: [] }),

  resources: [],
  setResources: (resources) => set({ resources }),

  alerts: [],
  addAlert: (a) => set((s) => ({ alerts: [a, ...s.alerts].slice(0, 20) })),

  beforeMetrics: {},
  afterMetrics: {},
  setBeforeAfter: (beforeMetrics, afterMetrics) => set({ beforeMetrics, afterMetrics }),

  pipelineStatus: 'idle',
  setPipelineStatus: (pipelineStatus) => set({ pipelineStatus }),

  resetLiveState: () =>
    set({
      traces: [],
      signals: [],
      executionLogs: [],
      mapOverlays: [],
      mapHotspots: [],
      mapMetrics: {},
      simulationFrame: null,
      simulationPhase: 'idle',
      timelineEvents: [],
      alerts: [],
      beforeMetrics: {},
      afterMetrics: {},
      pipelineStatus: 'idle',
    }),
}));
