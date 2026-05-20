import { v4 as uuid } from 'uuid';
import type { Signal } from '@citybrain/shared';
import * as repo from '../../db/repository.js';
import { broadcast } from '../../ws/hub.js';
import { reverseGeocode } from '../../integrations/google-maps.js';
import { fetchLiveWeather } from '../../integrations/openweather.js';
import { fetchLiveNews } from '../../integrations/newsapi.js';
import { verifySocialSignals } from '../../integrations/social-verify.js';
import {
  findNearbyEmergencyResources,
  normalizeIncidentKind,
  getIncidentLabel,
} from '../nearby-resources/service.js';
import { runPipelineInBackground } from '../../orchestrator/pipeline-runner.js';
import { computeValidationScore, weatherCorroboratesCategory } from './validation-score.js';
import {
  averageSignalConfidence,
  estimateDemoValidationPercent,
  getCitizenDemoScenario,
  mapScenarioToCitizenCategory,
  pickPrimaryCitizenSignal,
} from '../citizen-demo/scenarios.js';

export interface CitizenReportInput {
  deviceId: string;
  rawText: string;
  category: string;
  language?: string;
  location?: { lat: number; lng: number };
  mediaUrls?: string[];
}

const CATEGORY_TO_CRISIS: Record<string, string> = {
  flood: 'flood',
  urban_flood: 'flood',
  tsunami: 'tsunami',
  earthquake: 'earthquake',
  landslide: 'landslide',
  rain_alert: 'flood',
  heavy_rain: 'flood',
  rain_monsoon: 'flood',
  storm: 'flood',
  fire: 'infrastructure_failure',
  accident: 'accident',
  other: 'road_blockage',
};

function emitProgress(reportId: string, crisisId: string | undefined, step: string, label: string) {
  broadcast({
    type: 'citizen.progress',
    reportId,
    crisisId,
    timestamp: new Date().toISOString(),
    payload: { reportId, crisisId, step, label },
  });
}

function emitReportUpdated(
  reportId: string,
  crisisId: string | undefined,
  status: string,
  extra?: Record<string, unknown>
) {
  broadcast({
    type: 'citizen.report.updated',
    reportId,
    crisisId,
    timestamp: new Date().toISOString(),
    payload: { reportId, crisisId, status, ...extra },
  });
}

export async function processCitizenReport(
  input: CitizenReportInput,
  options?: { demoScenarioKey?: string }
): Promise<{
  reportId: string;
  crisisId: string;
  correlationId: string;
  expectedConfidence?: number;
}> {
  const demoScenarioKey = options?.demoScenarioKey;
  const demoScenario = demoScenarioKey ? getCitizenDemoScenario(demoScenarioKey) : undefined;
  if (demoScenarioKey && !demoScenario) {
    throw new Error(`Unknown demo scenario: ${demoScenarioKey}`);
  }

  const correlationId = uuid();
  const primary = demoScenario ? pickPrimaryCitizenSignal(demoScenario) : undefined;
  const lat = input.location?.lat ?? primary?.location?.lat ?? 24.8607;
  const lng = input.location?.lng ?? primary?.location?.lng ?? 67.0011;
  const category =
    demoScenario != null
      ? mapScenarioToCitizenCategory(demoScenario.crisisType)
      : input.category || 'other';

  const reportId = await repo.createCitizenReport({
    deviceId: input.deviceId,
    rawText: input.rawText,
    category,
    language: input.language ?? 'en',
    lat,
    lng,
    metadata: {
      correlationId,
      mediaUrls: input.mediaUrls ?? [],
      demoScenarioKey: demoScenarioKey ?? null,
      timeline: [
        {
          step: 'submitted',
          label: demoScenarioKey
            ? `Demo scenario started — ${demoScenario!.title}`
            : 'Report received',
          at: new Date().toISOString(),
        },
      ],
    },
  });

  emitProgress(reportId, undefined, 'submitted', 'Report received — starting verification');
  emitReportUpdated(reportId, undefined, 'validating');

  const crisisId = await repo.createCrisis({
    scenarioKey: demoScenarioKey,
    type: CATEGORY_TO_CRISIS[category] ?? demoScenario?.crisisType ?? 'flood',
    title: demoScenario?.title ?? `Citizen report: ${category}`,
    areaLabel: demoScenario?.areaLabel ?? 'Resolving location…',
    status: 'detecting',
  });

  await repo.linkCitizenReportToCrisis(reportId, crisisId);

  runCitizenPipeline(
    reportId,
    crisisId,
    { ...input, category, language: input.language ?? primary?.language ?? 'en' },
    lat,
    lng,
    category,
    correlationId,
    demoScenarioKey
  ).catch((err) => {
    console.error('[citizen-ingest]', reportId, err);
    repo.updateCitizenReportMetadata(reportId, { status: 'failed', error: String(err) }).catch(() => {});
    emitProgress(reportId, crisisId, 'agents', 'AI analysis failed — check server logs');
    emitReportUpdated(reportId, crisisId, 'failed');
  });

  return {
    reportId,
    crisisId,
    correlationId,
    expectedConfidence: demoScenario
      ? estimateDemoValidationPercent(demoScenario)
      : undefined,
  };
}

async function runCitizenDemoPipeline(
  reportId: string,
  crisisId: string,
  input: CitizenReportInput,
  category: string,
  correlationId: string,
  demoScenarioKey: string,
  demoScenario: NonNullable<ReturnType<typeof getCitizenDemoScenario>>
) {
  const primary = pickPrimaryCitizenSignal(demoScenario);
  const resolvedLat = primary.location?.lat ?? 24.8607;
  const resolvedLng = primary.location?.lng ?? 67.0011;
  const areaLabel = demoScenario.areaLabel;
  const avgScenarioConf = averageSignalConfidence(demoScenario);

  const timeline: Array<{ step: string; label: string; at: string }> = [
    {
      step: 'submitted',
      label: `Demo: ${demoScenario.title}`,
      at: new Date().toISOString(),
    },
  ];

  emitProgress(reportId, crisisId, 'geocode', 'Applying demo scenario location…');
  await repo.updateCitizenReport(reportId, {
    lat: resolvedLat,
    lng: resolvedLng,
    areaLabel,
    status: 'enriching',
  });
  await repo.updateCrisis(crisisId, {
    areaLabel,
    centroidLat: resolvedLat,
    centroidLng: resolvedLng,
    title: demoScenario.title,
    type: CATEGORY_TO_CRISIS[category] ?? demoScenario.crisisType,
  });
  timeline.push({
    step: 'geocode',
    label: `Location: ${areaLabel}`,
    at: new Date().toISOString(),
  });

  const signalIds: string[] = [];
  const citizenSignalId = await repo.createSignal({
    source: 'field_report',
    rawText: input.rawText,
    language: input.language ?? primary.language ?? 'en',
    lat: resolvedLat,
    lng: resolvedLng,
    areaLabel,
    confidence: Math.min(0.98, avgScenarioConf + 0.03),
  });
  signalIds.push(citizenSignalId);
  await repo.linkSignalToCrisis(crisisId, citizenSignalId);

  broadcast({
    type: 'signal.new',
    crisisId,
    reportId,
    timestamp: new Date().toISOString(),
    payload: { id: citizenSignalId, source: 'citizen', rawText: input.rawText, areaLabel },
  });

  emitProgress(reportId, crisisId, 'weather', 'Injecting corroborating demo signals…');
  for (const sig of demoScenario.signals) {
    const id = await repo.createSignal({
      source: sig.source,
      rawText: sig.rawText,
      language: sig.language,
      lat: sig.location?.lat ?? resolvedLat,
      lng: sig.location?.lng ?? resolvedLng,
      areaLabel: sig.areaLabel ?? areaLabel,
      confidence: sig.confidence,
    });
    signalIds.push(id);
    await repo.linkSignalToCrisis(crisisId, id);
    broadcast({
      type: 'signal.new',
      crisisId,
      reportId,
      timestamp: new Date().toISOString(),
      payload: { id, ...sig },
    });
  }

  const hasWeather = demoScenario.signals.some((s) => s.source === 'weather');
  const socialSignals = demoScenario.signals.filter((s) => s.source === 'social');
  const socialScore = socialSignals.length
    ? Math.max(...socialSignals.map((s) => s.confidence))
    : 0.9;
  const newsHits = Math.max(2, Math.min(3, socialSignals.length + (hasWeather ? 1 : 0)));

  timeline.push({
    step: 'weather',
    label: hasWeather ? 'Weather alerts corroborate scenario' : 'Environmental checks complete',
    at: new Date().toISOString(),
  });
  timeline.push({
    step: 'news',
    label: `${newsHits} corroborating media/social signals (demo)`,
    at: new Date().toISOString(),
  });
  timeline.push({
    step: 'social',
    label: `Social verification score ${Math.round(socialScore * 100)}% (demo)`,
    at: new Date().toISOString(),
  });

  const incidentKind = normalizeIncidentKind(category);
  emitProgress(
    reportId,
    crisisId,
    'nearby',
    `Locating nearby resources for ${getIncidentLabel(incidentKind)}…`
  );
  const nearbyResources = await findNearbyEmergencyResources(resolvedLat, resolvedLng, {
    withRoutes: false,
    incidentKind,
    category,
  });
  if (nearbyResources.length > 0) {
    const nearestKm = ((nearbyResources[0]?.distanceMeters ?? 0) / 1000).toFixed(1);
    timeline.push({
      step: 'nearby',
      label: `${nearbyResources.length} emergency assets found — nearest ${nearestKm} km`,
      at: new Date().toISOString(),
    });
  }

  const preliminaryScore = computeValidationScore({
    geocoded: true,
    weatherCorroborates: hasWeather,
    newsHits,
    socialScore,
    agentConfidence: avgScenarioConf,
  });

  const socialSummary = {
    summary: `Demo scenario: ${socialSignals.length} social signals, avg confidence ${Math.round(avgScenarioConf * 100)}%`,
    socialScore,
    corroborationLevel: 'high' as const,
  };

  await repo.updateCitizenReportMetadata(reportId, {
    status: 'analyzing',
    validation: preliminaryScore,
    social: socialSummary,
    nearbyResources,
    incidentKind,
    demoScenarioKey,
    newsHits,
    correlationId,
    timeline,
  });

  emitProgress(reportId, crisisId, 'agents', 'Notifying authorities — AI analysis in progress…');
  timeline.push({
    step: 'agents',
    label: 'Notifying authorities — AI analysis in progress…',
    at: new Date().toISOString(),
  });

  await repo.updateCitizenReport(reportId, { status: 'analyzing' });
  await repo.updateCitizenReportMetadata(reportId, { timeline });

  const rawSignals: Signal[] = await buildSignalsForPipeline(crisisId, signalIds);
  const finalState = await runPipelineInBackground(
    crisisId,
    rawSignals,
    demoScenarioKey,
    reportId
  );

  const agentConfidence = Math.max(
    finalState?.candidate?.confidence ?? 0,
    avgScenarioConf
  );
  const validation = computeValidationScore({
    geocoded: true,
    weatherCorroborates: hasWeather,
    newsHits,
    socialScore,
    agentConfidence,
  });

  timeline.push({
    step: 'complete',
    label: `Authority notified — validation score ${validation.total}%`,
    at: new Date().toISOString(),
  });

  await repo.updateCitizenReport(reportId, {
    status: 'authority_notified',
    verified: validation.total >= 60,
    confidence: validation.total / 100,
  });

  await repo.updateCitizenReportMetadata(reportId, {
    validation,
    social: socialSummary,
    nearbyResources,
    timeline,
    demoScenarioKey,
    crisisConfidence: agentConfidence,
    escalation: finalState?.severity?.escalationLevel,
  });

  emitReportUpdated(reportId, crisisId, 'authority_notified', {
    validationScore: validation.total,
    validation,
    escalation: finalState?.severity?.escalationLevel,
    demoScenarioKey,
  });

  emitProgress(
    reportId,
    crisisId,
    'complete',
    `Demo complete — ${validation.total}% validation confidence.`
  );
}

async function runCitizenPipeline(
  reportId: string,
  crisisId: string,
  input: CitizenReportInput,
  lat: number,
  lng: number,
  category: string,
  correlationId: string,
  demoScenarioKey?: string
) {
  const demoScenario = demoScenarioKey ? getCitizenDemoScenario(demoScenarioKey) : undefined;
  if (demoScenario) {
    await runCitizenDemoPipeline(
      reportId,
      crisisId,
      input,
      category,
      correlationId,
      demoScenarioKey!,
      demoScenario
    );
    return;
  }
  const timeline: Array<{ step: string; label: string; at: string }> = [
    { step: 'submitted', label: 'Report received', at: new Date().toISOString() },
  ];

  emitProgress(reportId, crisisId, 'geocode', 'Verifying your location…');
  const geocoded = await reverseGeocode(lat, lng);
  const areaLabel = geocoded?.areaLabel ?? 'Reported area';
  const resolvedLat = geocoded?.lat ?? lat;
  const resolvedLng = geocoded?.lng ?? lng;

  await repo.updateCitizenReport(reportId, {
    lat: resolvedLat,
    lng: resolvedLng,
    areaLabel,
    status: 'enriching',
  });
  await repo.updateCrisis(crisisId, {
    areaLabel,
    centroidLat: resolvedLat,
    centroidLng: resolvedLng,
    title: `Citizen alert: ${category} — ${areaLabel}`,
  });
  timeline.push({ step: 'geocode', label: `Location: ${areaLabel}`, at: new Date().toISOString() });

  const signalIds: string[] = [];
  const citizenSignalId = await repo.createSignal({
    source: 'field_report',
    rawText: input.rawText,
    language: input.language ?? 'en',
    lat: resolvedLat,
    lng: resolvedLng,
    areaLabel,
    confidence: 0.85,
  });
  signalIds.push(citizenSignalId);
  await repo.linkSignalToCrisis(crisisId, citizenSignalId);

  broadcast({
    type: 'signal.new',
    crisisId,
    reportId,
    timestamp: new Date().toISOString(),
    payload: { id: citizenSignalId, source: 'citizen', rawText: input.rawText, areaLabel },
  });

  emitProgress(reportId, crisisId, 'weather', 'Checking weather conditions…');
  const weather = await fetchLiveWeather(resolvedLat, resolvedLng, areaLabel);
  let weatherCorroborates = false;
  if (weather) {
    weatherCorroborates = weatherCorroboratesCategory(weather.condition, category, weather.rainfallMm);
    const wId = await repo.createSignal({
      source: 'weather',
      rawText: `LIVE WEATHER: ${weather.description} — ${weather.temperatureC}°C, rain ${weather.rainfallMm}mm/h`,
      language: 'en',
      lat: resolvedLat,
      lng: resolvedLng,
      areaLabel,
      confidence: 0.92,
    });
    signalIds.push(wId);
    await repo.linkSignalToCrisis(crisisId, wId);
    timeline.push({
      step: 'weather',
      label: `Weather: ${weather.description}`,
      at: new Date().toISOString(),
    });
  }

  emitProgress(reportId, crisisId, 'news', 'Scanning news sources…');
  const newsQuery = `${areaLabel} ${category} Pakistan emergency`;
  const news = await fetchLiveNews(newsQuery, 5);
  let newsHits = 0;
  if (news?.articles.length) {
    newsHits = news.articles.length;
    for (const article of news.articles.slice(0, 3)) {
      const nId = await repo.createSignal({
        source: 'social',
        rawText: `[NEWS] ${article.title}`,
        language: 'en',
        lat: resolvedLat,
        lng: resolvedLng,
        areaLabel,
        confidence: 0.75,
      });
      signalIds.push(nId);
      await repo.linkSignalToCrisis(crisisId, nId);
    }
    timeline.push({
      step: 'news',
      label: `${newsHits} related news article(s) found`,
      at: new Date().toISOString(),
    });
  }

  emitProgress(reportId, crisisId, 'social', 'Analyzing social & media signals…');
  const social = await verifySocialSignals(areaLabel, category, resolvedLat, resolvedLng);
  const socialId = await repo.createSignal({
    source: 'social',
    rawText: `[SOCIAL VERIFY] ${social.summary}`,
    language: 'en',
    lat: resolvedLat,
    lng: resolvedLng,
    areaLabel,
    confidence: social.socialScore,
  });
  signalIds.push(socialId);
  await repo.linkSignalToCrisis(crisisId, socialId);
  timeline.push({
    step: 'social',
    label: social.summary,
    at: new Date().toISOString(),
  });

  const incidentKind = normalizeIncidentKind(category);
  emitProgress(
    reportId,
    crisisId,
    'nearby',
    `Locating nearby resources for ${getIncidentLabel(incidentKind)}…`
  );
  const nearbyResources = await findNearbyEmergencyResources(resolvedLat, resolvedLng, {
    withRoutes: false,
    incidentKind,
    category,
  });
  if (nearbyResources.length > 0) {
    const nearestKm = ((nearbyResources[0]?.distanceMeters ?? 0) / 1000).toFixed(1);
    timeline.push({
      step: 'nearby',
      label: `${nearbyResources.length} emergency assets found (${getIncidentLabel(incidentKind)}) — nearest ${nearestKm} km`,
      at: new Date().toISOString(),
    });
  }

  const preliminaryScore = computeValidationScore({
    geocoded: Boolean(geocoded),
    weatherCorroborates,
    newsHits,
    socialScore: social.socialScore,
  });

  await repo.updateCitizenReportMetadata(reportId, {
    status: 'analyzing',
    validation: preliminaryScore,
    social,
    nearbyResources,
    incidentKind,
    weather: weather ?? null,
    newsHits,
    correlationId,
    timeline,
  });

  emitProgress(reportId, crisisId, 'agents', 'Notifying authorities — AI analysis in progress…');
  timeline.push({
    step: 'agents',
    label: 'Notifying authorities — AI analysis in progress…',
    at: new Date().toISOString(),
  });

  await repo.updateCitizenReport(reportId, { status: 'analyzing' });
  await repo.updateCitizenReportMetadata(reportId, { timeline });

  const rawSignals: Signal[] = await buildSignalsForPipeline(crisisId, signalIds);

  const finalState = await runPipelineInBackground(crisisId, rawSignals, undefined, reportId);

  const agentConfidence = finalState?.candidate?.confidence ?? 0.5;
  const validation = computeValidationScore({
    geocoded: Boolean(geocoded),
    weatherCorroborates,
    newsHits,
    socialScore: social.socialScore,
    agentConfidence,
  });

  timeline.push({
    step: 'complete',
    label: `Authority notified — validation score ${validation.total}%`,
    at: new Date().toISOString(),
  });

  await repo.updateCitizenReport(reportId, {
    status: 'authority_notified',
    verified: validation.total >= 60,
    confidence: validation.total / 100,
  });

  await repo.updateCitizenReportMetadata(reportId, {
    validation,
    social,
    nearbyResources,
    timeline,
    crisisConfidence: agentConfidence,
    escalation: finalState?.severity?.escalationLevel,
  });

  emitReportUpdated(reportId, crisisId, 'authority_notified', {
    validationScore: validation.total,
    validation,
    escalation: finalState?.severity?.escalationLevel,
  });

  emitProgress(reportId, crisisId, 'complete', 'Your report has been validated and sent to authorities.');
}

async function buildSignalsForPipeline(crisisId: string, _signalIds: string[]): Promise<Signal[]> {
  const rows = await repo.getSignalsForCrisis(crisisId);
  return rows.map((s: Record<string, unknown>) => ({
    id: String(s.id),
    source: s.source as Signal['source'],
    rawText: String(s.raw_text),
    language: (s.language as Signal['language']) ?? 'en',
    entities: [],
    location: s.lat != null ? { lat: Number(s.lat), lng: Number(s.lng) } : undefined,
    areaLabel: s.area_label ? String(s.area_label) : undefined,
    confidence: Number(s.confidence),
  }));
}
