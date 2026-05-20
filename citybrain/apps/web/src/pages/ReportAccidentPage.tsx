import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LocationPicker } from '../components/citizen/LocationPicker';
import { Panel } from '../components/ui/Panel';
import { ReportSteps } from '../components/ui/ReportSteps';
import { getDeviceId } from '../lib/device';
import { postCitizenReport } from '../lib/api';
import { useCitizenStore } from '../lib/citizenStore';
import { REPORT_CATEGORIES } from '../lib/incidentProfiles';

const DEFAULT_LAT = 24.8607;
const DEFAULT_LNG = 67.0011;

export default function ReportAccidentPage() {
  const navigate = useNavigate();
  const reset = useCitizenStore((s) => s.reset);
  const [category, setCategory] = useState<string>('accident');
  const [rawText, setRawText] = useState('');
  const [lat, setLat] = useState(DEFAULT_LAT);
  const [lng, setLng] = useState(DEFAULT_LNG);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    reset();
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLat(pos.coords.latitude);
          setLng(pos.coords.longitude);
        },
        () => {
          /* keep default Karachi coords */
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    }
  }, [reset]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = rawText.trim();
    if (text.length < 10) {
      setError('Please describe the accident in at least 10 characters.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const deviceId = getDeviceId();
      const res = await postCitizenReport(
        {
          rawText: text,
          category,
          language: 'en',
          location: { lat, lng },
        },
        deviceId
      );
      navigate(`/report/${res.reportId}?crisisId=${res.crisisId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit report. Is the API running?');
    } finally {
      setSubmitting(false);
    }
  }

  const step = rawText.trim().length >= 10 ? 3 : 2;

  return (
    <div className="report-page page-shell">
      <section className="report-hero report-hero--premium">
        <div className="report-hero__glow" aria-hidden />
        <div className="report-hero__badge">Live incident reporting</div>
        <ReportSteps step={step as 1 | 2 | 3} />
        <h1 className="report-hero__title">Report an emergency</h1>
        <p className="report-hero__desc">
          Flood, fire, earthquake, tsunami, accident, or any crisis — your live location triggers
          nearby hospitals, shelters, rescue, and dispatch-ready assets on the authority dashboard.
        </p>
      </section>

      <form className="report-form" onSubmit={handleSubmit}>
        <Panel title="Incident location" subtitle="GPS pin · tap map to adjust">
          <LocationPicker
            lat={lat}
            lng={lng}
            onChange={(a, b) => {
              setLat(a);
              setLng(b);
            }}
          />
        </Panel>

        <Panel title="Incident type" subtitle="Flood · fire · earthquake · accident · more" className="mt-panel">
          <div className="report-categories">
            {REPORT_CATEGORIES.map((c) => (
              <button
                key={c.key}
                type="button"
                className={`report-cat-btn ${category === c.key ? 'report-cat-btn--active' : ''}`}
                onClick={() => setCategory(c.key)}
              >
                <span aria-hidden>{c.emoji}</span> {c.label}
              </button>
            ))}
          </div>
        </Panel>

        <Panel title="What happened?" subtitle="Describe the situation in detail" className="mt-panel">
          <textarea
            className="report-form__textarea"
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            rows={5}
            placeholder="e.g. Two cars collided on the main road. One lane blocked, possible injuries…"
            required
            minLength={10}
          />
        </Panel>

        {error && <p className="report-form__error">{error}</p>}

        <button type="submit" className="btn btn--danger btn--glow report-form__submit" disabled={submitting}>
          {submitting ? 'Transmitting live case…' : '🚨 Send live emergency alert'}
        </button>
      </form>
    </div>
  );
}
