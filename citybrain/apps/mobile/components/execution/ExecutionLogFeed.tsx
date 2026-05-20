import { View, Text } from 'react-native';
import { colors } from '../../theme/tokens';
import { AnimatedTraceRow } from '../ui/AnimatedTraceRow';
import type { ExecutionLogEntry } from '../../lib/store';

interface ExecutionLogFeedProps {
  liveLogs: ExecutionLogEntry[];
  dbLogs?: Array<Record<string, unknown>>;
}

export function ExecutionLogFeed({ liveLogs, dbLogs }: ExecutionLogFeedProps) {
  const items =
    dbLogs && dbLogs.length > 0
      ? dbLogs.map((e, i) => ({
          key: String(e.id ?? i),
          tool: String(e.tool_name ?? 'tool'),
          status: String(e.status ?? 'success'),
          detail: JSON.stringify(e.state_delta ?? e.response_json ?? {}).slice(0, 100),
          isNew: false,
        }))
      : liveLogs.map((e, i) => ({
          key: e.id,
          tool: e.tool,
          status: e.status,
          detail: JSON.stringify(e.response ?? {}).slice(0, 100),
          isNew: i === 0,
        }));

  if (items.length === 0) {
    return (
      <Text style={{ color: colors.textMuted, fontFamily: 'monospace', fontSize: 12 }}>
        No execution logs yet
      </Text>
    );
  }

  return (
    <View>
      {items.map((item) => (
        <AnimatedTraceRow
          key={item.key}
          title={`[${item.tool}] ${item.status.toUpperCase()}`}
          subtitle={item.detail}
          accentColor={item.status === 'failed' ? colors.danger : colors.danger}
          isNew={item.isNew}
        />
      ))}
    </View>
  );
}
