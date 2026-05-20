import type { CrisisRunState } from '@citybrain/shared';

export { ToolResult } from './tool-result.js';
export {
  EXECUTION_TOOL_DEFINITIONS,
  getExecutionToolDefinition,
  type ExecutionToolDefinition,
} from './execution-tool-definitions.js';

export interface ToolContext {
  crisisId: string;
  logExecution: (entry: {
    tool: string;
    actionId?: string;
    request: unknown;
    response: unknown;
    stateDelta: Record<string, unknown>;
    status?: string;
  }) => Promise<void>;
}

export type ToolHandler = (
  args: Record<string, unknown>,
  state: CrisisRunState,
  ctx: ToolContext
) => Promise<Record<string, unknown>>;

export const TOOL_REGISTRY: Record<string, ToolHandler> = {
  parse_signal: async (args) => ({
    normalized: args.rawText,
    entities: extractEntities(String(args.rawText ?? '')),
  }),
  extract_signal_intelligence: async (args) => ({
    note: 'Handled by Signal Extraction Agent; see execution_logs',
    rawText: args.rawText,
  }),
  geocode: async (args) => ({
    lat: args.lat ?? 33.6844,
    lng: args.lng ?? 73.0479,
    areaLabel: args.areaLabel ?? 'Islamabad',
  }),
  cluster_signals: async (_args, state) => ({
    clusterSize: state.normalizedSignals.length,
    confidence: Math.min(0.95, 0.5 + state.normalizedSignals.length * 0.1),
  }),
  detect_crisis: async (_args, state) => ({
    note: 'Handled by Crisis Detection Agent; see execution_logs',
    signalCount: state.normalizedSignals.length,
  }),
  query_memory: async () => ({
    matches: [
      {
        summary: 'G-10 flash flood Aug 2024 — reroute via IJP delayed 12min',
        outcomeScore: 0.72,
      },
    ],
  }),
  get_weather: async (_args, state) => {
    const flood = state.scenarioKey?.includes('flood');
    return {
      condition: flood ? 'heavy_rain' : 'extreme_heat',
      rainfallMm: flood ? 42 : 0,
      temperatureC: flood ? 24 : 44,
      source: 'simulated',
      live: false,
    };
  },
  get_news: async (_args, state) => ({
    query: state.candidate?.areaLabel ?? 'Pakistan emergency',
    articles: [],
    headlineCount: 0,
    source: 'simulated',
    live: false,
  }),
  get_traffic: async () => ({
    congestionIndex: 0.82,
    incidents: 3,
    avgSpeedKmh: 12,
  }),
  load_sop: async (_args, state) => ({
    sopId: `sop_${state.candidate?.type ?? 'generic'}`,
    steps: ['assess', 'contain', 'notify', 'recover'],
  }),
  build_emergency_plan: async (_args, state) => ({
    note: 'Handled by Emergency Planning Agent',
    crisisType: state.candidate?.type,
  }),
  inventory_status: async () => ({
    ambulances: 4,
    pumps: 6,
    engineers: 8,
    towTrucks: 3,
  }),
  allocate_units: async (_args, state) => ({
    assignments: buildDefaultAssignments(state),
  }),
  google_routes: async () => ({
    alternateRoute: 'Srinagar Hwy → Murree Rd → Kashmir Hwy',
    etaDeltaMinutes: -8,
    congestionDelta: -0.32,
  }),
  apply_road_closure: async (args) => ({
    closedSegment: args.segment ?? 'G-10 Markaz',
    applied: true,
  }),
  draft_alert: async (_args, state) => ({
    en: `CITYBRAIN ALERT: ${state.candidate?.title ?? 'Crisis'} — avoid affected zone. Follow official routes.`,
    ur: 'انتباہ: متاثرہ علاقے سے گریز کریں۔',
    romanUr: 'Alert: mutasira ilaqay se gurez karein.',
  }),
  segment_citizens: async () => ({ reachEstimate: 12400 }),
  simulate_action: async (args, _state, ctx) => {
    await ctx.logExecution({
      tool: 'simulate_action',
      request: args,
      response: { simulated: true },
      stateDelta: { metric: args.metric ?? 'congestion', delta: -0.32 },
    });
    return { simulated: true, status: 'success' };
  },
  create_ticket: async (args) => ({
    ticketId: `TKT-${Date.now().toString(36).toUpperCase()}`,
    unit: args.unit ?? 'ambulance',
    status: 'dispatched',
  }),
  score_outcome: async (_args, state) => {
    const results = state.executionResults ?? [];
    const successRate =
      results.length > 0
        ? results.filter((r) => r.status === 'success').length / results.length
        : 0.75;
    return { outcomeScore: successRate, congestionReduction: 0.32, strandedReduction: 0.18 };
  },
  write_memory: async () => ({ stored: true }),
  reflect_outcome: async (_args, state) => ({
    note: 'Handled by Reflection Agent',
    outcomeScore: state.reflection?.outcomeScore,
    replanRequired: state.replanRequired,
  }),
};

function extractEntities(text: string): string[] {
  const areas = ['G-10', 'G-13', 'I-9', 'Margalla', 'Srinagar', 'Faiz', 'George Town'];
  return areas.filter((a) => text.toLowerCase().includes(a.toLowerCase()));
}

function buildDefaultAssignments(state: CrisisRunState) {
  const c = state.candidate?.centroid ?? { lat: 33.6844, lng: 73.0479 };
  const type = state.candidate?.type ?? 'flood';
  const units: Array<{ unitId: string; type: string; task: string }> = [];

  if (type === 'flood') {
    units.push({ unitId: 'PUMP-03', type: 'pump', task: 'Deploy to waterlogging zone' });
    units.push({ unitId: 'AMB-07', type: 'ambulance', task: 'Standby for rescue' });
  } else if (type === 'accident' || type === 'road_blockage') {
    units.push({ unitId: 'TOW-02', type: 'tow', task: 'Clear blockage' });
    units.push({ unitId: 'AMB-04', type: 'ambulance', task: 'Medical standby' });
  } else if (type === 'heatwave') {
    units.push({ unitId: 'SHELTER-01', type: 'shelter', task: 'Open cooling center' });
  } else {
    units.push({ unitId: 'ENG-05', type: 'engineer', task: 'Grid isolation assessment' });
  }

  return units.map((u, i) => ({
    ...u,
    lat: c.lat + i * 0.002,
    lng: c.lng + i * 0.002,
    etaMinutes: 8 + i * 4,
  }));
}
