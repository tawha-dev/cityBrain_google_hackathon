import { useState } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { postApi } from '../lib/api';
import { TacticalPanel } from '../components/ui/TacticalPanel';
import { useCrisisStore } from '../lib/store';
import { colors } from '../theme/tokens';

const SCENARIOS = [
  {
    key: 'karachi_flood',
    label: '★ Karachi Heavy Rain Flood',
    desc: 'Cinematic demo — Clifton/Saddar, PMD alert, drain breach, rescue surge',
  },
  { key: 'g10_flood', label: 'G-10 Urban Flood', desc: 'Roman Urdu social + rain + traffic spike' },
  { key: 'margalla_heat', label: 'Margalla Heatwave', desc: 'Extreme heat + hospital surge' },
  { key: 'srinagar_accident', label: 'Srinagar Accident', desc: 'Collision + traffic standstill' },
  { key: 'i9_grid', label: 'I-9 Grid Failure', desc: 'Power collapse + signal failure' },
  { key: 'faiz_road_block', label: 'Faiz Road Block', desc: 'Truck overturn + congestion' },
];

export default function DemoControl() {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const resetLiveState = useCrisisStore((s) => s.resetLiveState);
  const setSelected = useCrisisStore((s) => s.setSelectedCrisis);

  async function launch(key: string) {
    setLoading(key);
    resetLiveState();
    try {
      const res = await postApi<{ crisisId: string }>(`/demo/scenarios/${key}/run`);
      setSelected(res.crisisId);
      setTimeout(() => {
        router.push(`/crisis/${res.crisisId}`);
      }, 500);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Scenario failed';
      Alert.alert('Launch failed', msg);
      console.error(e);
    } finally {
      setLoading(null);
    }
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16 }}>
      <Text style={{ color: '#6B7A8F', marginBottom: 16, fontFamily: 'monospace', fontSize: 12 }}>
        One-click crisis scenarios — launch ★ Karachi for judge demo
      </Text>

      {SCENARIOS.map((s) => (
        <Pressable
          key={s.key}
          onPress={() => launch(s.key)}
          disabled={loading !== null}
          style={{ marginBottom: 10 }}
        >
          <TacticalPanel
            title={s.label}
            accent={s.key === 'karachi_flood' || s.key === 'g10_flood' ? 'danger' : 'default'}
          >
            <Text style={{ color: '#aaa', fontSize: 12, marginBottom: 8 }}>{s.desc}</Text>
            {loading === s.key ? (
              <ActivityIndicator color="#00FFC6" />
            ) : (
              <Text style={{ color: '#00FFC6', fontFamily: 'monospace', fontSize: 11 }}>
                ▶ EXECUTE SCENARIO
              </Text>
            )}
          </TacticalPanel>
        </Pressable>
      ))}
    </ScrollView>
  );
}
