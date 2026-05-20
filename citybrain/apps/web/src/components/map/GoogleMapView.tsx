import { useCallback, useEffect, useMemo, useState } from 'react';
import { Map, Marker, useMap } from '@vis.gl/react-google-maps';
import { DARK_MAP_STYLE } from './darkMapStyle';
import { hasGoogleMapsKey } from '../../lib/maps';

export interface MapExtraMarker {
  lat: number;
  lng: number;
  label?: string;
  color?: string;
  selected?: boolean;
  /** Moving dispatched unit */
  isUnit?: boolean;
  etaMinutes?: number;
}

export interface MapRoutePolyline {
  points: Array<{ lat: number; lng: number }>;
  color?: string;
  dashed?: boolean;
}

export interface GoogleMapViewProps {
  lat: number;
  lng: number;
  label?: string;
  height?: number | string;
  interactive?: boolean;
  showUserLocation?: boolean;
  onLocationChange?: (lat: number, lng: number) => void;
  crisisType?: string;
  extraMarkers?: MapExtraMarker[];
  routePolylines?: MapRoutePolyline[];
  className?: string;
}

function MapClickHandler({
  interactive,
  onLocationChange,
}: {
  interactive: boolean;
  onLocationChange?: (lat: number, lng: number) => void;
}) {
  const map = useMap();

  useEffect(() => {
    if (!map || !interactive || !onLocationChange) return;
    const listener = map.addListener('click', (e: google.maps.MapMouseEvent) => {
      const ll = e.latLng;
      if (ll) onLocationChange(ll.lat(), ll.lng());
    });
    return () => listener.remove();
  }, [map, interactive, onLocationChange]);

  return null;
}

function MapRecenter({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    if (!map) return;
    map.panTo({ lat, lng });
  }, [map, lat, lng]);
  return null;
}

function MapRoutePolylines({ routes }: { routes: MapRoutePolyline[] }) {
  const map = useMap();

  useEffect(() => {
    if (!map || routes.length === 0) return;
    const lines: google.maps.Polyline[] = [];
    for (const route of routes) {
      if (route.points.length < 2) continue;
      const line = new google.maps.Polyline({
        path: route.points.map((p) => ({ lat: p.lat, lng: p.lng })),
        geodesic: true,
        strokeColor: route.color ?? '#3b8bff',
        strokeOpacity: 0.9,
        strokeWeight: 4,
        icons: route.dashed
          ? [{ icon: { path: 'M 0,-1 0,1', strokeOpacity: 1, scale: 3 }, offset: '0', repeat: '16px' }]
          : undefined,
      });
      line.setMap(map);
      lines.push(line);
    }
    return () => lines.forEach((l) => l.setMap(null));
  }, [map, routes]);

  return null;
}

function GoogleMapEmbedFallback({
  lat,
  lng,
  height,
  label,
}: {
  lat: number;
  lng: number;
  height: number | string;
  label?: string;
}) {
  const src = `https://maps.google.com/maps?q=${lat},${lng}&z=16&output=embed`;
  return (
    <div className="gmap-fallback" style={{ height }}>
      <iframe title={label ?? 'Map'} src={src} className="gmap-fallback__iframe" />
    </div>
  );
}

export function GoogleMapView({
  lat,
  lng,
  label,
  height = 280,
  interactive = false,
  showUserLocation = false,
  onLocationChange,
  crisisType,
  extraMarkers = [],
  routePolylines = [],
  className = '',
}: GoogleMapViewProps) {
  const [userPos, setUserPos] = useState<{ lat: number; lng: number } | null>(null);
  const center = useMemo(() => ({ lat, lng }), [lat, lng]);

  const incidentIcon = useMemo(() => {
    const color = crisisType === 'accident' ? '#ff3b5c' : crisisType === 'flood' ? '#3b8bff' : '#00ffc6';
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="48" viewBox="0 0 36 48"><path fill="${color}" d="M18 0C8 0 0 8 0 18c0 13 18 30 18 30s18-17 18-30C36 8 28 0 18 0z"/><circle fill="#fff" cx="18" cy="18" r="7"/></svg>`;
    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
  }, [crisisType]);

  const userIcon = useMemo(() => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><circle cx="12" cy="12" r="10" fill="#00ffc6" opacity="0.35"/><circle cx="12" cy="12" r="5" fill="#00ffc6"/><circle cx="12" cy="12" r="2.5" fill="#0b0f14"/></svg>`;
    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
  }, []);

  const makeFacilityIcon = useCallback((color: string, selected: boolean) => {
    const stroke = selected ? '#fff' : color;
    const fill = selected ? color : `${color}cc`;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="36" viewBox="0 0 28 36"><path fill="${fill}" stroke="${stroke}" stroke-width="2" d="M14 0C6 0 0 6 0 14c0 10 14 22 14 22s14-12 14-22C28 6 22 0 14 0z"/><rect fill="#0b0f14" x="10" y="8" width="8" height="8" rx="1"/></svg>`;
    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
  }, []);

  const unitIcon = useMemo(() => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><circle cx="16" cy="16" r="14" fill="#00e5a0" opacity="0.35"/><circle cx="16" cy="16" r="8" fill="#00e5a0"/><path fill="#0b0f14" d="M10 16h12v2H10zM15 11v10h2V11z"/></svg>`;
    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
  }, []);

  const trackUser = useCallback(() => {
    if (!showUserLocation || !navigator.geolocation) return;
    const watchId = navigator.geolocation.watchPosition(
      (pos) => setUserPos({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => undefined,
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [showUserLocation]);

  useEffect(() => trackUser(), [trackUser]);

  if (!hasGoogleMapsKey()) {
    return <GoogleMapEmbedFallback lat={lat} lng={lng} height={height} label={label} />;
  }

  return (
    <div className={`gmap-wrap ${className}`} style={{ height }}>
      <Map
        defaultCenter={center}
        center={center}
        defaultZoom={16}
        zoom={16}
        gestureHandling="greedy"
        disableDefaultUI={false}
        clickableIcons={false}
        styles={DARK_MAP_STYLE}
        className="gmap-wrap__map"
      >
        <MapRecenter lat={lat} lng={lng} />
        <MapRoutePolylines routes={routePolylines} />
        <MapClickHandler interactive={interactive} onLocationChange={onLocationChange} />
        <Marker
          position={{ lat, lng }}
          draggable={interactive}
          icon={incidentIcon}
          title={label ?? 'Incident location'}
          onDragEnd={(e) => {
            const ll = e.latLng;
            if (ll && onLocationChange) onLocationChange(ll.lat(), ll.lng());
          }}
        />
        {userPos && (
          <Marker position={userPos} icon={userIcon} title="Your location" zIndex={1} />
        )}
        {extraMarkers.map((m, i) => (
          <Marker
            key={`${m.lat}-${m.lng}-${i}`}
            position={{ lat: m.lat, lng: m.lng }}
            icon={
              m.isUnit
                ? unitIcon
                : makeFacilityIcon(m.color ?? '#3b8bff', Boolean(m.selected))
            }
            title={
              m.isUnit && m.etaMinutes != null
                ? `${m.label ?? 'Unit'} · ETA ${m.etaMinutes} min`
                : m.label
            }
            zIndex={m.isUnit ? 5 : m.selected ? 3 : 2}
          />
        ))}
      </Map>
      <div className="gmap-wrap__hud">
        <span className="gmap-wrap__tag">LIVE MAP</span>
        <span className="gmap-wrap__coords">
          {lat.toFixed(5)}°N · {lng.toFixed(5)}°E
        </span>
      </div>
      {label && <div className="gmap-wrap__label">{label}</div>}
      <div className="gmap-wrap__legend">
        {showUserLocation && (
          <span>
            <i className="legend-dot legend-dot--user" /> You
          </span>
        )}
        <span>
          <i className="legend-dot legend-dot--pin" /> Incident
        </span>
        {extraMarkers.some((m) => !m.isUnit) && extraMarkers.length > 0 && (
          <span>
            <i className="legend-dot legend-dot--facility" /> Emergency assets
          </span>
        )}
        {extraMarkers.some((m) => m.isUnit) && (
          <span>
            <i className="legend-dot legend-dot--user" /> Dispatched units
          </span>
        )}
      </div>
      {interactive && (
        <p className="gmap-wrap__hint">Tap map or drag pin to set accident location</p>
      )}
    </div>
  );
}
