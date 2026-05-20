interface MetricCardProps {
  label: string;
  value: string | number;
  hint?: string;
  tone?: 'default' | 'ok' | 'warn' | 'danger' | 'info';
  icon?: string;
}

export function MetricCard({ label, value, hint, tone = 'default', icon }: MetricCardProps) {
  return (
    <article className={`metric-card metric-card--${tone} metric-card--premium`}>
      <span className="metric-card__shine" aria-hidden />
      {icon && <span className="metric-card__icon" aria-hidden>{icon}</span>}
      <span className="metric-card__label">{label}</span>
      <span className="metric-card__value">{value}</span>
      {hint && <span className="metric-card__hint">{hint}</span>}
    </article>
  );
}
