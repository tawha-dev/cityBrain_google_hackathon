import { ScrollView, Text, RefreshControl } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { colors } from '../../../theme/tokens';
import { OpsHeader } from '../../../components/OpsHeader';
import { TacticalPanel } from '../../../components/ui/TacticalPanel';
import { LiveCrisisMap } from '../../../components/map/LiveCrisisMap';
import { useCrisisDetail } from '../../../hooks/useCrisisDetail';
import { useCrisisStore } from '../../../lib/store';
import { MetricTile } from '../../../components/ui/MetricTile';

export default function LiveCrisisMapScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { crisis, candidate, lat, lng, crisisQuery, beforeMetrics, afterMetrics } = useCrisisDetail(id);
  const pipelineStatus = useCrisisStore((s) => s.pipelineStatus);
  const mapMetrics = useCrisisStore((s) => s.mapMetrics);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: 12 }}
      refreshControl={
        <RefreshControl
          refreshing={crisisQuery.isRefetching}
          onRefresh={() => crisisQuery.refetch()}
          tintColor={colors.accent}
        />
      }
    >
      <OpsHeader
        title={String(crisis?.title ?? 'CRISIS')}
        subtitle={`${String(crisis?.area_label ?? '')} · ${pipelineStatus.toUpperCase()}`}
        escalation={String(crisis?.escalation_level ?? '')}
      />

      <LiveCrisisMap lat={lat} lng={lng} title={String(crisis?.area_label ?? '')} height={240} />

      <TacticalPanel title="Live Metrics" style={{ marginTop: 12 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <MetricTile
            label="CONGESTION"
            value={`${((mapMetrics.congestionIndex ?? beforeMetrics.congestionIndex ?? 0.82) * 100).toFixed(0)}%`}
          />
          <MetricTile label="STRANDED" value={mapMetrics.strandedVehicles ?? beforeMetrics.strandedVehicles ?? '—'} />
          <MetricTile label="RESOURCES" value={mapMetrics.resourcesDeployed ?? afterMetrics.resourcesDeployed ?? 0} />
        </ScrollView>
      </TacticalPanel>

      <TacticalPanel title="Intelligence Summary">
        <Text style={{ color: colors.text, fontSize: 13, lineHeight: 20 }}>
          {String(crisis?.summary ?? candidate?.summary ?? 'Analyzing crisis cluster...')}
        </Text>
      </TacticalPanel>
    </ScrollView>
  );
}
