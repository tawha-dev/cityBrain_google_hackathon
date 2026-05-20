import { z } from 'zod';
import { GeoPointSchema } from './schemas.js';

export const SimulationPhaseSchema = z.enum([
  'idle',
  'crisis_active',
  'response_deployed',
  'mitigating',
  'stabilized',
  'replay',
]);

export const OverlayTypeSchema = z.enum([
  'flood_zone',
  'congestion_corridor',
  'rescue_unit',
  'reroute_path',
  'alert_zone',
  'closed_road',
  'emergency_hotspot',
  'heatmap',
]);

export const MapOverlaySchema = z.object({
  id: z.string(),
  type: OverlayTypeSchema,
  label: z.string().optional(),
  geometry: z.object({
    kind: z.enum(['point', 'polyline', 'polygon', 'circle']),
    coordinates: z.array(GeoPointSchema),
    radiusMeters: z.number().optional(),
  }),
  style: z.object({
    color: z.string(),
    opacity: z.number().min(0).max(1),
    weight: z.number().optional(),
    pulse: z.boolean().optional(),
  }),
  metadata: z.record(z.unknown()).optional(),
});

export const SimulationMetricsSchema = z.object({
  simTimeMinutes: z.number(),
  congestionIndex: z.number(),
  floodCoverageKm2: z.number(),
  strandedVehicles: z.number(),
  activeRescueUnits: z.number(),
  avgRescueEtaMinutes: z.number(),
  rerouteAdoptionPct: z.number(),
  alertsReach: z.number(),
});

export const SimulationFrameSchema = z.object({
  tick: z.number().int(),
  simTimeMs: z.number(),
  phase: SimulationPhaseSchema,
  metrics: SimulationMetricsSchema,
  overlays: z.array(MapOverlaySchema),
  units: z.array(
    z.object({
      id: z.string(),
      type: z.string(),
      position: GeoPointSchema,
      heading: z.number().optional(),
      status: z.string(),
    })
  ),
});

export const TimelineEventSchema = z.object({
  id: z.string(),
  tick: z.number().int(),
  simTimeMs: z.number(),
  category: z.enum([
    'traffic',
    'flood',
    'rescue',
    'reroute',
    'alert',
    'execution',
    'phase',
  ]),
  label: z.string(),
  payload: z.record(z.unknown()).optional(),
});

export const SimulationRunSchema = z.object({
  crisisId: z.string(),
  scenarioKey: z.string().optional(),
  crisisType: z.string(),
  phase: SimulationPhaseSchema,
  totalTicks: z.number(),
  tickDelayMs: z.number(),
  frames: z.array(SimulationFrameSchema),
  timeline: z.array(TimelineEventSchema),
  before: SimulationFrameSchema.optional(),
  after: SimulationFrameSchema.optional(),
  startedAt: z.string(),
  completedAt: z.string().optional(),
});

export type SimulationPhase = z.infer<typeof SimulationPhaseSchema>;
export type MapOverlay = z.infer<typeof MapOverlaySchema>;
export type SimulationMetrics = z.infer<typeof SimulationMetricsSchema>;
export type SimulationFrame = z.infer<typeof SimulationFrameSchema>;
export type TimelineEvent = z.infer<typeof TimelineEventSchema>;
export type SimulationRun = z.infer<typeof SimulationRunSchema>;
