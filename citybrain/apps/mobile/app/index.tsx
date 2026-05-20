import { useQuery } from '@tanstack/react-query';
import { View, Text, ScrollView, Pressable, RefreshControl } from 'react-native';
import { Link } from 'expo-router';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { fetchApi, postApi } from '../lib/api';
import { TacticalPanel } from '../components/ui/TacticalPanel';
import { OpsHeader } from '../components/OpsHeader';
import { AnimatedTraceRow } from '../components/ui/AnimatedTraceRow';
import { StatusPulse } from '../components/ui/StatusPulse';
import { useCrisisStore } from '../lib/store';
import { colors } from '../theme/tokens';

interface CrisisRow {
  id: string;
  title: string;
  type: string;
  status: string;
  escalation_level: string;
  area_label: string;
  confidence: number;
}

export default function OpsOverview() {
  const router = useRouter();
  const [launching, setLaunching] = useState(false);
  const signals = useCrisisStore((s) => s.signals);
  const traces = useCrisisStore((s) => s.traces);
  const pipelineStatus = useCrisisStore((s) => s.pipelineStatus);
  const connectionStatus = useCrisisStore((s) => s.connectionStatus);
  const resetLiveState = useCrisisStore((s) => s.resetLiveState);
  const setSelected = useCrisisStore((s) => s.setSelectedCrisis);
  const wsStatus =
    connectionStatus === 'connected' ? 'online' : connectionStatus === 'connecting' ? 'warn' : 'danger';

  async function quickLaunchKarachi() {
    setLaunching(true);
    resetLiveState();
    try {
      const res = await postApi<{ crisisId: string }>('/demo/scenarios/karachi_flood/run');
      setSelected(res.crisisId);
      router.push(`/crisis/${res.crisisId}`);
    } catch (e) {
      console.error(e);
    } finally {
      setLaunching(false);
    }
  }

  const { data, refetch, isRefetching } = useQuery({
    queryKey: ['crises'],
    queryFn: () => fetchApi<{ crises: CrisisRow[] }>('/crises'),
    refetchInterval: 5000,
  });

  const crises = data?.crises ?? [];

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: 16 }}
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.accent} />
      }
    >
      <OpsHeader
        title="CITYBRAIN AI"
        subtitle="AUTONOMOUS CRISIS OPS — COMMAND CENTER"
      />

      <View style={{ flexDirection: 'row', gap: 20, marginBottom: 12 }}>
        <StatusPulse label={`LIVE ${connectionStatus.toUpperCase()}`} status={wsStatus} />
      </View>

      <Link href="/lab" asChild>
        <Pressable
          style={{
            backgroundColor: colors.dangerDim,
            borderWidth: 1,
            borderColor: colors.danger,
            borderRadius: 8,
            padding: 16,
            marginBottom: 10,
            alignItems: 'center',
          }}
        >
          <Text style={{ color: colors.danger, fontWeight: '700', letterSpacing: 2, fontFamily: 'monospace' }}>
            ⚡ OPEN TEST CONSOLE
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: 10, marginTop: 6, fontFamily: 'monospace' }}>
            Health · Scenarios · Resources · Signals — no curl
          </Text>
        </Pressable>
      </Link>

      <View
        style={{
          backgroundColor: colors.accentDim,
          borderWidth: 1,
          borderColor: colors.accent,
          borderRadius: 8,
          padding: 4,
          marginBottom: 12,
        }}
      >
        <Text
          style={{
            color: colors.textMuted,
            fontSize: 10,
            fontFamily: 'monospace',
            textAlign: 'center',
            paddingVertical: 4,
          }}
        >
          PIPELINE {pipelineStatus.toUpperCase()}
        </Text>
      </View>

      <Pressable
        onPress={quickLaunchKarachi}
        disabled={launching}
        style={{
          backgroundColor: colors.accentDim,
          borderWidth: 1,
          borderColor: colors.accent,
          borderRadius: 8,
          padding: 14,
          marginBottom: 16,
          alignItems: 'center',
          opacity: launching ? 0.6 : 1,
        }}
      >
        <Text style={{ color: colors.accent, fontWeight: '700', letterSpacing: 2, fontFamily: 'monospace' }}>
          {launching ? 'LAUNCHING…' : '▶ QUICK LAUNCH (KARACHI)'}
        </Text>
      </Pressable>

      <TacticalPanel title="Active Crises">
        {crises.length === 0 ? (
          <Text style={{ color: colors.textMuted, fontFamily: 'monospace', fontSize: 12 }}>
            No active crises — launch demo
          </Text>
        ) : (
          crises.map((c) => (
            <Link key={c.id} href={`/crisis/${c.id}`} asChild>
              <Pressable
                style={{
                  borderBottomWidth: 1,
                  borderBottomColor: colors.border,
                  paddingVertical: 12,
                }}
              >
                <Text style={{ color: colors.text, fontWeight: '600', fontSize: 15 }}>{c.title}</Text>
                <Text style={{ color: colors.textMuted, fontSize: 11, fontFamily: 'monospace', marginTop: 4 }}>
                  {c.type?.toUpperCase()} · {c.status} · {c.escalation_level ?? 'watch'}
                  {c.confidence ? ` · ${(c.confidence * 100).toFixed(0)}%` : ''}
                </Text>
              </Pressable>
            </Link>
          ))
        )}
      </TacticalPanel>

      <TacticalPanel title="Signal Feed" accent="warn">
        {signals.length === 0 ? (
          <Text style={{ color: colors.textMuted, fontSize: 12, fontFamily: 'monospace' }}>
            Awaiting signals...
          </Text>
        ) : (
          signals.slice(0, 5).map((s, i) => (
            <View key={i} style={{ marginBottom: 8 }}>
              <Text style={{ color: colors.warn, fontSize: 10, fontFamily: 'monospace' }}>
                [{s.source?.toUpperCase()}] {s.areaLabel}
              </Text>
              <Text style={{ color: colors.text, fontSize: 12 }} numberOfLines={2}>
                {s.rawText}
              </Text>
            </View>
          ))
        )}
      </TacticalPanel>

      <TacticalPanel title="Live Agent Trace">
        {traces.length === 0 ? (
          <Text style={{ color: colors.textMuted, fontSize: 12, fontFamily: 'monospace' }}>
            Pipeline idle
          </Text>
        ) : (
          traces.slice(-6).map((t, i) => (
            <AnimatedTraceRow
              key={`${t.agent}-${i}`}
              title={`${t.agent} · ${t.latencyMs ?? '?'}ms`}
              subtitle={t.thought}
              isNew={i === traces.slice(-6).length - 1}
            />
          ))
        )}
      </TacticalPanel>
    </ScrollView>
  );
}
