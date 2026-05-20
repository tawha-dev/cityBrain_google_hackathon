import { useMemo } from 'react';
import { View, Text } from 'react-native';
import { colors } from '../../theme/tokens';
import { AnimatedTraceRow } from '../ui/AnimatedTraceRow';
import type { TraceStep } from '../../lib/store';

const AGENT_COLORS: Record<string, string> = {
  signal_extraction: '#3B8BFF',
  crisis_detection: '#00FFC6',
  severity_reasoning: '#FFB020',
  planning: '#9B7AFF',
  resource_allocation: '#00FF88',
  traffic_rerouting: '#00FFC6',
  citizen_alert: '#FFB020',
  execution: '#FF3B5C',
  reflection: '#FF6B9D',
};

interface ReasoningTimelineProps {
  traces: TraceStep[];
  dbTraces?: Array<Record<string, unknown>>;
}

export function ReasoningTimeline({ traces, dbTraces }: ReasoningTimelineProps) {
  const items = useMemo(() => {
    if (dbTraces && dbTraces.length > 0) {
      return dbTraces.map((t, i) => ({
        key: String(t.id ?? i),
        agent: String(t.agent_name ?? 'agent'),
        thought: String(
          (Array.isArray(t.traces) && (t.traces[0] as Record<string, unknown>)?.thought) ||
            t.thought ||
            ''
        ),
        latency: String(t.latency_ms ?? '?'),
        isNew: false,
      }));
    }
    return traces.map((t, i) => ({
      key: `${t.agent}-${t.timestamp}-${i}`,
      agent: t.agent,
      thought: t.thought ?? '',
      latency: String(t.latencyMs ?? '?'),
      isNew: i === traces.length - 1,
    }));
  }, [traces, dbTraces]);

  if (items.length === 0) {
    return (
      <Text style={{ color: colors.textMuted, fontFamily: 'monospace', fontSize: 12 }}>
        Awaiting AI pipeline...
      </Text>
    );
  }

  return (
    <View>
      {items.map((item) => (
        <AnimatedTraceRow
          key={item.key}
          title={`${item.agent.replace(/_/g, ' ').toUpperCase()} · ${item.latency}ms`}
          subtitle={item.thought}
          accentColor={AGENT_COLORS[item.agent] ?? colors.accent}
          isNew={item.isNew}
        />
      ))}
    </View>
  );
}
