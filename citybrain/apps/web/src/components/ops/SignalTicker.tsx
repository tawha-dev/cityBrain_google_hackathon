import { SOURCE_ICONS } from '../../theme/tokens';

interface Signal {
  id: string;
  rawText: string;
  source: string;
}

interface SignalTickerProps {
  signals: Signal[];
}

export function SignalTicker({ signals }: SignalTickerProps) {
  if (signals.length === 0) {
    return (
      <div className="signal-empty">
        <div className="signal-empty__wave" aria-hidden />
        <p>No live signals yet</p>
      </div>
    );
  }

  return (
    <ul className="signal-ticker">
      {signals.map((s, i) => (
        <li key={s.id || i} className={`signal-ticker__item ${i === 0 ? 'signal-ticker__item--new' : ''}`}>
          <span className="signal-ticker__icon" aria-hidden>
            {SOURCE_ICONS[s.source] ?? '●'}
          </span>
          <div className="signal-ticker__content">
            <span className="signal-ticker__source">{s.source}</span>
            <p className="signal-ticker__text">{s.rawText}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
