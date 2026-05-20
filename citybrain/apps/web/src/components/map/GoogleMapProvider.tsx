import { APIProvider } from '@vis.gl/react-google-maps';
import { getGoogleMapsApiKey, hasGoogleMapsKey } from '../../lib/maps';

interface GoogleMapProviderProps {
  children: React.ReactNode;
}

export function GoogleMapProvider({ children }: GoogleMapProviderProps) {
  const apiKey = getGoogleMapsApiKey();
  if (!hasGoogleMapsKey()) {
    return <>{children}</>;
  }
  return <APIProvider apiKey={apiKey}>{children}</APIProvider>;
}
