import { ScrollView, RefreshControl } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { colors } from '../../../theme/tokens';
import { OpsHeader } from '../../../components/OpsHeader';
import { TacticalPanel } from '../../../components/ui/TacticalPanel';
import { BeforeAfterAnalysis } from '../../../components/analysis/BeforeAfterAnalysis';
import { useCrisisDetail } from '../../../hooks/useCrisisDetail';

export default function BeforeAfterScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { stateQuery, beforeMetrics, afterMetrics, reflection } = useCrisisDetail(id);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: 12 }}
      refreshControl={
        <RefreshControl
          refreshing={stateQuery.isRefetching}
          onRefresh={() => stateQuery.refetch()}
          tintColor={colors.accent}
        />
      }
    >
      <OpsHeader title="BEFORE / AFTER" subtitle="Impact analysis · reflection delta" />
      <TacticalPanel title="Operational Impact">
        <BeforeAfterAnalysis
          before={beforeMetrics}
          after={afterMetrics}
          reflectionSummary={String(reflection?.summary ?? '')}
        />
      </TacticalPanel>
    </ScrollView>
  );
}
