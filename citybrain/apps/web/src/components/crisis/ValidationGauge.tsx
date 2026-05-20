interface ValidationGaugeProps {
  total: number;
  metrics: { label: string; value: number }[];
}

export function ValidationGauge({ total, metrics }: ValidationGaugeProps) {
  const circumference = 2 * Math.PI * 42;
  const offset = circumference - (total / 100) * circumference;
  const tone = total >= 75 ? 'ok' : total >= 50 ? 'warn' : 'danger';

  return (
    <div className="validation-gauge validation-gauge--animated">
      <div className="validation-gauge__ring-wrap">
        <svg viewBox="0 0 100 100" className="validation-gauge__svg">
          <circle cx="50" cy="50" r="42" className="validation-gauge__track" />
          <circle
            cx="50"
            cy="50"
            r="42"
            className={`validation-gauge__arc validation-gauge__arc--${tone}`}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
          />
        </svg>
        <div className={`validation-gauge__center validation-gauge__center--${tone}`}>
          <span className="validation-gauge__value">{total}</span>
          <span className="validation-gauge__unit">%</span>
        </div>
      </div>
      <ul className="validation-gauge__metrics">
        {metrics.map((m) => (
          <li key={m.label} className="validation-metric">
            <span className="validation-metric__label">{m.label}</span>
            <div className="validation-metric__bar">
              <span style={{ width: `${m.value}%` }} />
            </div>
            <span className="validation-metric__val">{m.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
