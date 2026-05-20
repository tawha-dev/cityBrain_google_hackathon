import { useEffect } from 'react';
import { getWsUrl } from '../lib/api';
import { useCrisisStore } from '../lib/store';
import { parseMapPayload } from '../lib/map/parseMapPayload';

export function useWebSocket() {
  const store = useCrisisStore;

  useEffect(() => {
    let ws: WebSocket;
    let reconnectTimer: ReturnType<typeof setTimeout>;

    const connect = () => {
      store.getState().setConnectionStatus('connecting');
      try {
        ws = new WebSocket(getWsUrl());
      } catch {
        store.getState().setConnectionStatus('disconnected');
        return;
      }

      ws.onopen = () => {
        store.getState().setConnectionStatus('connected');
        ws.send(JSON.stringify({ subscribe: { role: 'authority' } }));
      };

      ws.onclose = () => {
        store.getState().setConnectionStatus('disconnected');
        reconnectTimer = setTimeout(connect, 3000);
      };

      ws.onerror = () => store.getState().setConnectionStatus('disconnected');

      ws.onmessage = (ev) => {
        try {
          const event = JSON.parse(ev.data);
          const ts = event.timestamp ?? new Date().toISOString();
          const s = store.getState();

          if (event.type === 'connected') return;

          if (event.type === 'signal.new') {
            const payload = event.payload ?? {};
            const loc = payload.location as { lat?: number; lng?: number } | undefined;
            s.addSignal({
              id: payload.id,
              source: String(payload.source ?? 'field_report'),
              rawText: String(payload.rawText ?? payload.normalizedText ?? ''),
              areaLabel: payload.areaLabel,
              lat: loc?.lat,
              lng: loc?.lng,
              priority: payload.requiresImmediateAttention ? 'critical' : 'normal',
              timestamp: ts,
            });
            if (loc?.lat != null && loc?.lng != null) {
              s.addMapHotspot({
                id: String(payload.id ?? `sig-${Date.now()}`),
                lat: loc.lat,
                lng: loc.lng,
                label: String(payload.areaLabel ?? payload.source ?? 'Signal'),
                source: String(payload.source ?? 'signal'),
                priority: payload.requiresImmediateAttention ? 'critical' : 'normal',
              });
            }
          }

          if (event.type === 'agent.step') {
            if (event.payload?.status === 'started') {
              s.setPipelineStatus(`agent:${event.payload.agent}`);
            }
            if (event.payload?.status === 'completed') {
              s.addTrace({
                agent: event.payload.agent,
                status: event.payload.status,
                thought: event.payload.thought,
                latencyMs: event.payload.latencyMs,
                timestamp: ts,
              });
            }
          }

          if (event.type === 'escalation.changed') {
            s.setEscalation(event.payload?.level ?? 'operational');
          }

          if (event.type === 'action.executed') {
            s.addExecutionLog({
              id: `${event.payload?.actionId ?? Date.now()}`,
              tool: String(event.payload?.tool ?? 'execute'),
              status: String(event.payload?.status ?? 'success'),
              actionId: event.payload?.actionId,
              response: event.payload,
              timestamp: ts,
            });
          }

          if (event.type === 'map.delta' || event.type === 'simulation.frame') {
            const payload = event.payload ?? {};
            const parsed = parseMapPayload(payload);
            if (parsed.length > 0) s.setMapOverlays(parsed);
            if (payload.metrics) {
              s.setMapMetrics(payload.metrics as Record<string, number>);
            }
          }

          if (event.type === 'simulation.started') {
            s.setSimulationPhase('running');
            s.setPipelineStatus('simulation');
          }

          if (event.type === 'simulation.tick') {
            if (event.payload?.timelineEvent) {
              const te = event.payload.timelineEvent;
              s.addTimelineEvent({
                id: String(te.id ?? Date.now()),
                tick: Number(te.tick ?? 0),
                category: String(te.category ?? 'phase'),
                label: String(te.label ?? ''),
                timestamp: ts,
              });
            }
            if (event.payload?.metrics) {
              s.setMapMetrics(event.payload.metrics as Record<string, number>);
            }
          }

          if (event.type === 'simulation.frame') {
            const frame = event.payload;
            if (frame?.metrics) {
              s.setSimulationFrame({
                tick: Number(frame.tick ?? 0),
                phase: String(frame.phase ?? ''),
                metrics: {
                  congestionIndex: Number(frame.metrics.congestionIndex ?? 0),
                  floodCoverageKm2: Number(frame.metrics.floodCoverageKm2 ?? 0),
                  strandedVehicles: Number(frame.metrics.strandedVehicles ?? 0),
                  activeRescueUnits: Number(frame.metrics.activeRescueUnits ?? 0),
                },
                overlayCount: Array.isArray(frame.overlays) ? frame.overlays.length : 0,
              });
              s.setSimulationPhase(String(frame.phase ?? 'running'));
            }
          }

          if (event.type === 'simulation.completed') {
            s.setSimulationPhase('complete');
            s.setPipelineStatus('complete');
          }

          if (event.type === 'dashboard.updated') {
            const m = (event.payload as { metrics?: Record<string, number> })?.metrics;
            if (m) s.setMapMetrics(m);
            const phase = (event.payload as { mapState?: { phase?: string } })?.mapState?.phase;
            if (phase === 'before') {
              s.setBeforeAfter(m ?? {}, s.afterMetrics);
            }
            if (phase === 'after') {
              s.setBeforeAfter(s.beforeMetrics, m ?? {});
            }
          }

          if (event.type === 'pipeline.complete') {
            s.setPipelineStatus('complete');
          }

          if (event.type === 'pipeline.replan') {
            s.setPipelineStatus('replan');
            s.setEscalation('critical');
          }

          if (event.type === 'crisis.updated') {
            s.setPipelineStatus(String(event.payload?.status ?? 'active'));
          }
        } catch {
          /* ignore */
        }
      };
    };

    connect();
    return () => {
      clearTimeout(reconnectTimer);
      ws?.close();
    };
  }, []);
}
