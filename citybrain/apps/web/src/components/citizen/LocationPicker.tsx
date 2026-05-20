import { useCallback, useState } from 'react';
import { GoogleMapView } from '../map/GoogleMapView';

interface LocationPickerProps {
  lat: number;
  lng: number;
  onChange: (lat: number, lng: number) => void;
}

export function LocationPicker({ lat, lng, onChange }: LocationPickerProps) {
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const useMyLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported in this browser.');
      return;
    }
    setLocating(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onChange(pos.coords.latitude, pos.coords.longitude);
        setLocating(false);
      },
      () => {
        setError('Could not access GPS. Tap the map or drag the pin.');
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 12000 }
    );
  }, [onChange]);

  return (
    <div className="location-picker">
      <div className="location-picker__toolbar">
        <button type="button" className="btn btn--ghost btn--sm" onClick={useMyLocation} disabled={locating}>
          {locating ? 'Locating…' : '◎ Use my GPS location'}
        </button>
        <span className="location-picker__coords">
          {lat.toFixed(5)}°N · {lng.toFixed(5)}°E
        </span>
      </div>
      {error && <p className="location-picker__error">{error}</p>}
      <GoogleMapView
        lat={lat}
        lng={lng}
        height={320}
        interactive
        showUserLocation
        crisisType="accident"
        onLocationChange={onChange}
        label="Accident location"
      />
    </div>
  );
}
