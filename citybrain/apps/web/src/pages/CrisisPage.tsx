import { useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  fetchApi,
  postApi,
  type Dossier,
  type EmergencyResource,
  type DispatchTarget,
  type DispatchResponse,
  type DispatchUnitResult,
} from '../lib/api';
import { useOpsStore } from '../lib/store';
import { Panel } from '../components/ui/Panel';
import { CrisisInbox } from '../components/ops/CrisisInbox';
import { AgentTraceFeed } from '../components/ops/AgentTraceFeed';
import { TacticalMap } from '../components/crisis/TacticalMap';
import { ValidationGauge } from '../components/crisis/ValidationGauge';
import { DispatchConsole } from '../components/crisis/DispatchConsole';
import { LiveDispatchPanel } from '../components/crisis/LiveDispatchPanel';
import { NearbyResourcesPanel } from '../components/crisis/NearbyResourcesPanel';
import type { MapRoutePolyline } from '../components/map/GoogleMapView';
import { EnrichmentTimeline } from '../components/citizen/EnrichmentTimeline';
import { normalizeIncidentKind } from '../lib/incidentProfiles';

const FACILITY_COLORS: Record<string, string> = {
  hospital: '#ff6b8a',
  fire_station: '#ff9f43',
  police: '#5b8cff',
  ambulance: '#00e5a0',
  shelter: '#c77dff',
  evacuation: '#ffd43b',
  rescue: '#51cf66',
  civil_defense: '#74c0fc',
  pharmacy: '#ffa8a8',
  blood_bank: '#e03131',
  coast_guard: '#339af0',
};

export default function CrisisPage() {
  const { id } = useParams<{ id: string }>();
  const wsTraces = useOpsStore((s) => s.traces);
  const lastTrafficReroute = useOpsStore((s) => s.lastTrafficReroute);
  const dispatchPositions = useOpsStore((s) => s.dispatchPositions);
  const [checkingTraffic, setCheckingTraffic] = useState(false);
  const [dispatching, setDispatching] = useState(false);
  const [rerouting, setRerouting] = useState(false);
  const [note, setNote] = useState('Dispatch per authority approval');
  const [selectedResources, setSelectedResources] = useState<EmergencyResource[]>([]);
  const [lastDispatch, setLastDispatch] = useState<DispatchUnitResult[] | null>(null);
  const [lastDispatchedAt, setLastDispatchedAt] = useState<string | null>(null);
  const [lastReroute, setLastReroute] = useState(false);
  const [dispatchError, setDispatchError] = useState<string | null>(null);

  const { data: dossier, refetch } = useQuery({
    queryKey: ['dossier', id],
    queryFn: () => fetchApi<Dossier>(`/crises/${id}/dossier`),
    enabled: Boolean(id),
    refetchInterval: 6000,
  });

  const { data: crisisData, refetch: refetchCrisis } = useQuery({
    queryKey: ['crisis', id],
    queryFn: () => fetchApi<{ crisis: Record<string, unknown> }>(`/crises/${id}`),
    enabled: Boolean(id),
  });

  const { data: dispatchHistory, refetch: refetchDispatches } = useQuery({
    queryKey: ['dispatches', id],
    queryFn: () => fetchApi<{ dispatches: import('../lib/api').DispatchLogEntry[] }>(`/crises/${id}/dispatches`),
    enabled: Boolean(id),
    refetchInterval: 8000,
  });

  const { data: trackingData, refetch: refetchTracking } = useQuery({
    queryKey: ['tracking', id],
    queryFn: () =>
      fetchApi<{
        units: Array<{
          actionId: string;
          unit: string;
          facility?: string;
          lat: number;
          lng: number;
          etaMinutes?: number;
          progress?: number;
          distanceRemainingMeters?: number;
          arrived?: boolean;
          routePolyline?: Array<{ lat: number; lng: number }>;
          rerouteCount?: number;
        }>;
        trackingActive: boolean;
      }>(`/crises/${id}/tracking`),
    enabled: Boolean(id),
    refetchInterval: 6000,
  });

  const { data: crisesList } = useQuery({
    queryKey: ['crises'],
    queryFn: () => fetchApi<{ crises: import('../lib/api').CrisisRow[] }>('/crises'),
    refetchInterval: 10000,
  });

  const { data: nearbyData, isLoading: nearbyLoading } = useQuery({
    queryKey: ['nearby-resources', id],
    queryFn: () =>
      fetchApi<{ resources: EmergencyResource[] }>(`/crises/${id}/nearby-resources`),
    enabled: Boolean(id),
    staleTime: 120_000,
  });

  const nearbyResources = useMemo(() => {
    const fromDossier = dossier?.nearbyResources ?? [];
    const fromApi = nearbyData?.resources ?? [];
    return fromApi.length > 0 ? fromApi : fromDossier;
  }, [dossier?.nearbyResources, nearbyData?.resources]);

  const selectedIds = useMemo(
    () => new Set(selectedResources.map((r) => r.placeId)),
    [selectedResources]
  );

  const facilityMarkers = useMemo(
    () =>
      nearbyResources.map((r) => ({
        lat: r.lat,
        lng: r.lng,
        label: r.name,
        color: FACILITY_COLORS[r.category] ?? '#3b8bff',
        selected: selectedIds.has(r.placeId),
      })),
    [nearbyResources, selectedIds]
  );

  const liveUnits = useMemo(() => {
    const fromWs = id
      ? Object.entries(dispatchPositions)
          .filter(([key]) => key.startsWith(`${id}:`))
          .map(([, u]) => u)
      : [];
    if (fromWs.length > 0) return fromWs;
    return (trackingData?.units ?? []).map((u) => ({
      actionId: u.actionId,
      unit: u.unit,
      facility: u.facility,
      lat: u.lat,
      lng: u.lng,
      etaMinutes: u.etaMinutes,
      progress: u.progress,
      distanceRemainingMeters: u.distanceRemainingMeters,
      arrived: u.arrived,
      routePolyline: u.routePolyline,
      rerouteCount: u.rerouteCount,
    }));
  }, [dispatchPositions, id, trackingData?.units]);

  const unitMarkers = useMemo(
    () =>
      liveUnits.map((u) => ({
        lat: u.lat,
        lng: u.lng,
        label: u.unit,
        isUnit: true,
        etaMinutes: u.etaMinutes,
      })),
    [liveUnits]
  );

  const routePolylines = useMemo((): MapRoutePolyline[] => {
    return liveUnits
      .filter((u) => u.routePolyline && u.routePolyline.length >= 2)
      .map((u) => ({
        points: u.routePolyline!,
        color: (u.rerouteCount ?? 0) > 0 ? '#ff9f43' : '#3b8bff',
        dashed: (u.rerouteCount ?? 0) > 0,
      }));
  }, [liveUnits]);

  const { data: apiTraces } = useQuery({
    queryKey: ['traces', id],
    queryFn: () =>
      fetchApi<{
        traces: Array<{
          agent_name: string;
          status?: string;
          traces?: Array<{ thought?: string }>;
          output_json?: { summary?: string };
        }>;
      }>(`/crises/${id}/traces`),
    enabled: Boolean(id),
  });

  const traces = useMemo(() => {
    if (wsTraces.length > 0) {
      return wsTraces.map((t) => ({
        agent: t.agent,
        status: t.status,
        thought: t.thought,
      }));
    }
    return (apiTraces?.traces ?? []).map((t) => {
      const nested = Array.isArray(t.traces) ? t.traces[0] : undefined;
      return {
        agent: t.agent_name,
        status: t.status ?? 'completed',
        thought:
          nested?.thought ??
          (typeof t.output_json === 'object' && t.output_json?.summary
            ? String(t.output_json.summary)
            : undefined),
      };
    });
  }, [wsTraces, apiTraces]);

  function toggleResource(resource: EmergencyResource) {
    setSelectedResources((prev) => {
      const exists = prev.some((r) => r.placeId === resource.placeId);
      if (exists) return prev.filter((r) => r.placeId !== resource.placeId);
      return [...prev, resource];
    });
  }

  async function dispatch(units: string[]) {
    if (!id) return;
    setDispatching(true);
    setDispatchError(null);
    setLastReroute(false);
    setLastDispatch(null);
    setLastDispatchedAt(null);
    try {
      const targets: DispatchTarget[] | undefined =
        selectedResources.length > 0
          ? selectedResources.map((r) => ({
              placeId: r.placeId,
              name: r.name,
              lat: r.lat,
              lng: r.lng,
              category: r.category,
            }))
          : undefined;

      const result = await postApi<DispatchResponse>(`/crises/${id}/dispatch`, {
        units,
        note,
        targets,
      });

      if (result.status !== 'dispatched' || !result.units?.length) {
        throw new Error('Server did not confirm dispatch — no units assigned');
      }

      setLastDispatch(result.units);
      setLastDispatchedAt(result.dispatchedAt ?? new Date().toISOString());
      await Promise.all([refetch(), refetchCrisis(), refetchDispatches(), refetchTracking()]);
    } catch (err) {
      setLastDispatch(null);
      setLastDispatchedAt(null);
      setDispatchError(err instanceof Error ? err.message : 'Dispatch request failed');
    } finally {
      setDispatching(false);
    }
  }

  async function reroute() {
    if (!id) return;
    setRerouting(true);
    setDispatchError(null);
    setLastDispatch(null);
    setLastDispatchedAt(null);
    try {
      const result = await postApi<{ status: string; actionId?: string }>(`/crises/${id}/reroute`, {
        note: note || 'Authority-approved traffic reroute around accident zone',
      });
      if (result.status !== 'rerouted') {
        throw new Error('Server did not confirm reroute');
      }
      setLastReroute(true);
      setLastDispatchedAt(new Date().toISOString());
      await Promise.all([refetch(), refetchCrisis(), refetchDispatches(), refetchTracking()]);
    } catch (err) {
      setDispatchError(err instanceof Error ? err.message : 'Reroute request failed');
    } finally {
      setRerouting(false);
    }
  }

  const crisis = crisisData?.crisis;
  const report = dossier?.citizenReport;
  const validation = dossier?.validation;
  const title = String(crisis?.title ?? 'Crisis Dossier');
  const status = String(crisis?.status ?? 'unknown');
  const escalation = String(crisis?.escalation_level ?? 'watch');
  const crisisType = String(crisis?.type ?? 'flood');
  const incidentKind =
    dossier?.incidentKind ??
    normalizeIncidentKind(report?.category, crisisType);
  const incidentLabel = dossier?.incidentLabel ?? incidentKind.replace(/_/g, ' ');

  const rerouteForCrisis =
    lastTrafficReroute?.crisisId === id ? lastTrafficReroute : null;

  async function checkTrafficNow() {
    if (!id) return;
    setCheckingTraffic(true);
    try {
      await postApi(`/crises/${id}/dispatch/check-traffic`);
      await Promise.all([refetchDispatches(), refetchTracking()]);
    } finally {
      setCheckingTraffic(false);
    }
  }

  return (
    <div className="crisis-layout page-shell">
      <div className="crisis-layout__sidebar">
        <Panel title="Incident Queue" subtitle="Switch active crisis">
          <CrisisInbox crises={crisesList?.crises ?? []} />
        </Panel>
      </div>

      <div className="crisis-layout__main">
        <header className="crisis-header crisis-header--premium">
          <div>
            <Link to="/" className="crisis-header__back">
              ← Operations
            </Link>
            <h1 className="crisis-header__title">{title}</h1>
            <div className="crisis-header__tags">
              <span className={`tag tag--${escalation.includes('critical') ? 'critical' : 'default'}`}>
                {escalation}
              </span>
              <span className="tag tag--status">{status}</span>
              <span className="tag tag--type">{crisisType}</span>
            </div>
          </div>
          {validation && (
            <div className="crisis-header__score" title="AI validation score">
              <span className="crisis-header__score-val">{validation.total}%</span>
              <span className="crisis-header__score-label">confidence</span>
            </div>
          )}
        </header>

        <div className="crisis-dossier">
          <div className="crisis-dossier__row">
            <div className="crisis-dossier__col crisis-dossier__col--map-stack">
              <Panel
                title="Tactical Map"
                subtitle={liveUnits.length > 0 ? 'Live dispatch tracking' : 'Live incident centroid'}
                className="crisis-dossier__map-panel"
              >
                <TacticalMap
                  lat={report?.lat}
                  lng={report?.lng}
                  label={report?.areaLabel ?? String(crisis?.area_label ?? 'Karachi Metro')}
                  crisisType={crisisType}
                  height={240}
                  facilityMarkers={facilityMarkers}
                  unitMarkers={unitMarkers}
                  routePolylines={routePolylines}
                />
                <LiveDispatchPanel units={liveUnits} />
              </Panel>

              <Panel
                title="Nearby Emergency Assets"
                subtitle={`All incident types · ${incidentLabel}`}
              >
                <NearbyResourcesPanel
                  resources={nearbyResources}
                  selectedIds={selectedIds}
                  onToggle={toggleResource}
                  loading={nearbyLoading && nearbyResources.length === 0}
                  incidentLabel={incidentLabel}
                />
              </Panel>

              {dossier?.social && (
                <Panel title="Social Intel" subtitle="Media corroboration">
                  <p className="social-summary">{dossier.social.summary}</p>
                </Panel>
              )}

              {dossier?.timeline && dossier.timeline.length > 0 && (
                <Panel title="Ingest Pipeline" subtitle="Weather · News · Agents">
                  <EnrichmentTimeline
                    activeSteps={dossier.timeline.map((t) => t.step)}
                    timeline={dossier.timeline}
                  />
                </Panel>
              )}
            </div>

            <div className="crisis-dossier__col">
              <Panel title="Citizen Origin" subtitle="Field report">
                {!report ? (
                  <p className="muted-copy">No linked citizen report (demo scenario).</p>
                ) : (
                  <>
                    <blockquote className="citizen-quote citizen-quote--compact">{report.rawText}</blockquote>
                    <p className="citizen-meta">
                      {report.areaLabel ?? 'Unknown'} · {report.category}
                    </p>
                  </>
                )}
              </Panel>

              {validation && (
                <Panel title="AI Validation" subtitle="Confidence fusion">
                  <ValidationGauge
                    total={validation.total}
                    metrics={[
                      { label: 'Geolocation', value: validation.geolocation },
                      { label: 'Weather', value: validation.weather },
                      { label: 'News', value: validation.news },
                      { label: 'Social', value: validation.social },
                      { label: 'Agent', value: validation.agentConfidence },
                    ]}
                  />
                </Panel>
              )}

              <Panel title="Dispatch Console" subtitle="Auto traffic reroute · every 45s">
                {rerouteForCrisis && (
                  <div className="traffic-reroute-banner" role="status">
                    <strong>Auto reroute: {rerouteForCrisis.unit}</strong>
                    <p>{rerouteForCrisis.reason}</p>
                    <p className="traffic-reroute-banner__eta">
                      ETA {rerouteForCrisis.etaMinutes} min
                      {rerouteForCrisis.previousEtaMinutes != null
                        ? ` (was ${rerouteForCrisis.previousEtaMinutes} min)`
                        : ''}
                      {rerouteForCrisis.facility ? ` · ${rerouteForCrisis.facility}` : ''}
                    </p>
                  </div>
                )}
                {status === 'executing' && (
                  <button
                    type="button"
                    className="btn btn--ghost btn--sm traffic-check-btn"
                    disabled={checkingTraffic}
                    onClick={checkTrafficNow}
                  >
                    {checkingTraffic ? 'Checking Google traffic…' : '↻ Check traffic & reroute now'}
                  </button>
                )}
                <DispatchConsole
                  note={note}
                  onNoteChange={setNote}
                  dispatching={dispatching}
                  rerouting={rerouting}
                  crisisType={crisisType}
                  reportCategory={report?.category}
                  incidentKind={incidentKind}
                  selectedCount={selectedResources.length}
                  lastResult={lastDispatch}
                  dispatchedAt={lastDispatchedAt}
                  lastReroute={lastReroute}
                  error={dispatchError}
                  history={dispatchHistory?.dispatches ?? []}
                  onDispatch={dispatch}
                  onReroute={reroute}
                />
              </Panel>
            </div>
          </div>

          <Panel title="AI Reasoning Log" subtitle="Agent pipeline output" className="crisis-dossier__trace-panel">
            <AgentTraceFeed traces={traces} max={12} />
          </Panel>
        </div>
      </div>
    </div>
  );
}
