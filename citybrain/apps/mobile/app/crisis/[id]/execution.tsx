import { ScrollView, RefreshControl } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { colors } from '../../../theme/tokens';
import { OpsHeader } from '../../../components/OpsHeader';
import { TacticalPanel } from '../../../components/ui/TacticalPanel';
import { ExecutionLogFeed } from '../../../components/execution/ExecutionLogFeed';
import { useCrisisDetail } from '../../../hooks/useCrisisDetail';
import { useCrisisStore } from '../../../lib/store';

export default function ExecutionLogsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { execQuery } = useCrisisDetail(id);
  const liveLogs = useCrisisStore((s) => s.executionLogs);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: 12 }}
      refreshControl={
        <RefreshControl
          refreshing={execQuery.isRefetching}
          onRefresh={() => execQuery.refetch()}
          tintColor={colors.accent}
        />
      }
    >
      <OpsHeader title="EXECUTION LOGS" subtitle="Tool calls · retry · state deltas" />
      <TacticalPanel title="Emergency Execution Theater" accent="danger">
        <ExecutionLogFeed
          liveLogs={liveLogs}
          dbLogs={execQuery.data?.executions}
        />
      </TacticalPanel>
    </ScrollView>
  );
}
