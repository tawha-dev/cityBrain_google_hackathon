import type { DispatchUnitPosition } from '../../lib/store';

interface LiveDispatchPanelProps {
  units: DispatchUnitPosition[];
}

export function LiveDispatchPanel({ units }: LiveDispatchPanelProps) {
  if (units.length === 0) return null;

  return (
    <div className="live-dispatch-panel" role="status">
      <h4 className="live-dispatch-panel__title">Live unit tracking</h4>
      <ul className="live-dispatch-panel__list">
        {units.map((u) => (
          <li key={u.actionId} className="live-dispatch-panel__item">
            <span className="live-dispatch-panel__unit">{u.unit}</span>
            {u.facility && (
              <span className="live-dispatch-panel__facility"> · {u.facility}</span>
            )}
            <span className="live-dispatch-panel__eta">
              {u.arrived
                ? ' · Arrived'
                : u.etaMinutes != null
                  ? ` · ETA ${u.etaMinutes} min`
                  : ''}
              {u.distanceRemainingMeters != null && !u.arrived
                ? ` · ${(u.distanceRemainingMeters / 1000).toFixed(1)} km`
                : ''}
              {u.progress != null && !u.arrived ? ` · ${Math.round(u.progress * 100)}%` : ''}
            </span>
            {u.rerouteCount != null && u.rerouteCount > 0 && (
              <span className="live-dispatch-panel__reroute">
                {' '}
                · rerouted ×{u.rerouteCount}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
