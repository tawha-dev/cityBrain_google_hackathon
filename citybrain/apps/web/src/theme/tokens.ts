/** Design tokens — vibrant command-center palette */
export const colors = {
  void: '#0A0E1A',
  bg: '#101828',
  bgMid: '#152238',
  surface: '#1C2A45',
  surfaceRaised: '#243352',
  border: '#334766',
  borderActive: '#4A6494',
  accent: '#3DFFC8',
  accent2: '#6B8CFF',
  accentGlow: 'rgba(61, 255, 200, 0.45)',
  warn: '#FFBE3D',
  danger: '#FF5C7A',
  info: '#5EB3FF',
  purple: '#B794FF',
  coral: '#FF8F6B',
  mint: '#5DFFE0',
  text: '#F0F4FC',
  textMuted: '#9AA8C4',
  textDim: '#6D7D9C',
} as const;

export const AGENT_ORDER = [
  'signal_extraction',
  'crisis_detection',
  'severity_reasoning',
  'planning',
  'resource_allocation',
  'traffic_rerouting',
  'citizen_alert',
  'execution',
  'reflection',
] as const;

export const AGENT_LABELS: Record<string, string> = {
  signal_extraction: 'Signal Extract',
  crisis_detection: 'Crisis Detect',
  severity_reasoning: 'Severity',
  planning: 'Planning',
  resource_allocation: 'Resources',
  traffic_rerouting: 'Traffic',
  citizen_alert: 'Alerts',
  execution: 'Execution',
  reflection: 'Reflection',
};

export const SOURCE_ICONS: Record<string, string> = {
  social: '◉',
  weather: '☁',
  traffic: '⬡',
  field_report: '✦',
  sensor: '◎',
  citizen: '◇',
};
