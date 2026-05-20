import { create } from 'zustand';

interface Trace {
  agent: string;
  status: string;
  thought?: string;
}

interface Signal {
  id: string;
  rawText: string;
  source: string;
}

interface CitizenUpdate {
  crisisId?: string;
  reportId?: string;
  validationScore?: number;
}

export interface TrafficRerouteAlert {
  crisisId: string;
  unit: string;
  facility?: string;
  reason: string;
  etaMinutes: number;
  previousEtaMinutes?: number;
  at: string;
}

export interface DispatchUnitPosition {
  actionId: string;
  unit: string;
  facility?: string;
  lat: number;
  lng: number;
  etaMinutes?: number;
  progress?: number;
  distanceRemainingMeters?: number;
  arrived?: boolean;
  routePolyline?: Array<{ lat: number; lng: number }>;
  rerouteCount?: number;
}

interface OpsState {
  connectionStatus: 'connecting' | 'connected' | 'disconnected';
  pipelineStatus: string;
  traces: Trace[];
  signals: Signal[];
  citizenUpdate: CitizenUpdate | null;
  lastTrafficReroute: TrafficRerouteAlert | null;
  dispatchPositions: Record<string, DispatchUnitPosition>;
  pushTrace: (t: Trace) => void;
  pushSignal: (s: Signal) => void;
  setConnectionStatus: (s: OpsState['connectionStatus']) => void;
  setPipelineStatus: (s: string) => void;
  notifyCitizenUpdate: (u: CitizenUpdate) => void;
  pushTrafficReroute: (a: TrafficRerouteAlert) => void;
  upsertDispatchPosition: (crisisId: string, unit: DispatchUnitPosition) => void;
  clearDispatchPositions: (crisisId: string) => void;
  reset: () => void;
}

export const useOpsStore = create<OpsState>((set) => ({
  connectionStatus: 'disconnected',
  pipelineStatus: 'idle',
  traces: [],
  signals: [],
  citizenUpdate: null,
  lastTrafficReroute: null,
  dispatchPositions: {},
  pushTrace: (t) => set((s) => ({ traces: [t, ...s.traces].slice(0, 40) })),
  pushTrafficReroute: (lastTrafficReroute) => set({ lastTrafficReroute }),
  upsertDispatchPosition: (crisisId, unit) =>
    set((s) => ({
      dispatchPositions: {
        ...s.dispatchPositions,
        [`${crisisId}:${unit.actionId}`]: unit,
      },
    })),
  clearDispatchPositions: (crisisId) =>
    set((s) => {
      const next = { ...s.dispatchPositions };
      for (const key of Object.keys(next)) {
        if (key.startsWith(`${crisisId}:`)) delete next[key];
      }
      return { dispatchPositions: next };
    }),
  pushSignal: (sig) => set((s) => ({ signals: [sig, ...s.signals].slice(0, 20) })),
  setConnectionStatus: (connectionStatus) => set({ connectionStatus }),
  setPipelineStatus: (pipelineStatus) => set({ pipelineStatus }),
  notifyCitizenUpdate: (citizenUpdate) => set({ citizenUpdate }),
  reset: () => set({ traces: [], signals: [], pipelineStatus: 'idle', citizenUpdate: null }),
}));
