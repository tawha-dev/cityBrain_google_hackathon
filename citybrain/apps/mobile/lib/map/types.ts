export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface MapOverlayFull {
  id: string;
  type: string;
  label?: string;
  geometry: {
    kind: 'point' | 'polyline' | 'polygon' | 'circle';
    coordinates: GeoPoint[];
    radiusMeters?: number;
  };
  style: {
    color: string;
    opacity: number;
    weight?: number;
    pulse?: boolean;
  };
  metadata?: Record<string, unknown>;
}

export interface MapHotspot {
  id: string;
  lat: number;
  lng: number;
  label: string;
  source: string;
  priority: 'normal' | 'high' | 'critical';
}
