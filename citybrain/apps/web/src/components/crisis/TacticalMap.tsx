import { GoogleMapView, type MapExtraMarker, type MapRoutePolyline } from '../map/GoogleMapView';

interface TacticalMapProps {
  lat?: number;
  lng?: number;
  label?: string;
  crisisType?: string;
  height?: number;
  facilityMarkers?: MapExtraMarker[];
  unitMarkers?: MapExtraMarker[];
  routePolylines?: MapRoutePolyline[];
}

const DEFAULT_LAT = 24.8607;
const DEFAULT_LNG = 67.0011;

export function TacticalMap({
  lat,
  lng,
  label,
  crisisType,
  height = 280,
  facilityMarkers = [],
  unitMarkers = [],
  routePolylines = [],
}: TacticalMapProps) {
  const incidentLat = lat ?? DEFAULT_LAT;
  const incidentLng = lng ?? DEFAULT_LNG;

  return (
    <GoogleMapView
      lat={incidentLat}
      lng={incidentLng}
      label={label}
      crisisType={crisisType}
      height={height}
      showUserLocation={false}
      interactive={false}
      extraMarkers={[...facilityMarkers, ...unitMarkers]}
      routePolylines={routePolylines}
    />
  );
}
