import { useMemo } from 'react';
import { View, Text, Platform } from 'react-native';
import { colors } from '../../theme/tokens';
import { useCrisisStore } from '../../lib/store';
import { MapOverlayLayers } from './MapOverlayLayers';
import { MapLegend } from './MapLegend';

interface LiveCrisisMapProps {
  lat?: number;
  lng?: number;
  title?: string;
  height?: number;
}

export function LiveCrisisMap({ lat = 33.6844, lng = 73.0479, title, height = 220 }: LiveCrisisMapProps) {
  const overlays = useCrisisStore((s) => s.mapOverlays);
  const hotspots = useCrisisStore((s) => s.mapHotspots);
  const metrics = useCrisisStore((s) => s.mapMetrics);
  const simFrame = useCrisisStore((s) => s.simulationFrame);

  const congestion = simFrame?.metrics.congestionIndex ?? metrics.congestionIndex ?? 0.82;
  const floodKm2 = simFrame?.metrics.floodCoverageKm2 ?? metrics.floodCoverageKm2;
  const rescueUnits = simFrame?.metrics.activeRescueUnits ?? metrics.activeRescueUnits;

  const region = useMemo(
    () => ({
      latitude: lat,
      longitude: lng,
      latitudeDelta: 0.06,
      longitudeDelta: 0.06,
    }),
    [lat, lng]
  );

  return (
    <View>
      <View
        style={{
          height,
          borderRadius: 8,
          overflow: 'hidden',
          borderWidth: 1,
          borderColor: colors.borderActive,
          backgroundColor: colors.void,
        }}
      >
        {Platform.OS === 'web' ? (
          <WebTacticalMap lat={lat} lng={lng} overlays={overlays} layerCount={overlays.length} />
        ) : (
          <NativeTacticalMap
            region={region}
            title={title}
            lat={lat}
            lng={lng}
            overlays={overlays}
            hotspots={hotspots}
          />
        )}

        <View style={styles.hudChip}>
          <Text style={styles.hudText}>CONGESTION {(congestion * 100).toFixed(0)}%</Text>
        </View>

        {(floodKm2 != null || rescueUnits != null) && (
          <View style={[styles.hudChip, { top: 36 }]}>
            <Text style={styles.hudText}>
              {floodKm2 != null ? `FLOOD ${floodKm2.toFixed(2)} km²` : ''}
              {floodKm2 != null && rescueUnits != null ? ' · ' : ''}
              {rescueUnits != null ? `RESCUE ${rescueUnits}` : ''}
            </Text>
          </View>
        )}
      </View>

      <MapLegend overlays={overlays} />
    </View>
  );
}

function NativeTacticalMap({
  region,
  title,
  lat,
  lng,
  overlays,
  hotspots,
}: {
  region: { latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number };
  title?: string;
  lat: number;
  lng: number;
  overlays: ReturnType<typeof useCrisisStore.getState>['mapOverlays'];
  hotspots: ReturnType<typeof useCrisisStore.getState>['mapHotspots'];
}) {
  try {
    const MapView = require('react-native-maps').default;
    const { PROVIDER_GOOGLE } = require('react-native-maps');

    return (
      <MapView
        style={{ flex: 1 }}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        initialRegion={region}
        region={region}
        customMapStyle={darkMapStyle}
        mapType="standard"
      >
        <MapOverlayLayers overlays={overlays} hotspots={hotspots} />
        {overlays.length === 0 && (
          <MapOverlayLayers
            overlays={[
              {
                id: 'fallback-centroid',
                type: 'emergency_hotspot',
                label: title,
                geometry: { kind: 'point', coordinates: [{ lat, lng }] },
                style: { color: '#FF3B5C', opacity: 1, pulse: true },
              },
            ]}
          />
        )}
      </MapView>
    );
  } catch {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: colors.accent, fontFamily: 'monospace' }}>
          [{lat.toFixed(4)}, {lng.toFixed(4)}]
        </Text>
      </View>
    );
  }
}

function WebTacticalMap({
  lat,
  lng,
  overlays,
  layerCount,
}: {
  lat: number;
  lng: number;
  overlays: ReturnType<typeof useCrisisStore.getState>['mapOverlays'];
  layerCount: number;
}) {
  const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
  const embedUrl = apiKey
    ? `https://www.google.com/maps/embed/v1/view?key=${apiKey}&center=${lat},${lng}&zoom=14&maptype=satellite`
    : `https://maps.google.com/maps?q=${lat},${lng}&z=14&output=embed`;

  return (
    <View style={{ flex: 1 }}>
      <iframe title="Tactical Map" src={embedUrl} style={{ width: '100%', height: '100%', border: 0 }} />
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          inset: 0,
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <View
          style={{
            width: 120,
            height: 120,
            borderRadius: 60,
            borderWidth: 2,
            borderColor: '#0066FF88',
            backgroundColor: '#0066FF22',
          }}
        />
      </View>
      <View style={{ position: 'absolute', bottom: 8, right: 8, backgroundColor: '#0B0F14CC', padding: 6 }}>
        <Text style={{ color: colors.textMuted, fontSize: 9, fontFamily: 'monospace' }}>
          {overlays.length} LAYERS · WEB
        </Text>
      </View>
    </View>
  );
}

const styles = {
  hudChip: {
    position: 'absolute' as const,
    top: 8,
    left: 8,
    backgroundColor: '#0B0F14DD',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  hudText: {
    color: colors.accent,
    fontSize: 10,
    fontFamily: 'monospace',
  },
};

const darkMapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#0B0F14' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#1E2A38' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#003344' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
];
