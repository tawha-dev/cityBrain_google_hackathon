import { View, Text } from 'react-native';
import { colors } from '../theme/tokens';
import { StatusPulse } from './ui/StatusPulse';
import { useCrisisStore } from '../lib/store';

interface OpsHeaderProps {
  title: string;
  subtitle?: string;
  escalation?: string;
}

export function OpsHeader({ title, subtitle, escalation }: OpsHeaderProps) {
  const connection = useCrisisStore((s) => s.connectionStatus);
  const globalEscalation = useCrisisStore((s) => s.escalationLevel);
  const level = escalation ?? globalEscalation;

  const connStatus =
    connection === 'connected' ? 'online' : connection === 'connecting' ? 'warn' : 'idle';

  return (
    <View style={{ marginBottom: 12 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.accent, fontSize: 18, fontWeight: '700', letterSpacing: 1 }}>
            {title}
          </Text>
          {subtitle && (
            <Text style={{ color: colors.textMuted, fontSize: 11, fontFamily: 'monospace', marginTop: 4 }}>
              {subtitle}
            </Text>
          )}
        </View>
        <View style={{ alignItems: 'flex-end', gap: 6 }}>
          <StatusPulse label="LINK" status={connStatus} />
          <Text style={{ color: colors.danger, fontSize: 14, fontWeight: '700', fontFamily: 'monospace' }}>
            {level.toUpperCase()}
          </Text>
        </View>
      </View>
    </View>
  );
}
