import { v4 as uuid } from 'uuid';
import type { CrisisRunState } from '@citybrain/shared';
import { query } from './pool.js';

export async function createSignal(data: {
  source: string;
  rawText: string;
  language?: string;
  lat?: number;
  lng?: number;
  areaLabel?: string;
  confidence?: number;
  normalizedJson?: unknown;
}) {
  const id = uuid();
  await query(
    `INSERT INTO signals (id, source, raw_text, normalized_json, language, lat, lng, area_label, confidence)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [
      id,
      data.source,
      data.rawText,
      data.normalizedJson ? JSON.stringify(data.normalizedJson) : null,
      data.language ?? 'en',
      data.lat,
      data.lng,
      data.areaLabel,
      data.confidence ?? 0.7,
    ]
  );
  return id;
}

export async function createCrisis(data: {
  scenarioKey?: string;
  type: string;
  title: string;
  areaLabel?: string;
  status?: string;
}) {
  const id = uuid();
  await query(
    `INSERT INTO crises (id, scenario_key, type, title, area_label, status)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [id, data.scenarioKey, data.type, data.title, data.areaLabel, data.status ?? 'detecting']
  );
  return id;
}

export async function updateCrisis(
  id: string,
  data: Partial<{
    type: string;
    title: string;
    areaLabel: string;
    status: string;
    severity: string;
    confidence: number;
    escalationLevel: string;
    summary: string;
    centroidLat: number;
    centroidLng: number;
    dossierJson: unknown;
  }>
) {
  const fields: string[] = [];
  const values: unknown[] = [];
  let i = 1;

  const map: Record<string, string> = {
    type: 'type',
    title: 'title',
    areaLabel: 'area_label',
    status: 'status',
    severity: 'severity',
    confidence: 'confidence',
    escalationLevel: 'escalation_level',
    summary: 'summary',
    centroidLat: 'centroid_lat',
    centroidLng: 'centroid_lng',
  };

  for (const [k, col] of Object.entries(map)) {
    if (data[k as keyof typeof data] !== undefined) {
      fields.push(`${col} = $${i++}`);
      values.push(data[k as keyof typeof data]);
    }
  }

  if (data.dossierJson !== undefined) {
    fields.push(`dossier_json = $${i++}`);
    values.push(JSON.stringify(data.dossierJson));
  }

  fields.push(`updated_at = NOW()`);
  values.push(id);

  if (fields.length > 1) {
    await query(`UPDATE crises SET ${fields.join(', ')} WHERE id = $${i}`, values);
  }
}

export async function linkSignalToCrisis(crisisId: string, signalId: string) {
  await query(
    `INSERT INTO crisis_signals (crisis_id, signal_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
    [crisisId, signalId]
  );
}

export async function createAgentRun(data: {
  crisisId: string;
  agentName: string;
  status: string;
  outputJson?: unknown;
  model?: string;
  latencyMs?: number;
  thought?: string;
  reasoningSteps?: Array<{ stepIndex: number; thought: string }>;
}) {
  const id = uuid();
  await query(
    `INSERT INTO agent_runs (id, crisis_id, agent_name, status, output_json, model, latency_ms)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [
      id,
      data.crisisId,
      data.agentName,
      data.status,
      data.outputJson ? JSON.stringify(data.outputJson) : null,
      data.model ?? (process.env.GEMINI_API_KEY ? 'gemini' : 'sop-fallback'),
      data.latencyMs,
    ]
  );

  if (data.reasoningSteps?.length) {
    for (const step of data.reasoningSteps) {
      await query(
        `INSERT INTO reasoning_traces (run_id, step_index, thought) VALUES ($1, $2, $3)`,
        [id, step.stepIndex, step.thought]
      );
    }
  } else if (data.thought) {
    await query(
      `INSERT INTO reasoning_traces (run_id, step_index, thought) VALUES ($1, 0, $2)`,
      [id, data.thought]
    );
  }

  return id;
}

export async function createExecutionLog(data: {
  crisisId: string;
  toolName: string;
  actionId?: string;
  requestJson?: unknown;
  responseJson?: unknown;
  stateDelta?: Record<string, unknown>;
  status?: string;
}) {
  await query(
    `INSERT INTO execution_logs (crisis_id, action_id, tool_name, request_json, response_json, state_delta, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [
      data.crisisId,
      data.actionId ?? null,
      data.toolName,
      data.requestJson ? JSON.stringify(data.requestJson) : null,
      data.responseJson ? JSON.stringify(data.responseJson) : null,
      data.stateDelta ? JSON.stringify(data.stateDelta) : null,
      data.status ?? 'success',
    ]
  );
}

export async function createAction(
  crisisId: string,
  action: { id: string; type: string; title: string; payload?: unknown; priority?: number }
) {
  const planRes = await query<{ id: string }>(
    `INSERT INTO response_plans (crisis_id, version, plan_json)
     VALUES ($1, 1, '{}') RETURNING id`,
    [crisisId]
  );
  const planId = planRes.rows[0]?.id ?? uuid();

  const actionDbId = uuid();
  await query(
    `INSERT INTO actions (id, plan_id, crisis_id, action_type, title, payload, priority, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'executed')`,
    [
      actionDbId,
      planId,
      crisisId,
      action.type,
      action.title,
      JSON.stringify(action.payload ?? {}),
      action.priority ?? 5,
    ]
  );
  return actionDbId;
}

export async function listExecutingCrises() {
  const res = await query(
    `SELECT * FROM crises WHERE status = 'executing' ORDER BY updated_at DESC NULLS LAST, created_at DESC`
  );
  return res.rows;
}

export async function getDispatchActionsForCrisis(crisisId: string) {
  const res = await query(
    `SELECT id, action_type, title, payload, status, created_at
     FROM actions
     WHERE crisis_id = $1 AND action_type IN ('dispatch_emergency', 'traffic_reroute')
     ORDER BY created_at DESC
     LIMIT 15`,
    [crisisId]
  );
  return res.rows;
}

export async function createSnapshot(
  crisisId: string,
  phase: string,
  metrics: Record<string, unknown>,
  mapState: Record<string, unknown>
) {
  await query(
    `INSERT INTO city_state_snapshots (crisis_id, phase, metrics_json, map_state_json)
     VALUES ($1,$2,$3,$4)`,
    [crisisId, phase, JSON.stringify(metrics), JSON.stringify(mapState)]
  );
}

export async function createRouteOverride(
  crisisId: string,
  route: {
    from: { lat: number; lng: number };
    to: { lat: number; lng: number };
    alternatePolyline: Array<{ lat: number; lng: number }>;
    reason: string;
    congestionDelta: number;
  }
) {
  await query(
    `INSERT INTO route_overrides (crisis_id, from_lat, from_lng, to_lat, to_lng, polyline_json, reason, congestion_delta)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [
      crisisId,
      route.from.lat,
      route.from.lng,
      route.to.lat,
      route.to.lng,
      JSON.stringify(route.alternatePolyline),
      route.reason,
      route.congestionDelta,
    ]
  );
}

export async function createAlert(
  crisisId: string,
  alert: { zoneLabel: string; languages: Record<string, string>; reachEstimate: number }
) {
  await query(
    `INSERT INTO alerts (crisis_id, zone_label, languages_json, reach_estimate)
     VALUES ($1,$2,$3,$4)`,
    [crisisId, alert.zoneLabel, JSON.stringify(alert.languages), alert.reachEstimate]
  );
}

export async function writeCrisisMemory(crisisId: string, state: CrisisRunState) {
  await query(
    `INSERT INTO crisis_memory (crisis_id, summary, crisis_type, area_label, outcome_score, lessons)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [
      crisisId,
      state.reflection?.summary ?? state.candidate?.summary ?? '',
      state.candidate?.type,
      state.candidate?.areaLabel,
      state.reflection?.outcomeScore ?? 0.75,
      JSON.stringify(state.reflection?.lessons ?? []),
    ]
  );
}

export async function getCrisis(id: string) {
  const res = await query(`SELECT * FROM crises WHERE id = $1`, [id]);
  return res.rows[0];
}

export async function listCrises() {
  const res = await query(`SELECT * FROM crises ORDER BY created_at DESC LIMIT 50`);
  return res.rows;
}

export async function getSignalsForCrisis(crisisId: string) {
  const res = await query(
    `SELECT s.* FROM signals s
     JOIN crisis_signals cs ON cs.signal_id = s.id
     WHERE cs.crisis_id = $1 ORDER BY s.ingested_at`,
    [crisisId]
  );
  return res.rows;
}

export async function getAgentRuns(crisisId: string) {
  const res = await query(
    `SELECT ar.*, (
       SELECT json_agg(json_build_object('thought', rt.thought, 'step', rt.step_index))
       FROM reasoning_traces rt WHERE rt.run_id = ar.id
     ) as traces
     FROM agent_runs ar WHERE ar.crisis_id = $1 ORDER BY ar.created_at`,
    [crisisId]
  );
  return res.rows;
}

export async function getExecutionLogs(crisisId: string) {
  const res = await query(
    `SELECT * FROM execution_logs WHERE crisis_id = $1 ORDER BY created_at`,
    [crisisId]
  );
  return res.rows;
}

export async function getSnapshots(crisisId: string) {
  const res = await query(
    `SELECT * FROM city_state_snapshots WHERE crisis_id = $1 ORDER BY created_at`,
    [crisisId]
  );
  return res.rows;
}

export async function getMemory(crisisType?: string) {
  const res = crisisType
    ? await query(
        `SELECT * FROM crisis_memory WHERE crisis_type = $1 ORDER BY created_at DESC LIMIT 10`,
        [crisisType]
      )
    : await query(`SELECT * FROM crisis_memory ORDER BY created_at DESC LIMIT 20`);
  return res.rows;
}

function isMissingRelation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'code' in err && (err as { code: string }).code === '42P01';
}

/** v1 `resources` or v2 `rescue_teams` (read-only compat for mixed DBs). */
export async function listAvailableResources() {
  try {
    const res = await query(`SELECT * FROM resources WHERE status = 'available' ORDER BY type, name`);
    return res.rows;
  } catch (err) {
    if (!isMissingRelation(err)) throw err;
    const res = await query(
      `SELECT id, team_type AS type, name, lat, lng, status::text AS status, capacity, metadata
       FROM rescue_teams WHERE status = 'available' ORDER BY team_type, name`
    );
    return res.rows;
  }
}

export async function createCitizenReport(data: {
  deviceId: string;
  rawText: string;
  category?: string;
  language?: string;
  lat?: number;
  lng?: number;
  areaLabel?: string;
  metadata?: Record<string, unknown>;
}) {
  const id = uuid();
  await query(
    `INSERT INTO citizen_reports (id, device_id, source, category, raw_text, language, lat, lng, area_label, status, metadata)
     VALUES ($1,$2,'citizen_app',$3,$4,$5,$6,$7,$8,'validating',$9)`,
    [
      id,
      data.deviceId,
      data.category ?? 'other',
      data.rawText,
      data.language ?? 'en',
      data.lat,
      data.lng,
      data.areaLabel,
      JSON.stringify(data.metadata ?? {}),
    ]
  );
  return id;
}

export async function getCitizenReport(id: string) {
  const res = await query(`SELECT * FROM citizen_reports WHERE id = $1`, [id]);
  return res.rows[0];
}

export async function getCitizenReportsByDevice(deviceId: string, limit = 20) {
  const res = await query(
    `SELECT * FROM citizen_reports WHERE device_id = $1 ORDER BY ingested_at DESC LIMIT $2`,
    [deviceId, limit]
  );
  return res.rows;
}

export async function linkCitizenReportToCrisis(reportId: string, crisisId: string) {
  await query(
    `UPDATE citizen_reports SET crisis_id = $2, linked_at = NOW(), status = 'linked' WHERE id = $1`,
    [reportId, crisisId]
  );
}

export async function updateCitizenReport(
  id: string,
  data: Partial<{
    lat: number;
    lng: number;
    areaLabel: string;
    status: string;
    verified: boolean;
    confidence: number;
  }>
) {
  const fields: string[] = [];
  const values: unknown[] = [];
  let i = 1;
  const map: Record<string, string> = {
    lat: 'lat',
    lng: 'lng',
    areaLabel: 'area_label',
    status: 'status',
    verified: 'verified',
    confidence: 'confidence',
  };
  for (const [k, col] of Object.entries(map)) {
    if (data[k as keyof typeof data] !== undefined) {
      fields.push(`${col} = $${i++}`);
      values.push(data[k as keyof typeof data]);
    }
  }
  if (fields.length === 0) return;
  values.push(id);
  await query(`UPDATE citizen_reports SET ${fields.join(', ')} WHERE id = $${i}`, values);
}

export async function updateCitizenReportMetadata(id: string, patch: Record<string, unknown>) {
  const row = await getCitizenReport(id);
  const existing =
    row?.metadata && typeof row.metadata === 'object'
      ? (row.metadata as Record<string, unknown>)
      : typeof row?.metadata === 'string'
        ? JSON.parse(row.metadata)
        : {};
  await query(`UPDATE citizen_reports SET metadata = $2 WHERE id = $1`, [
    id,
    JSON.stringify({ ...existing, ...patch }),
  ]);
}

export async function getCitizenReportForCrisis(crisisId: string) {
  const res = await query(
    `SELECT * FROM citizen_reports WHERE crisis_id = $1 ORDER BY ingested_at DESC LIMIT 1`,
    [crisisId]
  );
  return res.rows[0];
}

export async function seedResources() {
  const resources = [
    { type: 'ambulance', name: 'AMB-07', lat: 33.684, lng: 73.048, status: 'available' },
    { type: 'pump', name: 'PUMP-03', lat: 33.672, lng: 73.025, status: 'available' },
    { type: 'tow', name: 'TOW-02', lat: 33.655, lng: 73.09, status: 'available' },
    { type: 'shelter', name: 'SHELTER-01', lat: 33.735, lng: 73.062, status: 'available' },
    { type: 'engineer', name: 'ENG-05', lat: 33.648, lng: 73.042, status: 'available' },
  ];

  try {
    const count = await query(`SELECT COUNT(*)::int as c FROM resources`);
    if (count.rows[0]?.c > 0) return;
    for (const r of resources) {
      await query(
        `INSERT INTO resources (type, name, lat, lng, status) VALUES ($1,$2,$3,$4,$5)`,
        [r.type, r.name, r.lat, r.lng, r.status]
      );
    }
    return;
  } catch (err) {
    if (!isMissingRelation(err)) throw err;
  }

  const countV2 = await query(`SELECT COUNT(*)::int as c FROM rescue_teams`);
  if (countV2.rows[0]?.c > 0) return;

  const v2Rows: Array<[string, string, string, number, number, string, number]> = [
    ['AMB-07', 'ambulance', 'Ambulance Unit 07', 33.684, 73.048, 'available', 2],
    ['PUMP-03', 'pump', 'Flood Pump Unit 03', 33.672, 73.025, 'available', 1],
    ['TOW-02', 'tow', 'Tow Truck 02', 33.655, 73.09, 'available', 1],
    ['SHELTER-01', 'shelter', 'Cooling Shelter 01', 33.735, 73.062, 'available', 200],
    ['ENG-05', 'engineer', 'Grid Engineer Team 05', 33.648, 73.042, 'available', 4],
  ];
  for (const [code, teamType, name, lat, lng, status, capacity] of v2Rows) {
    await query(
      `INSERT INTO rescue_teams (team_code, team_type, name, lat, lng, status, capacity)
       VALUES ($1,$2,$3,$4,$5,$6::team_status,$7) ON CONFLICT (team_code) DO NOTHING`,
      [code, teamType, name, lat, lng, status, capacity]
    );
  }
}
