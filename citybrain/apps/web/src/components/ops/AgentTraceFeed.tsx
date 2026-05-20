import { AGENT_LABELS } from '../../theme/tokens';

interface Trace {
  agent: string;
  status: string;
  thought?: string;
}

interface AgentTraceFeedProps {
  traces: Trace[];
  max?: number;
}

export function AgentTraceFeed({ traces, max = 20 }: AgentTraceFeedProps) {
  if (traces.length === 0) {
    return (
      <div className="trace-empty">
        <span className="trace-empty__pulse" />
        <p>Waiting for autonomous agent activity…</p>
        <p className="trace-empty__hint">Launch Karachi demo to start the 9-agent pipeline</p>
      </div>
    );
  }

  return (
    <ul className="trace-feed">
      {traces.slice(0, max).map((t, i) => (
        <li
          key={`${t.agent}-${t.status}-${i}`}
          className={`trace-feed__item trace-feed__item--${t.status} ${i === 0 ? 'trace-feed__item--new' : ''}`}
        >
          <div className="trace-feed__meta">
            <span className="trace-feed__agent">
              {AGENT_LABELS[t.agent] ?? t.agent}
            </span>
            <span className={`trace-feed__status trace-feed__status--${t.status}`}>
              {t.status}
            </span>
          </div>
          {t.thought && <p className="trace-feed__thought">{t.thought}</p>}
        </li>
      ))}
    </ul>
  );
}
