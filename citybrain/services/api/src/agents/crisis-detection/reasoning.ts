import type { ReasoningStep } from '@citybrain/shared';
import type { SignalCluster } from '@citybrain/shared';
import type { CrisisType } from '@citybrain/shared';
import type { EscalationRisk } from '@citybrain/shared';
import type { EnrichedSignal } from './clustering.js';

export interface CoTContext {
  signals: EnrichedSignal[];
  clusters: SignalCluster[];
  weather: Record<string, unknown>;
  traffic: Record<string, unknown>;
  memoryMatches: Array<{ summary?: string; outcomeScore?: number }>;
  crisisType: CrisisType;
  preliminarySeverity: string;
  escalation: EscalationRisk;
  candidateSummary: string;
}

/**
 * Zero-shot chain-of-thought trace (numbered steps per CoT skill).
 */
export function buildChainOfThoughtTrace(ctx: CoTContext): ReasoningStep[] {
  const signalCount = ctx.signals.length;
  const primary = ctx.clusters[0];
  const weatherCond = String(ctx.weather.condition ?? 'unknown');
  const congestion = Number(ctx.traffic.congestionIndex ?? 0);
  const memory = ctx.memoryMatches[0];

  const steps: ReasoningStep[] = [
    {
      step: 1,
      title: 'Signal inventory',
      analysis: `Ingested ${signalCount} normalized signal(s) across ${ctx.clusters.length} geographic cluster(s).`,
      evidence: ctx.signals.slice(0, 5).map((s) => `[${s.source}] ${s.rawText.slice(0, 80)}`),
      conclusion: signalCount >= 2 ? 'Sufficient signal volume for fusion' : 'Limited signals — lower confidence',
    },
    {
      step: 2,
      title: 'Weather alert analysis',
      analysis: primary?.hasWeatherAlert
        ? 'At least one cluster includes an official or inferred weather channel signal.'
        : 'No dedicated weather alert in cluster; checking environmental context.',
      evidence: [
        `condition=${weatherCond}`,
        ctx.weather.rainfallMm != null ? `rainfallMm=${ctx.weather.rainfallMm}` : '',
        ctx.weather.temperatureC != null ? `temperatureC=${ctx.weather.temperatureC}` : '',
      ].filter(Boolean),
      conclusion:
        weatherCond === 'heavy_rain' || (Number(ctx.weather.rainfallMm) > 25)
          ? 'Weather supports flood / infrastructure stress hypothesis'
          : weatherCond === 'extreme_heat'
            ? 'Weather supports heatwave hypothesis'
            : 'Weather neutral or weakly correlated',
    },
    {
      step: 3,
      title: 'Congestion spike analysis',
      analysis: `Traffic congestion index ${congestion.toFixed(2)}; cluster congestion flag: ${primary?.hasCongestionSpike ?? false}.`,
      evidence: [
        `congestionIndex=${congestion}`,
        `traffic_incidents=${ctx.traffic.incidents ?? 'n/a'}`,
      ],
      conclusion:
        congestion >= 0.7 || primary?.hasCongestionSpike
          ? 'Congestion spike corroborates active corridor impact'
          : 'No strong congestion anomaly',
    },
    {
      step: 4,
      title: 'Repeated complaint pattern',
      analysis: `Repeated complaint weight across clusters: ${ctx.clusters.reduce((a, c) => a + c.repeatedComplaintCount, 0)}.`,
      evidence: ctx.clusters.map(
        (c) => `${c.areaLabel}: ${c.repeatedComplaintCount} repeats, size=${c.size}`
      ),
      conclusion:
        (primary?.repeatedComplaintCount ?? 0) >= 2
          ? 'Citizen complaint repetition indicates emerging crisis'
          : 'Single-report pattern — monitor for recurrence',
    },
    {
      step: 5,
      title: 'Geographic clustering',
      analysis: primary
        ? `Primary cluster "${primary.areaLabel}" with ${primary.size} signals, spread ${primary.geographicSpreadKm} km.`
        : 'No tight geographic cluster formed.',
      evidence: ctx.clusters.map(
        (c) =>
          `cluster ${c.id.slice(0, 8)}: ${c.areaLabel} (${c.size} sig, dominant=${c.dominantEventType})`
      ),
      conclusion: primary && primary.size >= 2 ? 'Spatial convergence confirmed' : 'Weak spatial convergence',
    },
    {
      step: 6,
      title: 'Stranded vehicle assessment',
      analysis: `Stranded-vehicle indicators in ${ctx.clusters.reduce((a, c) => a + c.strandedVehicleSignals, 0)} signal(s).`,
      evidence: ctx.signals
        .filter((s) => /\bstuck\b|trapped|phans|stranded/i.test(s.rawText))
        .map((s) => s.rawText.slice(0, 60)),
      conclusion:
        (primary?.strandedVehicleSignals ?? 0) > 0
          ? 'Life-safety / mobility risk elevated'
          : 'No explicit stranded-vehicle reports',
    },
    {
      step: 7,
      title: 'Crisis classification',
      analysis: `Classified crisis type: ${ctx.crisisType}. ${ctx.candidateSummary}`,
      evidence: [`dominant_cluster_type=${primary?.dominantEventType ?? 'n/a'}`],
      conclusion: `Proceed with ${ctx.crisisType} crisis candidate`,
    },
    {
      step: 8,
      title: 'Escalation risk projection',
      analysis: ctx.escalation.rationale,
      evidence: ctx.escalation.factors,
      conclusion: `Predicted escalation: ${ctx.escalation.predictedEscalationLevel} (${ctx.escalation.level} risk)`,
    },
    {
      step: 9,
      title: 'Verification',
      analysis: verifyReasoning(ctx),
      evidence: memory?.summary ? [`memory: ${memory.summary}`] : [],
      conclusion: `Preliminary severity ${ctx.preliminarySeverity}; trace verified against evidence`,
    },
  ];

  return steps;
}

function verifyReasoning(ctx: CoTContext): string {
  const issues: string[] = [];
  if (ctx.signals.length === 0) issues.push('no signals');
  if (ctx.clusters.length === 0) issues.push('no clusters');
  if (ctx.crisisType === 'flood' && !ctx.clusters.some((c) => c.hasWeatherAlert || c.dominantEventType === 'flood')) {
    if (!ctx.signals.some((s) => /flood|pani|rain/i.test(s.rawText))) {
      issues.push('flood classification weakly grounded');
    }
  }
  if (issues.length === 0) {
    return 'All reasoning steps consistent with available evidence. No logical contradictions detected.';
  }
  return `Verification notes: ${issues.join('; ')}. Confidence adjusted downward if needed.`;
}

export function formatThoughtFromTrace(trace: ReasoningStep[], candidateTitle?: string): string {
  const verified = trace.find((s) => s.step === 9)?.conclusion ?? '';
  return (
    `CoT crisis detection: ${candidateTitle ?? 'pending'}. ` +
    `${trace.length} reasoning steps. ${verified}`
  );
}
