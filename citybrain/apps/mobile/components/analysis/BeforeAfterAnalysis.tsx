import { View, Text } from 'react-native';
import { colors } from '../../theme/tokens';
import { MetricTile } from '../ui/MetricTile';

interface BeforeAfterAnalysisProps {
  before: Record<string, number>;
  after: Record<string, number>;
  reflectionSummary?: string;
}

export function BeforeAfterAnalysis({ before, after, reflectionSummary }: BeforeAfterAnalysisProps) {
  const congBefore = before.congestionIndex ?? 0.82;
  const congAfter = after.congestionIndex ?? 0.5;
  const strandedBefore = before.strandedVehicles ?? 80;
  const strandedAfter = after.strandedVehicles ?? 40;

  return (
    <View>
      <View
        style={{
          flexDirection: 'row',
          marginBottom: 16,
          backgroundColor: colors.surfaceRaised,
          borderRadius: 8,
          padding: 8,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        <PhaseColumn label="BEFORE" metrics={before} tint={colors.danger} />
        <View style={{ width: 1, backgroundColor: colors.border, marginHorizontal: 4 }} />
        <PhaseColumn label="AFTER" metrics={after} tint={colors.accent} />
      </View>

      <View style={{ flexDirection: 'row', marginBottom: 12 }}>
        <MetricTile
          label="CONGESTION"
          value={`${(congAfter * 100).toFixed(0)}%`}
          delta={congAfter - congBefore}
          invertDelta
        />
        <MetricTile
          label="STRANDED"
          value={strandedAfter}
          delta={strandedAfter - strandedBefore}
          invertDelta
        />
        <MetricTile
          label="ALERTS"
          value={after.activeAlerts ?? after.alertsReach ?? 1}
          delta={(after.activeAlerts ?? 1) - (before.activeAlerts ?? 0)}
        />
      </View>

      {reflectionSummary ? (
        <View
          style={{
            borderLeftWidth: 3,
            borderLeftColor: colors.accent,
            paddingLeft: 10,
            paddingVertical: 4,
          }}
        >
          <Text style={{ color: colors.accent, fontSize: 10, fontFamily: 'monospace', marginBottom: 4 }}>
            AI REFLECTION
          </Text>
          <Text style={{ color: colors.text, fontSize: 13, lineHeight: 20 }}>{reflectionSummary}</Text>
        </View>
      ) : null}
    </View>
  );
}

function PhaseColumn({
  label,
  metrics,
  tint,
}: {
  label: string;
  metrics: Record<string, number>;
  tint: string;
}) {
  return (
    <View style={{ flex: 1, padding: 8 }}>
      <Text style={{ color: tint, fontSize: 10, fontFamily: 'monospace', letterSpacing: 2, marginBottom: 8 }}>
        {label}
      </Text>
      <Text style={{ color: colors.textMuted, fontSize: 11, fontFamily: 'monospace' }}>
        CONG {(metrics.congestionIndex ?? 0).toFixed(2)}
      </Text>
      <Text style={{ color: colors.textMuted, fontSize: 11, fontFamily: 'monospace' }}>
        STR {metrics.strandedVehicles ?? 0}
      </Text>
    </View>
  );
}
