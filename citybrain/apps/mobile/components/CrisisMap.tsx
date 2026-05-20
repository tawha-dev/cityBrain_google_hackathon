import { View, Text, Platform } from 'react-native';

interface CrisisMapProps {
  lat?: number;
  lng?: number;
  title?: string;
}

export function CrisisMap({ lat = 33.6844, lng = 73.0479, title }: CrisisMapProps) {
  if (Platform.OS === 'web') {
    const mapsKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
    const src = mapsKey
      ? `https://www.google.com/maps/embed/v1/view?key=${mapsKey}&center=${lat},${lng}&zoom=14&maptype=satellite`
      : `https://maps.google.com/maps?q=${lat},${lng}&z=14&output=embed`;

    return (
      <View style={{ height: 200, borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: '#1E2A38' }}>
        <iframe
          title="Crisis Map"
          src={src}
          style={{ width: '100%', height: '100%', border: 0 }}
          allowFullScreen
        />
      </View>
    );
  }

  try {
    const MapView = require('react-native-maps').default;
    const Marker = require('react-native-maps').Marker;
    return (
      <MapView
        style={{ height: 200, borderRadius: 8 }}
        initialRegion={{
          latitude: lat,
          longitude: lng,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
        customMapStyle={darkMapStyle}
      >
        <Marker coordinate={{ latitude: lat, longitude: lng }} title={title} pinColor="#FF3B5C" />
      </MapView>
    );
  } catch {
    return (
      <View style={{ height: 200, backgroundColor: '#0B0F14', justifyContent: 'center', alignItems: 'center', borderRadius: 8, borderWidth: 1, borderColor: '#1E2A38' }}>
        <Text style={{ color: '#00FFC6', fontFamily: 'monospace' }}>
          MAP [{lat.toFixed(4)}, {lng.toFixed(4)}]
        </Text>
        {title && <Text style={{ color: '#6B7A8F', marginTop: 4 }}>{title}</Text>}
      </View>
    );
  }
}

const darkMapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#0B0F14' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#6B7A8F' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#1E2A38' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#003344' }] },
];
