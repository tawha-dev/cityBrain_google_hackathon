import { useMemo } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { EnrichmentTimeline } from '../components/citizen/EnrichmentTimeline';
import { TacticalMap } from '../components/crisis/TacticalMap';
import { ValidationGauge } from '../components/crisis/ValidationGauge';
import { Panel } from '../components/ui/Panel';
import { useCitizenWebSocket } from '../hooks/useCitizenWebSocket';
import { fetchCitizenReport } from '../lib/api';
import { useCitizenStore } from '../lib/citizenStore';
import { getDeviceId } from '../lib/device';

export default function ReportStatusPage() {
  const { reportId } = useParams<{ reportId: string }>();
  const [search] = useSearchParams();
  const crisisId = search.get('crisisId') ?? undefined;
  const deviceId = getDeviceId();

  const wsProgress = useCitizenStore((s) => s.progress);
  const routeAlert = useCitizenStore((s) => s.routeAlert);
  const connectionStatus = useCitizenStore((s) => s.connectionStatus);

  useCitizenWebSocket(reportId, crisisId);

  const { data } = useQuery({
    queryKey: ['citizen-report', reportId],
    queryFn: () => fetchCitizenReport(reportId!, deviceId),
    enabled: Boolean(reportId),
    refetchInterval: 4000,
  });

  const report = data?.report;
  const activeSteps = useMemo(() => {
    const fromApi = (report?.timeline ?? []).map((t) => t.step);
    const fromWs = wsProgress.map((p) => p.step);
    return [...new Set([...fromApi, ...fromWs, report?.status === 'authority_notified' ? 'complete' : ''])].filter(
      Boolean
    ) as string[];
  }, [report, wsProgress]);

  const validation = report?.validation;
  const score = report?.validationScore ?? validation?.total ?? null;
  const isComplete = report?.status === 'authority_notified' || activeSteps.includes('complete');

  return (
    <div className="report-page report-page--status page-shell">
      <section className="report-hero report-hero--premium">
        <div className="report-hero__glow" aria-hidden />
        <div className="report-hero__badge report-hero__badge--pulse">
          {isComplete ? '✓ Authority notified' : 'Live verification in progress'}
        </div>
        <h1 className="report-hero__title">Your accident report</h1>
        <p className="report-hero__desc">
          CityBrain is cross-checking weather, news, social signals, and running 9 AI agents.
          {crisisId && (
            <>
              {' '}
              Authorities see this in the{' '}
              <Link to={`/crisis/${crisisId}`}>operations dossier</Link>.
            </>
          )}
        </p>
        <p className="report-status__link">
          Link status: <span className={`tag tag--${connectionStatus === 'connected' ? 'ok' : 'default'}`}>{connectionStatus}</span>
        </p>
      </section>

      <div className="report-status-grid">
        <Panel title="Your location" subtitle="Shared with emergency operations">
          <TacticalMap
            lat={report?.lat}
            lng={report?.lng}
            label={report?.areaLabel ?? 'Accident site'}
            crisisType="accident"
          />
        </Panel>

        <Panel title="Verification pipeline" subtitle="Weather · News · OpenRouter/Gemini agents">
          <EnrichmentTimeline activeSteps={activeSteps} timeline={report?.timeline} />
        </Panel>

        {score != null && validation && (
          <Panel title="Confidence score" subtitle="Fused validation before authority action">
            <ValidationGauge
              total={score}
              metrics={[
                { label: 'Geolocation', value: validation.geolocation },
                { label: 'Weather', value: validation.weather },
                { label: 'News', value: validation.news },
                { label: 'Social', value: validation.social },
                { label: 'Agent confidence', value: validation.agentConfidence },
              ]}
            />
          </Panel>
        )}

        {routeAlert && (
          <Panel title="Authority response" subtitle="Official directive">
            <p className="social-summary">{routeAlert.message}</p>
          </Panel>
        )}

        {isComplete && crisisId && (
          <div className="report-status__actions">
            <Link to={`/crisis/${crisisId}`} className="btn btn--primary">
              View on authority dashboard →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
