import { v4 as uuid } from 'uuid';
import {
  AGENT_PIPELINE,
  type AgentName,
  type CrisisRunState,
  type Signal,
  SeverityReportSchema,
} from '@citybrain/shared';
import { TOOL_REGISTRY, type ToolContext } from '@citybrain/agent-tools';
import { generateJson, hasLlm } from './gemini.js';
import { useDemoFastPath } from './demo-fast.js';
import { broadcast } from '../ws/hub.js';
import * as repo from '../db/repository.js';
import { buildMapDeltaPayload } from '../map/state-overlays.js';
import {
  runSignalExtractionAgent,
  applySignalExtractionToState,
} from '../agents/signal-extraction/index.js';
import {
  runCrisisDetectionAgent,
  applyCrisisDetectionToState,
} from '../agents/crisis-detection/index.js';
import {
  runEmergencyPlanningAgent,
  applyEmergencyPlanningToState,
} from '../agents/emergency-planning/index.js';
import {
  runExecutionAgent,
  applyExecutionToState,
} from '../agents/execution/index.js';
import {
  runReflectionAgent,
  applyReflectionToState,
} from '../agents/reflection/index.js';

export interface PipelineCallbacks {
  onAgentStep: (payload: {
    agent: AgentName;
    status: 'started' | 'completed';
    thought?: string;
    output?: unknown;
    latencyMs?: number;
  }) => Promise<void>;
}

export async function runPipeline(
  initial: Partial<CrisisRunState> & { rawSignals: Signal[]; scenarioKey?: string },
  crisisId: string,
  callbacks: PipelineCallbacks
): Promise<CrisisRunState> {
  const state: CrisisRunState = {
    runId: uuid(),
    crisisId,
    scenarioKey: initial.scenarioKey,
    stepCount: 0,
    maxSteps: 24,
    rawSignals: initial.rawSignals,
    normalizedSignals: [],
    replanRequired: false,
    planVersion: initial.planVersion ?? 1,
  };

  const ctx: ToolContext = {
    crisisId,
    logExecution: async (entry) => {
      await repo.createExecutionLog({
        crisisId,
        toolName: entry.tool,
        actionId: entry.actionId,
        requestJson: entry.request,
        responseJson: entry.response,
        stateDelta: entry.stateDelta,
        status: entry.status ?? 'success',
      });
    },
  };

  for (const agent of AGENT_PIPELINE) {
    if (state.stepCount >= state.maxSteps) break;
    state.stepCount += 1;
    state.currentAgent = agent;

    const start = Date.now();
    await callbacks.onAgentStep({ agent, status: 'started' });
    broadcast({
      type: 'agent.step',
      crisisId,
      timestamp: new Date().toISOString(),
      payload: { agent, status: 'started' },
    });

    await runAgent(agent, state, ctx, crisisId);

    const latencyMs = Date.now() - start;
    await callbacks.onAgentStep({
      agent,
      status: 'completed',
      thought: getAgentThought(agent, state),
      output: getAgentOutput(agent, state),
      latencyMs,
    });

    broadcast({
      type: 'agent.step',
      crisisId,
      timestamp: new Date().toISOString(),
      payload: {
        agent,
        status: 'completed',
        thought: getAgentThought(agent, state),
        latencyMs,
      },
    });

    if (agent === 'crisis_detection' && !state.candidate) break;
    if (agent === 'reflection' && state.replanRequired && state.planVersion < 2) {
      state.planVersion += 1;
      state.replanRequired = false;
      await runAgent('planning', state, ctx, crisisId);
      await runAgent('execution', state, ctx, crisisId);
      await runReflection(state, ctx, crisisId, true);
    }
  }

  broadcast({
    type: 'pipeline.complete',
    crisisId,
    timestamp: new Date().toISOString(),
    payload: { crisisId, status: 'complete' },
  });

  return state;
}

async function runAgent(
  agent: AgentName,
  state: CrisisRunState,
  ctx: ToolContext,
  crisisId: string
): Promise<void> {
  switch (agent) {
    case 'signal_extraction':
      await runSignalExtraction(state, ctx);
      break;
    case 'crisis_detection':
      await runCrisisDetection(state, ctx, crisisId);
      break;
    case 'severity_reasoning':
      await runSeverityReasoning(state, ctx, crisisId);
      break;
    case 'planning':
      await runPlanning(state, ctx);
      break;
    case 'resource_allocation':
      await runResourceAllocation(state, ctx);
      break;
    case 'traffic_rerouting':
      if (needsRouting(state)) await runTrafficRerouting(state, ctx, crisisId);
      break;
    case 'citizen_alert':
      await runCitizenAlert(state, ctx, crisisId);
      break;
    case 'execution':
      await runExecution(state, ctx, crisisId);
      break;
    case 'reflection':
      await runReflection(state, ctx, crisisId, false);
      break;
  }
}

async function runSignalExtraction(state: CrisisRunState, ctx: ToolContext) {
  const result = await runSignalExtractionAgent(state, ctx);
  applySignalExtractionToState(state, result);
  (state as CrisisRunState & { signalExtraction?: typeof result }).signalExtraction = result;
}

async function runCrisisDetection(
  state: CrisisRunState,
  ctx: ToolContext,
  crisisId: string
) {
  const result = await runCrisisDetectionAgent(state, ctx, crisisId);
  applyCrisisDetectionToState(state, result);

  if (state.candidate) {
    await repo.updateCrisis(crisisId, {
      type: state.candidate.type,
      title: state.candidate.title,
      areaLabel: state.candidate.areaLabel,
      confidence: state.candidate.confidence,
      summary: state.candidate.summary,
      centroidLat: state.candidate.centroid.lat,
      centroidLng: state.candidate.centroid.lng,
      status: 'analyzing',
    });
  }
}

async function runSeverityReasoning(
  state: CrisisRunState,
  ctx: ToolContext,
  crisisId: string
) {
  const weather = await TOOL_REGISTRY.get_weather({}, state, ctx);
  const traffic = await TOOL_REGISTRY.get_traffic({}, state, ctx);
  const news = await TOOL_REGISTRY.get_news({}, state, ctx);

  const detection = (state as CrisisRunState & { crisisDetection?: { preliminarySeverity?: string; escalationRisk?: { predictedEscalationLevel?: string; factors?: string[] } } }).crisisDetection;
  let severity = buildSeverity(state, weather, traffic, detection);

  if (hasLlm() && !useDemoFastPath(state)) {
    const llm = await generateJson<typeof severity>(
      `Assess severity for ${state.candidate?.type} in ${state.candidate?.areaLabel}. Weather: ${JSON.stringify(weather)}. Traffic: ${JSON.stringify(traffic)}. News: ${JSON.stringify(news ?? {})}.`
    );
    if (llm) severity = { ...severity, ...llm };
  }

  state.severity = SeverityReportSchema.parse(severity);

  await repo.updateCrisis(crisisId, {
    severity: state.severity.level,
    escalationLevel: state.severity.escalationLevel,
    status: 'planning',
  });

  broadcast({
    type: 'escalation.changed',
    crisisId,
    timestamp: new Date().toISOString(),
    payload: { level: state.severity.escalationLevel },
  });
}

async function runPlanning(state: CrisisRunState, ctx: ToolContext) {
  const result = await runEmergencyPlanningAgent(state, ctx);
  applyEmergencyPlanningToState(state, result);
}

async function runResourceAllocation(state: CrisisRunState, ctx: ToolContext) {
  await TOOL_REGISTRY.inventory_status({}, state, ctx);
  const result = await TOOL_REGISTRY.allocate_units({}, state, ctx);
  state.resources = result.assignments as CrisisRunState['resources'];
}

function needsRouting(state: CrisisRunState): boolean {
  const t = state.candidate?.type;
  return t === 'flood' || t === 'accident' || t === 'road_blockage';
}

async function runTrafficRerouting(
  state: CrisisRunState,
  ctx: ToolContext,
  crisisId: string
) {
  const routes = await TOOL_REGISTRY.google_routes({}, state, ctx);
  const c = state.candidate?.centroid ?? { lat: 33.6844, lng: 73.0479 };
  const route = {
    id: uuid(),
    from: c,
    to: { lat: c.lat + 0.01, lng: c.lng + 0.01 },
    alternatePolyline: [
      c,
      { lat: c.lat + 0.005, lng: c.lng + 0.008 },
      { lat: c.lat + 0.01, lng: c.lng + 0.01 },
    ],
    reason: String(routes.alternateRoute),
    congestionDelta: Number(routes.congestionDelta ?? -0.32),
  };
  state.routes = [route];
  await repo.createRouteOverride(crisisId, route);
  broadcast({
    type: 'map.delta',
    crisisId,
    timestamp: new Date().toISOString(),
    payload: buildMapDeltaPayload(state),
  });
}

async function runCitizenAlert(
  state: CrisisRunState,
  ctx: ToolContext,
  crisisId: string
) {
  const draft = await TOOL_REGISTRY.draft_alert({}, state, ctx);
  const seg = await TOOL_REGISTRY.segment_citizens({}, state, ctx);
  const alert = {
    id: uuid(),
    zoneLabel: state.candidate?.areaLabel ?? 'Zone',
    languages: {
      en: String(draft.en),
      ur: String(draft.ur ?? ''),
      romanUr: String(draft.romanUr ?? ''),
    },
    reachEstimate: Number(seg.reachEstimate ?? 10000),
  };
  state.alerts = [alert];
  await repo.createAlert(crisisId, alert);
}

async function runExecution(
  state: CrisisRunState,
  ctx: ToolContext,
  crisisId: string
) {
  const result = await runExecutionAgent(state, ctx, crisisId);
  applyExecutionToState(state, result);
}

async function runReflection(
  state: CrisisRunState,
  ctx: ToolContext,
  crisisId: string,
  isReplan: boolean
) {
  const result = await runReflectionAgent(state, ctx, crisisId, isReplan);
  applyReflectionToState(state, result);
}

function buildSeverity(
  state: CrisisRunState,
  weather: Record<string, unknown>,
  traffic: Record<string, unknown>,
  detection?: {
    preliminarySeverity?: string;
    escalationRisk?: { predictedEscalationLevel?: string; factors?: string[] };
  }
) {
  const type = state.candidate?.type;
  const highRisk = type === 'flood' || type === 'infrastructure_failure';
  const level =
    detection?.preliminarySeverity ??
    (highRisk ? 'critical' : 'high');
  const escalationLevel =
    detection?.escalationRisk?.predictedEscalationLevel ??
    (highRisk ? 'critical' : 'operational');
  return {
    level,
    escalationLevel,
    confidence: 0.89,
    rationale: `Converging ${type} signals with ${weather.condition} and congestion index ${traffic.congestionIndex}`,
    factors: detection?.escalationRisk?.factors ?? [
      'multilingual_social_cluster',
      'weather_alert',
      'traffic_anomaly',
    ],
    estimatedImpact: {
      strandedVehicles: type === 'flood' ? 120 : 40,
      congestionIndex: Number(traffic.congestionIndex ?? 0.8),
      affectedPopulation: 15000,
    },
  };
}

function buildMetrics(state: CrisisRunState, after = false) {
  const base = {
    congestionIndex: 0.82,
    strandedVehicles: state.severity?.estimatedImpact?.strandedVehicles ?? 80,
    activeAlerts: state.alerts?.length ?? 0,
    resourcesDeployed: state.resources?.length ?? 0,
  };
  if (after) {
    return {
      ...base,
      congestionIndex: 0.5,
      strandedVehicles: Math.round(base.strandedVehicles * 0.82),
    };
  }
  return base;
}

function getAgentThought(agent: AgentName, state: CrisisRunState): string {
  const thoughts: Record<AgentName, string> = {
    signal_extraction:
      (state as CrisisRunState & { signalExtraction?: { thought: string } }).signalExtraction
        ?.thought ??
      `Normalized ${state.normalizedSignals.length} multilingual signals with geo-entities`,
    crisis_detection:
      (state as CrisisRunState & { crisisDetection?: { thought: string } }).crisisDetection
        ?.thought ??
      (state.candidate
        ? `Fused cluster: ${state.candidate.title} (${(state.candidate.confidence * 100).toFixed(0)}% confidence)`
        : 'No crisis cluster above threshold'),
    severity_reasoning: state.severity
      ? `Escalation: ${state.severity.escalationLevel} — ${state.severity.rationale}`
      : '',
    planning:
      (state as CrisisRunState & { emergencyPlanning?: { thought: string } }).emergencyPlanning
        ?.thought ?? state.plan?.summary ?? '',
    resource_allocation: `Allocated ${state.resources?.length ?? 0} response units`,
    traffic_rerouting: state.routes?.length
      ? `Applied ${state.routes.length} route override(s)`
      : 'Routing not required for crisis type',
    citizen_alert: `Alert drafted for ${state.alerts?.[0]?.reachEstimate ?? 0} citizens`,
    execution:
      (state as CrisisRunState & { executionReport?: { thought: string } }).executionReport
        ?.thought ??
      `Executed ${state.executionResults?.length ?? 0} actions via tool-calling`,
    reflection:
      (state as CrisisRunState & { reflectionAnalysis?: { thought: string } }).reflectionAnalysis
        ?.thought ?? state.reflection?.summary ?? '',
  };
  return thoughts[agent] ?? '';
}

function getAgentOutput(agent: AgentName, state: CrisisRunState): unknown {
  const map: Partial<Record<AgentName, unknown>> = {
    signal_extraction: state.normalizedSignals,
    crisis_detection:
      (state as CrisisRunState & { crisisDetection?: unknown }).crisisDetection ?? state.candidate,
    severity_reasoning: state.severity,
    planning:
      (state as CrisisRunState & { emergencyPlanning?: unknown }).emergencyPlanning ?? state.plan,
    resource_allocation: state.resources,
    traffic_rerouting: state.routes,
    citizen_alert: state.alerts,
    execution:
      (state as CrisisRunState & { executionReport?: unknown }).executionReport ??
      state.executionResults,
    reflection:
      (state as CrisisRunState & { reflectionAnalysis?: unknown }).reflectionAnalysis ??
      state.reflection,
  };
  return map[agent];
}
