import { ScrollView } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { colors } from '../../../theme/tokens';
import { OpsHeader } from '../../../components/OpsHeader';
import { TacticalPanel } from '../../../components/ui/TacticalPanel';
import { SimulationViewport } from '../../../components/simulation/SimulationViewport';
import { LiveCrisisMap } from '../../../components/map/LiveCrisisMap';
import { useCrisisDetail } from '../../../hooks/useCrisisDetail';
import { useCrisisStore } from '../../../lib/store';

export default function CrisisSimulationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { lat, lng, crisis } = useCrisisDetail(id);
  const simPhase = useCrisisStore((s) => s.simulationPhase);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: 12 }}
    >
      <OpsHeader
        title="CRISIS SIMULATION"
        subtitle={`Physics engine · ${simPhase.toUpperCase()}`}
      />
      <TacticalPanel title="Simulation Engine" accent="info">
        <SimulationViewport />
      </TacticalPanel>
      <TacticalPanel title="Tactical Overlay Map">
        <LiveCrisisMap lat={lat} lng={lng} title={String(crisis?.area_label ?? '')} height={180} />
      </TacticalPanel>
    </ScrollView>
  );
}
