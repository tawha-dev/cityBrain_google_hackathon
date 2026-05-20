import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  TextInput,
  Alert,
} from 'react-native';
import { Link, useRouter } from 'expo-router';
import {
  fetchApi,
  fetchHealth,
  fetchIntegrationsStatus,
  fetchLiveNews,
  fetchLiveWeather,
  getApiUrl,
  getWsUrl,
  ingestSignal,
  postApi,
  syncLiveFeeds,
  type IntegrationsStatus,
} from '../lib/api';
import { TacticalPanel } from '../components/ui/TacticalPanel';
import { StatusPulse } from '../components/ui/StatusPulse';
import { useCrisisStore, type ResourceUnit } from '../lib/store';
import { colors } from '../theme/tokens';

const SCENARIOS = [
  {
    key: 'karachi_flood',
    label: '★ Karachi Heavy Rain Flood',
    desc: 'Main judge demo — Clifton/Saddar flood',
  },
  { key: 'g10_flood', label: 'G-10 Urban Flood', desc: 'Islamabad urban flood' },
  { key: 'margalla_heat', label: 'Margalla Heatwave', desc: 'Extreme heat + hospitals' },
  { key: 'srinagar_accident', label: 'Srinagar Accident', desc: 'Multi-vehicle collision' },
  { key: 'i9_grid', label: 'I-9 Grid Failure', desc: 'Power / infrastructure' },
  { key: 'faiz_road_block', label: 'Faiz Road Block', desc: 'Road blockage' },
] as const;

interface CrisisRow {
  id: string;
  title: string;
  type: string;
  status: string;
  escalation_level: string;
}

interface ApiLogEntry {
  id: string;
  label: string;
  ok: boolean;
  detail: string;
  at: string;
}

export default function OpsTestConsole() {
  const router = useRouter();
  const connectionStatus = useCrisisStore((s) => s.connectionStatus);
  const setResources = useCrisisStore((s) => s.setResources);
  const resetLiveState = useCrisisStore((s) => s.resetLiveState);
  const setSelected = useCrisisStore((s) => s.setSelectedCrisis);
  const selectedCrisisId = useCrisisStore((s) => s.selectedCrisisId);

  const [apiHealth, setApiHealth] = useState<'unknown' | 'ok' | 'fail'>('unknown');
  const [healthDetail, setHealthDetail] = useState('');
  const [resources, setLocalResources] = useState<ResourceUnit[]>([]);
  const [crises, setCrises] = useState<CrisisRow[]>([]);
  const [memoryCount, setMemoryCount] = useState<number | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [logs, setLogs] = useState<ApiLogEntry[]>([]);

  const [signalText, setSignalText] = useState('Pani ghar tak aa gaya — Clifton Block 4');
  const [signalArea, setSignalArea] = useState('Clifton, Karachi');
  const [signalSource, setSignalSource] = useState('citizen');
  const [integrations, setIntegrations] = useState<IntegrationsStatus | null>(null);
  const [weatherLine, setWeatherLine] = useState('');
  const [newsHeadlines, setNewsHeadlines] = useState<string[]>([]);

  const pushLog = useCallback((label: string, ok: boolean, detail: string) => {
    setLogs((prev) =>
      [
        {
          id: `${Date.now()}-${Math.random()}`,
          label,
          ok,
          detail,
          at: new Date().toLocaleTimeString(),
        },
        ...prev,
      ].slice(0, 12)
    );
  }, []);

  const runCheck = useCallback(
    async (label: string, fn: () => Promise<string>) => {
      setLoading(label);
      try {
        const detail = await fn();
        pushLog(label, true, detail);
        return true;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        pushLog(label, false, msg);
        Alert.alert(label, msg);
        return false;
      } finally {
        setLoading(null);
      }
    },
    [pushLog]
  );

  const checkHealth = useCallback(async () => {
    const data = await fetchHealth();
    setApiHealth(data.status === 'ok' ? 'ok' : 'fail');
    const int = data.integrations ?? (await fetchIntegrationsStatus().catch(() => null));
    if (int) setIntegrations(int);
    const ai = int
      ? `Gemini ${int.gemini ? int.geminiModel : 'off'} · OR ${int.openrouter ? int.openRouterModel : 'off'}`
      : '';
    setHealthDetail([data.service ?? data.status, ai].filter(Boolean).join(' · '));
    return `API ${data.status}`;
  }, []);

  const loadIntegrations = useCallback(async () => {
    const int = await fetchIntegrationsStatus();
    setIntegrations(int);
    return `AI ${int.provider} · weather ${int.openweather ? 'on' : 'off'} · news ${int.news ? 'on' : 'off'}`;
  }, []);

  const loadLiveWeather = useCallback(async () => {
    const { weather } = await fetchLiveWeather(24.8607, 67.0011, 'Karachi');
    const line = `${weather.condition} · ${weather.temperatureC}°C · rain ${weather.rainfallMm}mm`;
    setWeatherLine(line);
    return line;
  }, []);

  const loadLiveNews = useCallback(async () => {
    const feed = await fetchLiveNews('Karachi Pakistan flood emergency');
    const titles = feed.articles.map((a) => a.title).slice(0, 5);
    setNewsHeadlines(titles);
    return `${titles.length} headlines`;
  }, []);

  const syncLive = useCallback(async () => {
    const res = await syncLiveFeeds({
      lat: 24.8607,
      lon: 67.0011,
      query: 'Karachi Pakistan flood',
      areaLabel: 'Karachi',
    });
    return `synced ${res.ingested} signals (${res.newsCount} news)`;
  }, []);

  const loadResources = useCallback(async () => {
    const data = await fetchApi<{ resources: ResourceUnit[] }>('/resources');
    setLocalResources(data.resources);
    setResources(data.resources);
    return `${data.resources.length} units available`;
  }, [setResources]);

  const loadCrises = useCallback(async () => {
    const data = await fetchApi<{ crises: CrisisRow[] }>('/crises');
    setCrises(data.crises);
    return `${data.crises.length} active crises`;
  }, []);

  const loadMemory = useCallback(async () => {
    const data = await fetchApi<{ memory: unknown[] }>('/memory');
    setMemoryCount(data.memory?.length ?? 0);
    return `${data.memory?.length ?? 0} memory entries`;
  }, []);

  const launchScenario = useCallback(
    async (key: string) => {
      setLoading(key);
      resetLiveState();
      try {
        const res = await postApi<{ crisisId: string }>(`/demo/scenarios/${key}/run`);
        setSelected(res.crisisId);
        pushLog(`Scenario ${key}`, true, `crisisId ${res.crisisId.slice(0, 8)}…`);
        setTimeout(() => router.push(`/crisis/${res.crisisId}`), 400);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        pushLog(`Scenario ${key}`, false, msg);
        Alert.alert('Scenario failed', msg);
      } finally {
        setLoading(null);
      }
    },
    [pushLog, resetLiveState, router, setSelected]
  );

  const submitSignal = useCallback(async () => {
    if (!signalText.trim()) {
      Alert.alert('Signal', 'Enter report text');
      return;
    }
    await runCheck('Ingest signal', async () => {
      const res = await ingestSignal({
        source: signalSource,
        rawText: signalText.trim(),
        areaLabel: signalArea.trim() || undefined,
        language: 'en',
        location: { lat: 24.8138, lng: 67.0299 },
      });
      return `ingested ${res.ingested} · id ${res.ids[0]?.slice(0, 8) ?? '—'}…`;
    });
  }, [runCheck, signalArea, signalSource, signalText]);

  const reanalyzeCrisis = useCallback(async () => {
    if (!selectedCrisisId) {
      Alert.alert('Re-analyze', 'Launch a scenario first or pick a crisis below');
      return;
    }
    await runCheck('Re-analyze crisis', async () => {
      const res = await postApi<{ status: string }>(`/crises/${selectedCrisisId}/analyze`);
      return res.status;
    });
  }, [runCheck, selectedCrisisId]);

  const runAllChecks = useCallback(async () => {
    setLoading('all');
    await checkHealth().then((d) => pushLog('Health', true, d)).catch((e) =>
      pushLog('Health', false, e instanceof Error ? e.message : String(e))
    );
    await loadResources().then((d) => pushLog('Resources', true, d)).catch((e) =>
      pushLog('Resources', false, e instanceof Error ? e.message : String(e))
    );
    await loadCrises().then((d) => pushLog('Crises', true, d)).catch((e) =>
      pushLog('Crises', false, e instanceof Error ? e.message : String(e))
    );
    await loadIntegrations().then((d) => pushLog('Integrations', true, d)).catch((e) =>
      pushLog('Integrations', false, e instanceof Error ? e.message : String(e))
    );
    setLoading(null);
  }, [checkHealth, loadCrises, loadIntegrations, loadResources, pushLog]);

  useEffect(() => {
    runAllChecks();
  }, []);

  const wsStatus =
    connectionStatus === 'connected' ? 'online' : connectionStatus === 'connecting' ? 'warn' : 'danger';

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
    >
      <Text style={{ color: colors.textMuted, fontFamily: 'monospace', fontSize: 11, marginBottom: 12 }}>
        Test the full stack from the app — no curl required
      </Text>

      <TacticalPanel title="SYSTEM STATUS">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginBottom: 10 }}>
          <StatusPulse
            label={`API ${apiHealth === 'ok' ? 'OK' : apiHealth === 'fail' ? 'DOWN' : '…'}`}
            status={apiHealth === 'ok' ? 'online' : apiHealth === 'fail' ? 'danger' : 'idle'}
          />
          <StatusPulse label={`WS ${connectionStatus.toUpperCase()}`} status={wsStatus} />
        </View>
        <Text style={{ color: colors.textMuted, fontSize: 10, fontFamily: 'monospace' }}>
          REST {getApiUrl()}
        </Text>
        <Text style={{ color: colors.textMuted, fontSize: 10, fontFamily: 'monospace', marginTop: 4 }}>
          WS {getWsUrl()}
        </Text>
        {healthDetail ? (
          <Text style={{ color: colors.accent, fontSize: 10, fontFamily: 'monospace', marginTop: 6 }}>
            {healthDetail}
          </Text>
        ) : null}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
          <ActionChip
            label="Run all checks"
            onPress={runAllChecks}
            disabled={loading !== null}
          />
          <ActionChip label="Health" onPress={() => runCheck('Health', checkHealth)} disabled={!!loading} />
          <ActionChip
            label="Resources"
            onPress={() => runCheck('Resources', loadResources)}
            disabled={!!loading}
          />
          <ActionChip label="Crises" onPress={() => runCheck('Crises', loadCrises)} disabled={!!loading} />
          <ActionChip label="Memory" onPress={() => runCheck('Memory', loadMemory)} disabled={!!loading} />
        </View>
        {loading === 'all' ? <ActivityIndicator color={colors.accent} style={{ marginTop: 8 }} /> : null}
      </TacticalPanel>

      <TacticalPanel title="LIVE FEEDS (WEATHER + NEWS)" accent="info">
        {integrations ? (
          <Text style={{ color: colors.textMuted, fontSize: 10, fontFamily: 'monospace', marginBottom: 8 }}>
            AI: {integrations.provider} · {integrations.geminiModel}
            {integrations.openrouter ? ` + ${integrations.openRouterModel}` : ''}
            {'\n'}Weather: {integrations.openweather ? 'live' : 'simulated'} · News:{' '}
            {integrations.news ? 'live' : 'simulated'}
          </Text>
        ) : null}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <ActionChip label="Live weather" onPress={() => runCheck('Weather', loadLiveWeather)} disabled={!!loading} />
          <ActionChip label="Live news" onPress={() => runCheck('News', loadLiveNews)} disabled={!!loading} />
          <ActionChip label="Sync to signals" onPress={() => runCheck('Live sync', syncLive)} disabled={!!loading} primary />
        </View>
        {weatherLine ? (
          <Text style={{ color: colors.accent, fontSize: 11, fontFamily: 'monospace', marginTop: 8 }}>{weatherLine}</Text>
        ) : null}
        {newsHeadlines.map((t, i) => (
          <Text key={i} style={{ color: colors.text, fontSize: 11, marginTop: 6 }} numberOfLines={2}>
            • {t}
          </Text>
        ))}
      </TacticalPanel>

      <TacticalPanel title="DEMO SCENARIOS" accent="danger">
        <Text style={{ color: colors.textMuted, fontSize: 11, marginBottom: 10 }}>
          Tap a scenario — opens live command center (MAP → TRACE → EXEC…)
        </Text>
        {SCENARIOS.map((s) => (
          <Pressable
            key={s.key}
            onPress={() => launchScenario(s.key)}
            disabled={loading !== null}
            style={{
              borderWidth: 1,
              borderColor: s.key === 'karachi_flood' ? colors.danger : colors.border,
              borderRadius: 6,
              padding: 12,
              marginBottom: 8,
              backgroundColor: colors.void,
            }}
          >
            <Text style={{ color: colors.text, fontWeight: '600', fontSize: 14 }}>{s.label}</Text>
            <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 4 }}>{s.desc}</Text>
            {loading === s.key ? (
              <ActivityIndicator color={colors.accent} style={{ marginTop: 8 }} />
            ) : (
              <Text style={{ color: colors.accent, fontFamily: 'monospace', fontSize: 10, marginTop: 8 }}>
                ▶ EXECUTE
              </Text>
            )}
          </Pressable>
        ))}
      </TacticalPanel>

      <TacticalPanel title="CITY RESOURCES">
        {resources.length === 0 ? (
          <Text style={{ color: colors.textMuted, fontFamily: 'monospace', fontSize: 12 }}>
            Tap Resources above or Run all checks
          </Text>
        ) : (
          resources.map((r) => (
            <View
              key={r.id}
              style={{
                borderBottomWidth: 1,
                borderBottomColor: colors.border,
                paddingVertical: 8,
              }}
            >
              <Text style={{ color: colors.accent, fontFamily: 'monospace', fontSize: 11 }}>
                {r.type?.toUpperCase()} · {r.name}
              </Text>
              <Text style={{ color: colors.textMuted, fontSize: 10, fontFamily: 'monospace' }}>
                {r.status} · {r.lat?.toFixed(3)}, {r.lng?.toFixed(3)}
              </Text>
            </View>
          ))
        )}
      </TacticalPanel>

      <TacticalPanel title="INGEST LIVE SIGNAL">
        <Text style={{ color: colors.textMuted, fontSize: 11, marginBottom: 8 }}>
          Simulates a citizen report (POST /signals/ingest)
        </Text>
        <TextInput
          value={signalSource}
          onChangeText={setSignalSource}
          placeholder="source (citizen, weather, traffic…)"
          placeholderTextColor={colors.textMuted}
          style={inputStyle}
        />
        <TextInput
          value={signalArea}
          onChangeText={setSignalArea}
          placeholder="area label"
          placeholderTextColor={colors.textMuted}
          style={inputStyle}
        />
        <TextInput
          value={signalText}
          onChangeText={setSignalText}
          placeholder="report text"
          placeholderTextColor={colors.textMuted}
          multiline
          style={[inputStyle, { minHeight: 72, textAlignVertical: 'top' }]}
        />
        <ActionChip
          label={loading === 'Ingest signal' ? 'Sending…' : 'Send signal'}
          onPress={submitSignal}
          disabled={!!loading}
          primary
        />
      </TacticalPanel>

      <TacticalPanel title="ACTIVE CRISES">
        <ActionChip
          label="Re-analyze selected crisis"
          onPress={reanalyzeCrisis}
          disabled={!!loading || !selectedCrisisId}
        />
        {selectedCrisisId ? (
          <Text style={{ color: colors.textMuted, fontSize: 10, fontFamily: 'monospace', marginVertical: 8 }}>
            Selected: {selectedCrisisId.slice(0, 8)}…
          </Text>
        ) : null}
        {crises.length === 0 ? (
          <Text style={{ color: colors.textMuted, fontFamily: 'monospace', fontSize: 12 }}>
            No crises — launch a scenario
          </Text>
        ) : (
          crises.map((c) => (
            <Link key={c.id} href={`/crisis/${c.id}`} asChild>
              <Pressable
                onPress={() => setSelected(c.id)}
                style={{
                  borderBottomWidth: 1,
                  borderBottomColor: colors.border,
                  paddingVertical: 10,
                }}
              >
                <Text style={{ color: colors.text, fontWeight: '600' }}>{c.title}</Text>
                <Text style={{ color: colors.textMuted, fontSize: 10, fontFamily: 'monospace', marginTop: 4 }}>
                  {c.type} · {c.status} · {c.escalation_level ?? 'watch'}
                </Text>
                <Text style={{ color: colors.accent, fontSize: 10, fontFamily: 'monospace', marginTop: 4 }}>
                  Open command center →
                </Text>
              </Pressable>
            </Link>
          ))
        )}
        {memoryCount !== null ? (
          <Text style={{ color: colors.textMuted, fontSize: 10, fontFamily: 'monospace', marginTop: 8 }}>
            Crisis memory entries: {memoryCount}
          </Text>
        ) : null}
      </TacticalPanel>

      <TacticalPanel title="API LOG">
        {logs.length === 0 ? (
          <Text style={{ color: colors.textMuted, fontFamily: 'monospace', fontSize: 12 }}>
            Actions appear here
          </Text>
        ) : (
          logs.map((l) => (
            <View key={l.id} style={{ marginBottom: 8 }}>
              <Text
                style={{
                  color: l.ok ? colors.accent : colors.danger,
                  fontFamily: 'monospace',
                  fontSize: 11,
                }}
              >
                [{l.at}] {l.ok ? 'OK' : 'ERR'} {l.label}
              </Text>
              <Text style={{ color: colors.textMuted, fontSize: 10 }} numberOfLines={2}>
                {l.detail}
              </Text>
            </View>
          ))
        )}
      </TacticalPanel>
    </ScrollView>
  );
}

const inputStyle = {
  backgroundColor: colors.void,
  borderWidth: 1,
  borderColor: colors.border,
  borderRadius: 6,
  color: colors.text,
  fontFamily: 'monospace' as const,
  fontSize: 12,
  padding: 10,
  marginBottom: 8,
};

function ActionChip({
  label,
  onPress,
  disabled,
  primary,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  primary?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={{
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: primary ? colors.accent : colors.border,
        backgroundColor: primary ? colors.accentDim : colors.void,
        opacity: disabled ? 0.5 : 1,
        marginTop: 4,
        marginRight: 8,
        alignSelf: 'flex-start',
      }}
    >
      <Text style={{ color: primary ? colors.accent : colors.textMuted, fontFamily: 'monospace', fontSize: 11 }}>
        {label}
      </Text>
    </Pressable>
  );
}
