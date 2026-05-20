import { View, Text } from 'react-native';
import { colors } from '../../theme/tokens';
import type { ResourceUnit } from '../../lib/store';

const TYPE_ICONS: Record<string, string> = {
  ambulance: '◈ MED',
  pump: '◈ PMP',
  tow: '◈ TOW',
  shelter: '◈ SHL',
  engineer: '◈ ENG',
};

interface ResourceDashboardProps {
  resources: ResourceUnit[];
}

export function ResourceDashboard({ resources }: ResourceDashboardProps) {
  if (resources.length === 0) {
    return (
      <Text style={{ color: colors.textMuted, fontFamily: 'monospace', fontSize: 12 }}>
        Loading resource inventory...
      </Text>
    );
  }

  const deployed = resources.filter((r) => r.status !== 'available');

  return (
    <View>
      <View style={{ flexDirection: 'row', marginBottom: 12, gap: 8 }}>
        <StatChip label="TOTAL" value={resources.length} />
        <StatChip label="DEPLOYED" value={deployed.length} color={colors.warn} />
        <StatChip label="READY" value={resources.length - deployed.length} color={colors.accent} />
      </View>

      {resources.map((r) => (
        <View
          key={r.id}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: 10,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          }}
        >
          <Text style={{ color: colors.accent, fontFamily: 'monospace', fontSize: 11, width: 56 }}>
            {TYPE_ICONS[r.type] ?? '◈ OPS'}
          </Text>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.text, fontWeight: '600', fontSize: 13 }}>{r.name}</Text>
            <Text style={{ color: colors.textMuted, fontSize: 10, fontFamily: 'monospace' }}>
              {r.lat.toFixed(4)}, {r.lng.toFixed(4)}
            </Text>
          </View>
          <View
            style={{
              paddingHorizontal: 8,
              paddingVertical: 3,
              borderRadius: 4,
              backgroundColor:
                r.status === 'available' ? colors.accentDim : colors.dangerDim,
              borderWidth: 1,
              borderColor: r.status === 'available' ? colors.accent : colors.danger,
            }}
          >
            <Text
              style={{
                color: r.status === 'available' ? colors.accent : colors.danger,
                fontSize: 9,
                fontFamily: 'monospace',
              }}
            >
              {r.status.toUpperCase()}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function StatChip({
  label,
  value,
  color = colors.text,
}: {
  label: string;
  value: number;
  color?: string;
}) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.surfaceRaised,
        borderRadius: 6,
        padding: 8,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <Text style={{ color: colors.textMuted, fontSize: 9, fontFamily: 'monospace' }}>{label}</Text>
      <Text style={{ color, fontSize: 18, fontWeight: '700', fontFamily: 'monospace' }}>{value}</Text>
    </View>
  );
}
