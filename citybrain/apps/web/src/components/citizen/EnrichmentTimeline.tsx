const STEPS = [
  { key: 'submitted', label: 'Report received' },
  { key: 'geocode', label: 'Location verified' },
  { key: 'weather', label: 'Weather checked' },
  { key: 'news', label: 'News scanned' },
  { key: 'social', label: 'Social signals analyzed' },
  { key: 'nearby', label: 'Nearby emergency assets' },
  { key: 'agents', label: 'AI agents running' },
  { key: 'complete', label: 'Authority notified' },
];

interface EnrichmentTimelineProps {
  activeSteps: string[];
  timeline?: Array<{ step: string; label: string }>;
}

export function EnrichmentTimeline({ activeSteps, timeline }: EnrichmentTimelineProps) {
  const done = new Set(activeSteps);
  const labels = new Map((timeline ?? []).map((t) => [t.step, t.label]));

  return (
    <ol className="enrichment-timeline">
      {STEPS.map((s) => {
        const isDone = done.has(s.key);
        const isActive =
          !isDone &&
          (s.key === 'agents'
            ? done.has('social') && !done.has('complete')
            : STEPS.findIndex((x) => x.key === s.key) === activeSteps.length);
        return (
          <li
            key={s.key}
            className={`enrichment-timeline__item ${isDone ? 'enrichment-timeline__item--done' : ''} ${isActive ? 'enrichment-timeline__item--active' : ''}`}
          >
            <span className="enrichment-timeline__dot" aria-hidden />
            <div>
              <span className="enrichment-timeline__label">{labels.get(s.key) ?? s.label}</span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
