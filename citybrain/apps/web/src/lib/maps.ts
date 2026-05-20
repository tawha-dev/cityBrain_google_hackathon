export function getGoogleMapsApiKey(): string {
  return import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? '';
}

export function hasGoogleMapsKey(): boolean {
  return Boolean(getGoogleMapsApiKey());
}
