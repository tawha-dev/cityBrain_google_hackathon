interface ReportStepsProps {
  step: 1 | 2 | 3;
}

const STEPS = [
  { n: 1, label: 'Location' },
  { n: 2, label: 'Details' },
  { n: 3, label: 'Transmit' },
];

export function ReportSteps({ step }: ReportStepsProps) {
  return (
    <ol className="report-steps" aria-label="Report progress">
      {STEPS.map((s) => {
        const done = step > s.n;
        const active = step === s.n;
        return (
          <li
            key={s.n}
            className={`report-steps__item ${done ? 'report-steps__item--done' : ''} ${active ? 'report-steps__item--active' : ''}`}
          >
            <span className="report-steps__num">{done ? '✓' : s.n}</span>
            <span className="report-steps__label">{s.label}</span>
          </li>
        );
      })}
    </ol>
  );
}
