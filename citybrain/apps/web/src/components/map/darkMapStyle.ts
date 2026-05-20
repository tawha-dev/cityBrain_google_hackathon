/** Colorful night-map style for Google Maps */
export const DARK_MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#1a2848' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#9aa8c4' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#101828' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2a3d62' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#4a6494' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#3d5280' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0e4d6e' }] },
  { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#1e3050' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
];
