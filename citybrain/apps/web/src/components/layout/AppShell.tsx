import { Link, useLocation } from 'react-router-dom';
import { useOpsStore } from '../../lib/store';
import { LiveClock } from '../ui/LiveClock';

interface AppShellProps {
  children: React.ReactNode;
}

const NAV = [
  { to: '/report', label: 'Report Accident', icon: '🚨', match: (p: string) => p.startsWith('/report') },
  {
    to: '/',
    label: 'Authority Dashboard',
    icon: '⬡',
    match: (p: string) => p === '/' || p.startsWith('/crisis'),
  },
] as const;

export function AppShell({ children }: AppShellProps) {
  const location = useLocation();
  const status = useOpsStore((s) => s.connectionStatus);
  const pipelineStatus = useOpsStore((s) => s.pipelineStatus);

  return (
    <div className="app-root">
      <div className="bg-aurora" aria-hidden />
      <div className="bg-grid" aria-hidden />
      <div className="bg-noise" aria-hidden />
      <div className="bg-glow bg-glow--tl" aria-hidden />
      <div className="bg-glow bg-glow--br" aria-hidden />
      <div className="scanlines" aria-hidden />

      <header className="app-header">
        <Link to="/" className="header-brand">
          <div className="brand-mark" aria-hidden>
            <span className="brand-mark__ring" />
            <span className="brand-mark__core" />
          </div>
          <div>
            <div className="brand-title">CITYBRAIN</div>
            <div className="brand-sub">Authority Command · CIRO Emergency OS</div>
          </div>
        </Link>

        <nav className="header-nav" aria-label="Main">
          <div className="nav-tabs">
            {NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={`nav-tab ${item.to === '/report' ? 'nav-tab--citizen' : 'nav-tab--ops'} ${item.match(location.pathname) ? 'nav-tab--active' : ''}`}
              >
                <span className="nav-tab__icon" aria-hidden>
                  {item.icon}
                </span>
                {item.label}
              </Link>
            ))}
          </div>
        </nav>

        <div className="header-status">
          <LiveClock />
          <StatusPill
            label="Pipeline"
            value={pipelineStatus}
            tone={
              pipelineStatus === 'complete'
                ? 'ok'
                : pipelineStatus === 'failed'
                  ? 'err'
                  : 'neutral'
            }
          />
          <StatusPill
            label="Live Link"
            value={status}
            tone={status === 'connected' ? 'ok' : status === 'connecting' ? 'warn' : 'err'}
            pulse={status === 'connected'}
          />
        </div>
      </header>

      <main className="app-main page-enter">{children}</main>

      <footer className="app-footer">
        <span className="footer-badge">Google Antigravity Hackathon</span>
        <span className="footer-dot">·</span>
        <span>Challenge 3 — CIRO</span>
        <span className="footer-dot">·</span>
        <Link to="/">Command Inbox</Link>
        <span className="footer-dot">·</span>
        <Link to="/report">Citizen Report</Link>
      </footer>
    </div>
  );
}

function StatusPill({
  label,
  value,
  tone,
  pulse,
}: {
  label: string;
  value: string;
  tone: 'ok' | 'warn' | 'err' | 'neutral';
  pulse?: boolean;
}) {
  return (
    <div className={`status-pill status-pill--${tone} ${pulse ? 'status-pill--pulse' : ''}`}>
      <span className="status-pill__label">{label}</span>
      <span className="status-pill__value">{value}</span>
    </div>
  );
}
