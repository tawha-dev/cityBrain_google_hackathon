import { View, Text } from 'react-native';
import { colors, typography } from '../../theme/tokens';

interface MetricTileProps {
  label: string;
  value: string | number;
  delta?: number;
  invertDelta?: boolean;
  unit?: string;
}

export function MetricTile({ label, value, delta, invertDelta, unit }: MetricTileProps) {
  const improved = delta != null ? (invertDelta ? delta < 0 : delta > 0) : undefined;
  return (
    <View style={{ flex: 1, alignItems: 'center', paddingVertical: 8 }}>
      <Text style={{ color: colors.textMuted, fontSize: 9, fontFamily: 'monospace', letterSpacing: 1 }}>
        {label}
      </Text>
      <Text style={{ color: colors.text, ...typography.metric, marginTop: 4 }}>
        {value}
        {unit ? <Text style={{ fontSize: 12, color: colors.textMuted }}>{unit}</Text> : null}
      </Text>
      {delta != null && (
        <Text
          style={{
            color: improved ? colors.accent : colors.danger,
            fontSize: 11,
            fontFamily: 'monospace',
            marginTop: 2,
          }}
        >
          {delta > 0 ? '+' : ''}
          {typeof delta === 'number' && Math.abs(delta) < 10 ? delta.toFixed(2) : delta}
        </Text>
      )}
    </View>
  );
}
