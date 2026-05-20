import { ScrollView, RefreshControl } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { colors } from '../../../theme/tokens';
import { OpsHeader } from '../../../components/OpsHeader';
import { TacticalPanel } from '../../../components/ui/TacticalPanel';
import { ReasoningTimeline } from '../../../components/timeline/ReasoningTimeline';
import { useCrisisDetail } from '../../../hooks/useCrisisDetail';
import { useCrisisStore } from '../../../lib/store';

export default function ReasoningTimelineScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { tracesQuery } = useCrisisDetail(id);
  const liveTraces = useCrisisStore((s) => s.traces);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: 12 }}
      refreshControl={
        <RefreshControl
          refreshing={tracesQuery.isRefetching}
          onRefresh={() => tracesQuery.refetch()}
          tintColor={colors.accent}
        />
      }
    >
      <OpsHeader title="AI REASONING" subtitle="9-agent pipeline · CoT traces" />
      <TacticalPanel title="Agent Timeline" accent="info">
        <ReasoningTimeline
          traces={liveTraces}
          dbTraces={tracesQuery.data?.traces}
        />
      </TacticalPanel>
    </ScrollView>
  );
}
