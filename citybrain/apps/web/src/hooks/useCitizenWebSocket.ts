import { useEffect, useRef } from 'react';
import { getWsUrl } from '../lib/api';
import { useCitizenStore } from '../lib/citizenStore';

export function useCitizenWebSocket(reportId?: string, crisisId?: string) {
  const setConnectionStatus = useCitizenStore((s) => s.setConnectionStatus);
  const addProgress = useCitizenStore((s) => s.addProgress);
  const setRouteAlert = useCitizenStore((s) => s.setRouteAlert);

  useEffect(() => {
    if (!reportId) return;

    let cancelled = false;
    let reconnectTimer: ReturnType<typeof setTimeout>;

    function connect() {
      if (cancelled) return;
      setConnectionStatus('connecting');
      const ws = new WebSocket(getWsUrl());

      ws.onopen = () => {
        setConnectionStatus('connected');
        ws.send(JSON.stringify({ subscribe: { role: 'citizen', reportId, crisisId } }));
      };

      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(String(ev.data)) as {
            type: string;
            payload?: { step?: string; label?: string; message?: string; route?: unknown };
          };
          if (msg.type === 'citizen.progress' && msg.payload?.label) {
            addProgress({
              step: msg.payload.step ?? 'progress',
              label: msg.payload.label,
            });
          }
          if (msg.type === 'citizen.alert' && msg.payload) {
            setRouteAlert({
              message: msg.payload.message ?? 'Alert from authorities',
              route: msg.payload.route,
            });
          }
          if (msg.type === 'dispatch.updated') {
            addProgress({ step: 'dispatched', label: 'Emergency units dispatched to your location' });
          }
        } catch {
          /* ignore */
        }
      };

      ws.onclose = () => {
        setConnectionStatus('disconnected');
        if (!cancelled) reconnectTimer = setTimeout(connect, 3000);
      };

      ws.onerror = () => ws.close();
    }

    connect();
    return () => {
      cancelled = true;
      clearTimeout(reconnectTimer);
    };
  }, [reportId, crisisId, setConnectionStatus, addProgress, setRouteAlert]);
}
