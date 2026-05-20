import { useEffect } from 'react';
import { ScrollView, RefreshControl } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { colors } from '../../../theme/tokens';
import { OpsHeader } from '../../../components/OpsHeader';
import { TacticalPanel } from '../../../components/ui/TacticalPanel';
import { ResourceDashboard } from '../../../components/resources/ResourceDashboard';
import { useCrisisDetail } from '../../../hooks/useCrisisDetail';
import { useCrisisStore, type ResourceUnit } from '../../../lib/store';

export default function ResourceDeploymentScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { resourcesQuery } = useCrisisDetail(id);
  const resources = useCrisisStore((s) => s.resources);
  const setResources = useCrisisStore((s) => s.setResources);

  useEffect(() => {
    const rows = resourcesQuery.data?.resources ?? [];
    if (rows.length > 0) {
      setResources(
        rows.map((r) => ({
          id: String(r.id ?? r.name),
          type: String(r.type ?? 'unit'),
          name: String(r.name ?? 'UNIT'),
          lat: Number(r.lat ?? 33.68),
          lng: Number(r.lng ?? 73.04),
          status: String(r.status ?? 'available'),
        })) as ResourceUnit[]
      );
    }
  }, [resourcesQuery.data, setResources]);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: 12 }}
      refreshControl={
        <RefreshControl
          refreshing={resourcesQuery.isRefetching}
          onRefresh={() => resourcesQuery.refetch()}
          tintColor={colors.accent}
        />
      }
    >
      <OpsHeader title="RESOURCE DEPLOYMENT" subtitle="Ambulance · pump · tow · shelter" />
      <TacticalPanel title="City Asset Grid">
        <ResourceDashboard resources={resources} />
      </TacticalPanel>
    </ScrollView>
  );
}
