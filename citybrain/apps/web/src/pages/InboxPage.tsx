import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchApi, postApi, type CrisisRow } from '../lib/api';
import { useOpsStore } from '../lib/store';
import { Panel } from '../components/ui/Panel';
import { MetricCard } from '../components/ui/MetricCard';
import { CrisisInbox } from '../components/ops/CrisisInbox';
import { SignalTicker } from '../components/ops/SignalTicker';
import { AgentPipeline } from '../components/ops/AgentPipeline';
import { AgentTraceFeed } from '../components/ops/AgentTraceFeed';
import { FeatureStrip } from '../components/ui/FeatureStrip';

export default function InboxPage() {
  const signals = useOpsStore((s) => s.signals);
  const traces = useOpsStore((s) => s.traces);
  const connectionStatus = useOpsStore((s) => s.connectionStatus);
  const pipelineStatus = useOpsStore((s) => s.pipelineStatus);
  const reset = useOpsStore((s) => s.reset);
  const citizenUpdate = useOpsStore((s) => s.citizenUpdate);
  const [demoLoading, setDemoLoading] = useState(false);

  const { data, refetch, isLoading } = useQuery({
    queryKey: ['crises'],
    queryFn: () => fetchApi<{ crises: CrisisRow[] }>('/crises'),
    refetchInterval: 8000,
  });

  const crises = data?.crises ?? [];
  const activeCount = crises.filter((c) => c.status !== 'resolved').length;

  useEffect(() => {
    if (citizenUpdate?.crisisId) void refetch();
  }, [citizenUpdate, refetch]);

  async function launchDemo() {
    setDemoLoading(true);
    try {
      reset();
      await postApi('/demo/scenarios/karachi_flood/run');
      await refetch();
    } finally {
      setDemoLoading(false);
    }
  }

  return (
    <div className="ops-layout page-shell">
      <section className="ops-hero ops-hero--premium">
        <div className="ops-hero__glow" aria-hidden />
        <div className="ops-hero__copy">
          <p className="ops-hero__eyebrow">
            <span className="live-dot" /> Live command center
          </p>
          <h1 className="ops-hero__title">Emergency Operations Center</h1>
          <p className="ops-hero__desc">
            Autonomous 9-agent pipeline ingests multilingual crisis signals, validates citizen
            reports, and coordinates simulated city response in real time.
          </p>
        </div>
        <div className="ops-hero__actions">
          <Link to="/report" className="btn btn--danger">
            🚨 Live Accident Report
          </Link>
          <button
            type="button"
            className="btn btn--primary btn--glow"
            onClick={launchDemo}
            disabled={demoLoading}
          >
            {demoLoading ? 'Launching…' : '★ Launch Karachi Demo'}
          </button>
          <button type="button" className="btn btn--ghost" onClick={() => refetch()}>
            Refresh Registry
          </button>
        </div>
      </section>

      <FeatureStrip />

      <div className="metric-strip metric-strip--stagger">
        <MetricCard
          label="Active Crises"
          value={activeCount}
          hint={`${crises.length} total in registry`}
          tone={activeCount > 0 ? 'warn' : 'default'}
          icon="⚠"
        />
        <MetricCard
          label="Live Signals"
          value={signals.length}
          hint="WebSocket stream"
          tone="info"
          icon="◎"
        />
        <MetricCard
          label="Agent Steps"
          value={traces.length}
          hint="Reasoning trace buffer"
          tone="ok"
          icon="◈"
        />
        <MetricCard
          label="System Link"
          value={connectionStatus === 'connected' ? 'ONLINE' : 'OFFLINE'}
          hint={pipelineStatus}
          tone={connectionStatus === 'connected' ? 'ok' : 'danger'}
          icon="⬡"
        />
      </div>

      <div className="ops-grid">
        <aside className="ops-sidebar">
          <Panel
            title="Crisis Inbox"
            subtitle="Select incident to open dossier"
            action={
              <span className="panel-badge">{crises.length}</span>
            }
          >
            <CrisisInbox crises={crises} loading={isLoading} />
          </Panel>

          <Panel title="Live Signal Feed" subtitle="Multilingual ingest stream" className="mt-panel">
            <SignalTicker signals={signals} />
          </Panel>
        </aside>

        <div className="ops-main">
          <Panel
            title="Autonomous Agent Pipeline"
            subtitle="9 specialized agents · CIRO workflow"
          >
            <AgentPipeline traces={traces} />
          </Panel>

          <Panel
            title="AI Reasoning Trace"
            subtitle="Real-time chain-of-thought from orchestrator"
            className="mt-panel"
          >
            <AgentTraceFeed traces={traces} max={24} />
          </Panel>
        </div>
      </div>
    </div>
  );
}
