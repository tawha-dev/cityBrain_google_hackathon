import {
  getDispatchActionsForIncident,
  normalizeIncidentKind,
  type IncidentKind,
} from '../../lib/incidentProfiles';
import type { DispatchLogEntry, DispatchUnitResult } from '../../lib/api';

interface DispatchConsoleProps {
  note: string;
  onNoteChange: (v: string) => void;
  dispatching: boolean;
  rerouting?: boolean;
  crisisType?: string;
  reportCategory?: string;
  incidentKind?: string;
  selectedCount?: number;
  lastResult?: DispatchUnitResult[] | null;
  dispatchedAt?: string | null;
  lastReroute?: boolean;
  error?: string | null;
  history?: DispatchLogEntry[];
  onDispatch: (units: string[]) => void;
  onReroute?: () => void;
}

export function DispatchConsole({
  note,
  onNoteChange,
  dispatching,
  rerouting,
  crisisType,
  reportCategory,
  incidentKind,
  selectedCount = 0,
  lastResult,
  dispatchedAt,
  lastReroute,
  error,
  history = [],
  onDispatch,
  onReroute,
}: DispatchConsoleProps) {
  const kind: IncidentKind =
    (incidentKind as IncidentKind) ||
    normalizeIncidentKind(reportCategory, crisisType);

  const actions = getDispatchActionsForIncident(kind);

  const showReroute =
    onReroute &&
    (kind === 'accident' ||
      kind === 'flood' ||
      kind === 'urban_flood' ||
      crisisType === 'accident' ||
      crisisType === 'road_blockage');

  return (
    <div className="dispatch-console">
      {error && (
        <div className="dispatch-console__alert dispatch-console__alert--error" role="alert">
          <strong>Dispatch failed</strong>
          <p>{error}</p>
        </div>
      )}

      {(lastReroute || (lastResult && lastResult.length > 0)) && !dispatching && !error && (
        <div className="dispatch-console__alert dispatch-console__alert--success" role="status">
          <strong>{lastReroute ? '✓ Reroute applied' : '✓ Dispatch confirmed'}</strong>
          {!lastReroute && (
            <ul className="dispatch-console__result-list">
              {(lastResult ?? []).map((u) => (
                <li key={u.actionId}>
                  <span className="dispatch-console__result-unit">{u.unit}</span>
                  {u.facility ? (
                    <>
                      {' → '}
                      <span className="dispatch-console__result-facility">{u.facility}</span>
                    </>
                  ) : null}
                  {u.etaMinutes != null ? (
                    <span className="dispatch-console__result-eta"> · ETA {u.etaMinutes} min</span>
                  ) : null}
                  <span className="dispatch-console__result-meta">
                    {' '}
                    · {u.routeSource === 'google_routes' ? 'Google Routes ETA' : 'estimated ETA'}
                    {u.facilitySource === 'fallback' ? ' · demo facility list' : ''}
                    {u.facilitySource === 'manual_selection' ? ' · your selection' : ''}
                  </span>
                  <span className="dispatch-console__action-id" title="Database action ID">
                    ID {String(u.actionId).slice(0, 8)}…
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="dispatch-console__result-note">
            {dispatchedAt
              ? `Recorded ${new Date(dispatchedAt).toLocaleString()} · crisis → executing · citizen WS notified`
              : 'Crisis status set to executing · citizen notified via live link'}
          </p>
        </div>
      )}

      <label className="dispatch-console__label" htmlFor="dispatch-note">
        Authority directive
      </label>
      <textarea
        id="dispatch-note"
        className="dispatch-console__note"
        value={note}
        onChange={(e) => onNoteChange(e.target.value)}
        rows={2}
        placeholder="Dispatch per authority approval…"
        disabled={dispatching || rerouting}
      />

      <p className="dispatch-console__help">
        {selectedCount > 0
          ? `${selectedCount} facility selected — dispatch uses your selection.`
          : 'No facility selected — nearest matching assets auto-assigned.'}
      </p>

      <div
        className={`dispatch-console__actions dispatch-console__actions--wrap ${dispatching || rerouting ? 'dispatch-console__actions--busy' : ''}`}
      >
        {actions.map((a) => (
          <button
            key={a.id}
            type="button"
            className={`dispatch-btn dispatch-btn--${a.tone}`}
            disabled={dispatching || rerouting}
            onClick={() => onDispatch(a.units)}
          >
            <span className="dispatch-btn__icon" aria-hidden>
              {dispatching ? '…' : a.icon}
            </span>
            <span className="dispatch-btn__label">{a.label}</span>
          </button>
        ))}
        {showReroute && (
          <button
            type="button"
            className="dispatch-btn dispatch-btn--danger dispatch-btn--wide"
            disabled={dispatching || rerouting}
            onClick={onReroute}
          >
            <span className="dispatch-btn__icon" aria-hidden>
              {rerouting ? '…' : '↻'}
            </span>
            <span className="dispatch-btn__label">Reroute Traffic</span>
          </button>
        )}
      </div>

      {(dispatching || rerouting) && (
        <p className="dispatch-console__sending" aria-live="polite">
          <span className="dispatch-console__spinner" aria-hidden />
          {rerouting ? 'Applying traffic reroute…' : 'Transmitting dispatch order to emergency assets…'}
        </p>
      )}

      {history.length > 0 && (
        <div className="dispatch-console__history">
          <h4 className="dispatch-console__history-title">Dispatch log</h4>
          <ul>
            {history.slice(0, 5).map((h) => (
              <li key={String(h.id)}>
                <span className="dispatch-console__history-time">
                  {h.createdAt ? new Date(h.createdAt).toLocaleTimeString() : '—'}
                </span>
                <span className="dispatch-console__history-text">
                  {h.title ?? h.type}
                  {h.facility ? ` · ${h.facility}` : ''}
                  {h.etaMinutes != null ? ` · ${h.etaMinutes}m` : ''}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
