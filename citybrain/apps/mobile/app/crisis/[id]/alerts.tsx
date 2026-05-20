import { ScrollView } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { colors } from '../../../theme/tokens';
import { OpsHeader } from '../../../components/OpsHeader';
import { TacticalPanel } from '../../../components/ui/TacticalPanel';
import { CitizenAlertFeed } from '../../../components/alerts/CitizenAlertFeed';
import { useCrisisDetail } from '../../../hooks/useCrisisDetail';
import { useCrisisStore } from '../../../lib/store';

export default function CitizenAlertsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { crisis } = useCrisisDetail(id);
  const alerts = useCrisisStore((s) => s.alerts);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: 12 }}
    >
      <OpsHeader title="CITIZEN ALERTS" subtitle="EN · Urdu · Roman Urdu broadcast" />
      <TacticalPanel title="Alert Feed" accent="warn">
        <CitizenAlertFeed alerts={alerts} crisisTitle={String(crisis?.title ?? '')} />
      </TacticalPanel>
    </ScrollView>
  );
}
