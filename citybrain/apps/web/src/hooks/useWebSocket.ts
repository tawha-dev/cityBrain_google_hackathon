import { useEffect } from 'react';
import { getWsUrl } from '../lib/api';
import { useOpsStore } from '../lib/store';

export function useWebSocket() {
  const pushTrace = useOpsStore((s) => s.pushTrace);
  const pushSignal = useOpsStore((s) => s.pushSignal);
  const setConnectionStatus = useOpsStore((s) => s.setConnectionStatus);
  const setPipelineStatus = useOpsStore((s) => s.setPipelineStatus);
  const notifyCitizenUpdate = useOpsStore((s) => s.notifyCitizenUpdate);
  const pushTrafficReroute = useOpsStore((s) => s.pushTrafficReroute);
  const upsertDispatchPosition = useOpsStore((s) => s.upsertDispatchPosition);

  useEffect(() => {
    let ws: WebSocket | null = null;
    let timer: ReturnType<typeof setTimeout>;
    let cancelled = false;

    function connect() {
      if (cancelled) return;
      setConnectionStatus('connecting');
      ws = new WebSocket(getWsUrl());

      ws.onopen = () => {
        setConnectionStatus('connected');
        ws?.send(JSON.stringify({ subscribe: { role: 'authority' } }));
      };

      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(String(ev.data)) as {
            type: string;
            payload?: Record<string, unknown>;
          };
          if (msg.type === 'agent.step' && msg.payload) {
            pushTrace({
              agent: String(msg.payload.agent ?? 'agent'),
              status: String(msg.payload.status ?? ''),
              thought: msg.payload.thought as string | undefined,
            });
          }
          if (msg.type === 'signal.new' && msg.payload) {
            pushSignal({
              id: String(msg.payload.id ?? ''),
              rawText: String(msg.payload.rawText ?? ''),
              source: String(msg.payload.source ?? ''),
            });
          }
          if (msg.type === 'pipeline.complete') setPipelineStatus('complete');
          if (msg.type === 'pipeline.failed') setPipelineStatus('failed');
          if (msg.type === 'citizen.report.updated') {
            setPipelineStatus('citizen');
            const p = msg.payload ?? {};
            notifyCitizenUpdate({
              crisisId: p.crisisId as string | undefined,
              reportId: p.reportId as string | undefined,
              validationScore: p.validationScore as number | undefined,
            });
          }
          if (msg.type === 'citizen.progress' && msg.payload?.label) {
            setPipelineStatus(String(msg.payload.step ?? 'citizen'));
          }
          if (msg.type === 'dispatch.rerouted' && msg.payload) {
            const p = msg.payload;
            const crisisId = String(p.crisisId ?? '');
            pushTrafficReroute({
              crisisId,
              unit: String(p.unit ?? 'unit'),
              facility: p.facility as string | undefined,
              reason: String(p.reason ?? 'Traffic reroute'),
              etaMinutes: Number(p.etaMinutes ?? 0),
              previousEtaMinutes: p.previousEtaMinutes as number | undefined,
              at: new Date().toISOString(),
            });
            if (crisisId && p.polyline) {
              upsertDispatchPosition(crisisId, {
                actionId: String(p.actionId ?? p.unit ?? 'unit'),
                unit: String(p.unit ?? 'unit'),
                facility: p.facility as string | undefined,
                lat: Number((p as { lat?: number }).lat ?? 0),
                lng: Number((p as { lng?: number }).lng ?? 0),
                etaMinutes: Number(p.etaMinutes ?? 0),
                routePolyline: p.polyline as Array<{ lat: number; lng: number }>,
                rerouteCount: 1,
              });
            }
          }
          if (
            (msg.type === 'dispatch.position' || msg.type === 'dispatch.eta_update') &&
            msg.payload
          ) {
            const p = msg.payload;
            const crisisId = String(p.crisisId ?? '');
            if (crisisId && p.lat != null && p.lng != null) {
              upsertDispatchPosition(crisisId, {
                actionId: String(p.actionId ?? p.unit ?? 'unit'),
                unit: String(p.unit ?? 'unit'),
                facility: p.facility as string | undefined,
                lat: Number(p.lat),
                lng: Number(p.lng),
                etaMinutes: Number(p.etaMinutes ?? 0),
                progress: Number(p.progress ?? 0),
                distanceRemainingMeters: p.distanceRemainingMeters as number | undefined,
                arrived: Boolean(p.arrived),
                routePolyline: p.routePolyline as Array<{ lat: number; lng: number }> | undefined,
                rerouteCount: Number(p.rerouteCount ?? 0),
              });
            }
          }
          if (msg.type === 'dispatch.updated' && msg.payload) {
            const p = msg.payload;
            const crisisId = String(p.crisisId ?? '');
            const units = p.units as Array<Record<string, unknown>> | undefined;
            if (crisisId && units?.length) {
              for (const u of units) {
                if (u.lat != null && u.lng != null) {
                  upsertDispatchPosition(crisisId, {
                    actionId: String(u.actionId ?? u.unit ?? 'unit'),
                    unit: String(u.unit ?? 'unit'),
                    facility: u.facility as string | undefined,
                    lat: Number(u.lat),
                    lng: Number(u.lng),
                    etaMinutes: Number(u.etaMinutes ?? 0),
                    routePolyline: u.routePolyline as Array<{ lat: number; lng: number }> | undefined,
                  });
                }
              }
            }
          }
        } catch {
          /* ignore */
        }
      };

      ws.onclose = () => {
        setConnectionStatus('disconnected');
        timer = setTimeout(connect, 3000);
      };
    }

    connect();
    return () => {
      cancelled = true;
      clearTimeout(timer);
      ws?.close();
    };
  }, [
    pushTrace,
    pushSignal,
    setConnectionStatus,
    setPipelineStatus,
    notifyCitizenUpdate,
    pushTrafficReroute,
    upsertDispatchPosition,
  ]);
}
