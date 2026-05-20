interface PanelProps {
  title?: string;
  subtitle?: string;
  accent?: 'cyan' | 'warn' | 'danger' | 'info';
  className?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}

export function Panel({
  title,
  subtitle,
  accent = 'cyan',
  className = '',
  children,
  action,
}: PanelProps) {
  return (
    <section className={`panel panel--${accent} panel--glass ${className}`.trim()}>
      <span className="panel__corner panel__corner--tl" aria-hidden />
      <span className="panel__corner panel__corner--br" aria-hidden />
      {(title || action) && (
        <header className="panel__head">
          <div>
            {title && <h2 className="panel__title">{title}</h2>}
            {subtitle && <p className="panel__subtitle">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      <div className="panel__body">{children}</div>
    </section>
  );
}
