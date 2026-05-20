import { View, Text, ScrollView } from 'react-native';
import { colors } from '../../theme/tokens';
import { LEGEND_ITEMS, OVERLAY_COLORS } from '../../lib/map/constants';
import type { MapOverlayFull } from '../../lib/map/types';

interface MapLegendProps {
  overlays: MapOverlayFull[];
}

export function MapLegend({ overlays }: MapLegendProps) {
  const activeTypes = new Set(overlays.map((o) => o.type));
  const items = LEGEND_ITEMS.filter((i) => activeTypes.has(i.type));

  if (items.length === 0) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ marginTop: 8 }}
      contentContainerStyle={{ gap: 6 }}
    >
      {items.map((item) => (
        <View
          key={item.type}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: OVERLAY_COLORS[item.type] ?? colors.border,
            borderRadius: 4,
            paddingHorizontal: 8,
            paddingVertical: 4,
            marginRight: 6,
          }}
        >
          <View
            style={{
              width: 6,
              height: 6,
              borderRadius: 3,
              backgroundColor: OVERLAY_COLORS[item.type] ?? colors.accent,
              marginRight: 6,
            }}
          />
          <Text style={{ color: colors.text, fontSize: 10, fontFamily: 'monospace' }}>
            {item.label.toUpperCase()}
          </Text>
        </View>
      ))}
    </ScrollView>
  );
}
