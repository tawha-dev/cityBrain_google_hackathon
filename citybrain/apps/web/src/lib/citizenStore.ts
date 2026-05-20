import { create } from 'zustand';

interface ProgressStep {
  step: string;
  label: string;
}

interface CitizenState {
  connectionStatus: 'connecting' | 'connected' | 'disconnected';
  progress: ProgressStep[];
  routeAlert: { message: string; route?: unknown } | null;
  addProgress: (step: ProgressStep) => void;
  setRouteAlert: (alert: { message: string; route?: unknown }) => void;
  setConnectionStatus: (s: CitizenState['connectionStatus']) => void;
  reset: () => void;
}

export const useCitizenStore = create<CitizenState>((set) => ({
  connectionStatus: 'disconnected',
  progress: [],
  routeAlert: null,
  addProgress: (step) =>
    set((s) => ({
      progress: [...s.progress.filter((p) => p.step !== step.step), step],
    })),
  setRouteAlert: (routeAlert) => set({ routeAlert }),
  setConnectionStatus: (connectionStatus) => set({ connectionStatus }),
  reset: () => set({ progress: [], routeAlert: null, connectionStatus: 'disconnected' }),
}));
