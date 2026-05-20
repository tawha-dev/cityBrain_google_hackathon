import { useEffect, useMemo, useState } from 'react';
import type { MapOverlayFull, MapHotspot } from '../../lib/map/types';
import { sortOverlaysByZ } from '../../lib/map/constants';

interface MapOverlayLayersProps {
  overlays: MapOverlayFull[];
  hotspots?: MapHotspot[];
}

export function MapOverlayLayers({ overlays, hotspots = [] }: MapOverlayLayersProps) {
  const sorted = useMemo(() => sortOverlaysByZ(overlays), [overlays]);
  const [pulseOn, setPulseOn] = useState(true);

  useEffect(() => {
    const id = setInterval(() => setPulseOn((p) => !p), 900);
    return () => clearInterval(id);
  }, []);

  try {
    const { Marker, Polyline, Polygon, Circle } = require('react-native-maps');

    return (
      <>
        {sorted.map((o) => {
          const pulseBoost = o.style.pulse && pulseOn ? 0.18 : 0;
          const fillOpacity = Math.min(1, o.style.opacity + pulseBoost);
          const strokeOpacity = Math.min(1, o.style.opacity + 0.15);

          if (o.geometry.kind === 'circle' && o.geometry.coordinates[0]) {
            const center = o.geometry.coordinates[0];
            return (
              <Circle
                key={o.id}
                center={center}
                radius={o.geometry.radiusMeters ?? 400}
                fillColor={hexWithAlpha(o.style.color, fillOpacity * 0.55)}
                strokeColor={hexWithAlpha(o.style.color, strokeOpacity)}
                strokeWidth={o.style.weight ?? 2}
              />
            );
          }

          if (o.geometry.kind === 'polyline' && o.geometry.coordinates.length >= 2) {
            return (
              <Polyline
                key={o.id}
                coordinates={o.geometry.coordinates}
                strokeColor={hexWithAlpha(o.style.color, strokeOpacity)}
                strokeWidth={o.style.weight ?? 4}
                lineDashPattern={o.type === 'reroute_path' ? [12, 6] : undefined}
              />
            );
          }

          if (o.geometry.kind === 'polygon' && o.geometry.coordinates.length >= 3) {
            return (
              <Polygon
                key={o.id}
                coordinates={o.geometry.coordinates}
                fillColor={hexWithAlpha(o.style.color, fillOpacity * 0.5)}
                strokeColor={hexWithAlpha(o.style.color, strokeOpacity)}
                strokeWidth={o.style.weight ?? 2}
              />
            );
          }

          if (o.geometry.kind === 'point' && o.geometry.coordinates[0]) {
            const p = o.geometry.coordinates[0];
            const pin =
              o.type === 'rescue_unit'
                ? '#00FF88'
                : o.type === 'emergency_hotspot'
                  ? '#FF3B5C'
                  : o.style.color;
            return (
              <Marker
                key={o.id}
                coordinate={p}
                title={o.label}
                pinColor={pin}
                opacity={strokeOpacity}
              />
            );
          }

          return null;
        })}

        {hotspots.map((h) => (
          <Marker
            key={h.id}
            coordinate={{ latitude: h.lat, longitude: h.lng }}
            title={h.label}
            description={h.source}
            pinColor={h.priority === 'critical' ? '#FF3B5C' : h.priority === 'high' ? '#FFB020' : '#00FFC6'}
          />
        ))}
      </>
    );
  } catch {
    return null;
  }
}

function hexWithAlpha(hex: string, alpha: number): string {
  const a = Math.round(Math.max(0, Math.min(1, alpha)) * 255)
    .toString(16)
    .padStart(2, '0');
  const h = hex.replace('#', '');
  if (h.length === 6) return `#${h}${a}`;
  return hex;
}
