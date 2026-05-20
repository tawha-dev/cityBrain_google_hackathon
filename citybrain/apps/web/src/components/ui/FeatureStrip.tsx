const FEATURES = [
  {
    icon: '◈',
    title: '9-Agent CIRO',
    desc: 'Autonomous pipeline from signal to dispatch',
    tone: 'cyan',
  },
  {
    icon: '◎',
    title: 'Live Fusion',
    desc: 'Weather · News · Social · Gemini reasoning',
    tone: 'blue',
  },
  {
    icon: '⬡',
    title: 'Citizen → Authority',
    desc: 'End-to-end incident with confidence score',
    tone: 'violet',
  },
] as const;

export function FeatureStrip() {
  return (
    <div className="feature-strip">
      {FEATURES.map((f) => (
        <article key={f.title} className={`feature-strip__card feature-strip__card--${f.tone}`}>
          <span className="feature-strip__icon" aria-hidden>
            {f.icon}
          </span>
          <div className="feature-strip__text">
            <h3>{f.title}</h3>
            <p>{f.desc}</p>
          </div>
        </article>
      ))}
    </div>
  );
}
