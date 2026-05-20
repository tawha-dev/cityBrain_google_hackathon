/**
 * CITYBRAIN // TACTICAL UI — Palantir-inspired cyber operations center
 * DFII: Industrial utilitarian + retro-futurist (single blend: ops terminal)
 */
export const colors = {
  void: '#05080C',
  bg: '#0B0F14',
  surface: '#121820',
  surfaceRaised: '#1A2330',
  border: '#1E2A38',
  borderActive: '#2A3D52',
  accent: '#00FFC6',
  accentDim: '#00FFC620',
  warn: '#FFB020',
  danger: '#FF3B5C',
  dangerDim: '#FF3B5C25',
  info: '#3B8BFF',
  text: '#E8EDF4',
  textMuted: '#6B7A8F',
  textDim: '#4A5568',
  grid: '#0F1419',
  scanline: '#00FFC608',
} as const;

export const typography = {
  mono: 'monospace' as const,
  label: {
    fontSize: 10,
    letterSpacing: 2,
    textTransform: 'uppercase' as const,
    fontFamily: 'monospace' as const,
  },
  title: {
    fontSize: 20,
    fontWeight: '700' as const,
    letterSpacing: 1,
  },
  metric: {
    fontSize: 22,
    fontWeight: '700' as const,
    fontFamily: 'monospace' as const,
  },
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
};

export const radius = {
  sm: 4,
  md: 8,
  lg: 12,
};
