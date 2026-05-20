import { Routes, Route } from 'react-router-dom';
import { useWebSocket } from './hooks/useWebSocket';
import { AppShell } from './components/layout/AppShell';
import InboxPage from './pages/InboxPage';
import CrisisPage from './pages/CrisisPage';
import ReportAccidentPage from './pages/ReportAccidentPage';
import ReportStatusPage from './pages/ReportStatusPage';

export default function App() {
  useWebSocket();

  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<InboxPage />} />
        <Route path="/report" element={<ReportAccidentPage />} />
        <Route path="/report/:reportId" element={<ReportStatusPage />} />
        <Route path="/crisis/:id" element={<CrisisPage />} />
      </Routes>
    </AppShell>
  );
}
