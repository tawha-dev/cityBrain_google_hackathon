import { WebSocketServer, WebSocket } from 'ws';
import type { WsEvent, WsSubscribeMessage } from '@citybrain/shared';

interface ClientMeta {
  role: 'authority' | 'citizen' | 'anonymous';
  reportId?: string;
  crisisId?: string;
}

const clients = new Map<WebSocket, ClientMeta>();

export function createWsServer(server: import('http').Server) {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws) => {
    clients.set(ws, { role: 'anonymous' });

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(String(raw)) as WsSubscribeMessage;
        if (msg.subscribe) {
          clients.set(ws, {
            role: msg.subscribe.role,
            reportId: msg.subscribe.reportId,
            crisisId: msg.subscribe.crisisId,
          });
          ws.send(
            JSON.stringify({
              type: 'connected',
              timestamp: new Date().toISOString(),
              payload: {
                message: `Subscribed as ${msg.subscribe.role}`,
                reportId: msg.subscribe.reportId,
              },
            })
          );
        }
      } catch {
        /* ignore malformed */
      }
    });

    ws.on('close', () => clients.delete(ws));

    ws.send(
      JSON.stringify({
        type: 'connected',
        timestamp: new Date().toISOString(),
        payload: { message: 'CityBrain AI command link established' },
      })
    );
  });

  return wss;
}

function shouldReceive(meta: ClientMeta, event: WsEvent): boolean {
  if (meta.role === 'authority') return true;
  if (meta.role === 'anonymous') return true;

  if (meta.role === 'citizen') {
    if (event.reportId && meta.reportId === event.reportId) return true;
    if (event.crisisId && meta.crisisId === event.crisisId) return true;
    const payload = event.payload as { reportId?: string } | undefined;
    if (payload?.reportId && meta.reportId === payload.reportId) return true;
    if (
      event.type === 'citizen.report.updated' ||
      event.type === 'citizen.progress' ||
      event.type === 'citizen.alert' ||
      event.type === 'dispatch.updated' ||
      event.type === 'dispatch.rerouted' ||
      event.type === 'dispatch.position' ||
      event.type === 'dispatch.eta_update'
    ) {
      return Boolean(meta.reportId && (event.reportId === meta.reportId || payload?.reportId === meta.reportId));
    }
    if (event.type === 'pipeline.complete' || event.type === 'pipeline.failed') {
      if (event.reportId && meta.reportId === event.reportId) return true;
      const payload = event.payload as { reportId?: string } | undefined;
      if (payload?.reportId && meta.reportId === payload.reportId) return true;
      return Boolean(meta.crisisId && event.crisisId === meta.crisisId);
    }
    if (event.type === 'agent.step' || event.type === 'crisis.updated') {
      return Boolean(meta.crisisId && event.crisisId === meta.crisisId);
    }
    return false;
  }

  return false;
}

export function broadcast(event: WsEvent) {
  const msg = JSON.stringify(event);
  for (const [client, meta] of clients) {
    if (client.readyState === WebSocket.OPEN && shouldReceive(meta, event)) {
      client.send(msg);
    }
  }
}

/** Broadcast to all clients regardless of subscription (e.g. signal.new for authority). */
export function broadcastAll(event: WsEvent) {
  const msg = JSON.stringify(event);
  for (const client of clients.keys()) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  }
}
