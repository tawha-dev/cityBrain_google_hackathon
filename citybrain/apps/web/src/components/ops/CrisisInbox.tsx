import { Link, useParams } from 'react-router-dom';
import type { CrisisRow } from '../../lib/api';

interface CrisisInboxProps {
  crises: CrisisRow[];
  loading?: boolean;
}

function escalationTone(level: string): string {
  const l = level.toLowerCase();
  if (l.includes('critical')) return 'critical';
  if (l.includes('operational')) return 'operational';
  if (l.includes('advisory')) return 'advisory';
  return 'watch';
}

function statusTone(status: string): string {
  const s = status.toLowerCase();
  if (s.includes('executing') || s.includes('active')) return 'active';
  if (s.includes('resolved')) return 'resolved';
  return 'default';
}

export function CrisisInbox({ crises, loading }: CrisisInboxProps) {
  const { id: activeId } = useParams();

  if (loading) {
    return <div className="inbox-loading">Syncing crisis registry…</div>;
  }

  if (crises.length === 0) {
    return (
      <div className="inbox-empty">
        <p>No active crises</p>
        <p className="inbox-empty__hint">
          <Link to="/report">Report a live accident</Link> or run the Karachi demo
        </p>
      </div>
    );
  }

  return (
    <ul className="crisis-inbox">
      {crises.map((c) => {
        const esc = escalationTone(c.escalation_level);
        const st = statusTone(c.status);
        const isActive = activeId === c.id;
        return (
          <li key={c.id}>
            <Link
              to={`/crisis/${c.id}`}
              className={`crisis-card crisis-card--${esc} ${isActive ? 'crisis-card--selected' : ''}`}
            >
              <div className="crisis-card__top">
                <span className={`crisis-card__badge crisis-card__badge--${esc}`}>
                  {c.escalation_level}
                </span>
                <span className={`crisis-card__status crisis-card__status--${st}`}>
                  {c.status}
                </span>
              </div>
              <h3 className="crisis-card__title">{c.title}</h3>
              <p className="crisis-card__meta">
                {c.type}
                {c.area_label ? ` · ${c.area_label}` : ''}
                {c.citizen_origin && <span className="crisis-card__citizen"> · Citizen live</span>}
              </p>
              {(c.validation_score != null || c.confidence != null) && (
                <div className="crisis-card__confidence" title="Validation confidence">
                  <span
                    style={{
                      width: `${c.validation_score ?? Math.round((c.confidence ?? 0) * 100)}%`,
                    }}
                  />
                  <span className="crisis-card__score">
                    {c.validation_score ?? Math.round((c.confidence ?? 0) * 100)}%
                  </span>
                </div>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
