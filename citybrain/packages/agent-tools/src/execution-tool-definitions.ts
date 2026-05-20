import type { ExecutionToolName } from '@citybrain/shared';

/**
 * Tool definitions for LLM / MCP — descriptions drive agent accuracy (agent-tool-builder skill).
 */
export interface ExecutionToolDefinition {
  name: ExecutionToolName;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required: string[];
    additionalProperties?: boolean;
  };
  inputExamples?: Record<string, unknown>[];
}

export const EXECUTION_TOOL_DEFINITIONS: ExecutionToolDefinition[] = [
  {
    name: 'updateTrafficRoutes',
    description:
      'Updates live traffic routing for a crisis corridor. Applies Google Maps alternate routes and optional road closures. Use when the plan includes reroute_traffic or close_roads. Returns congestion delta and corridor label. Does NOT dispatch rescue units.',
    inputSchema: {
      type: 'object',
      properties: {
        crisisId: { type: 'string', description: 'Active crisis UUID' },
        corridor: {
          type: 'string',
          description: 'Alternate corridor label, e.g. Murree Rd → Kashmir Hwy',
        },
        closeRoad: {
          type: 'boolean',
          description: 'If true, apply road closure on segment before reroute',
        },
        segment: { type: 'string', description: 'Road segment to close, e.g. G-10 Markaz' },
        centroid: {
          type: 'object',
          description: 'Lat/lng anchor for route geometry',
          properties: { lat: { type: 'number' }, lng: { type: 'number' } },
        },
      },
      required: ['crisisId'],
      additionalProperties: false,
    },
    inputExamples: [
      { crisisId: 'abc', corridor: 'Murree Rd', closeRoad: false },
      { crisisId: 'abc', closeRoad: true, segment: 'G-10 Markaz' },
    ],
  },
  {
    name: 'dispatchRescueTeams',
    description:
      'Dispatches rescue, ambulance, pump, or tow units to the crisis centroid. Use for dispatch_rescue or deploy_pumps plan actions. Returns unit assignments and ticket IDs.',
    inputSchema: {
      type: 'object',
      properties: {
        crisisId: { type: 'string', description: 'Active crisis UUID' },
        unitType: {
          type: 'string',
          enum: ['rescue', 'ambulance', 'pump', 'tow', 'engineer', 'shelter'],
          description: 'Type of unit to dispatch',
        },
        zone: { type: 'string', description: 'Target area label' },
        count: { type: 'integer', description: 'Number of units (1-6)', minimum: 1, maximum: 6 },
      },
      required: ['crisisId', 'unitType'],
      additionalProperties: false,
    },
    inputExamples: [{ crisisId: 'abc', unitType: 'rescue', zone: 'G-10 Markaz', count: 2 }],
  },
  {
    name: 'sendEmergencyAlerts',
    description:
      'Sends multilingual citizen emergency alerts (EN, Urdu, Roman Urdu). Use for citizen_alert plan steps. Returns reach estimate and message previews.',
    inputSchema: {
      type: 'object',
      properties: {
        crisisId: { type: 'string', description: 'Active crisis UUID' },
        zones: {
          type: 'array',
          items: { type: 'string' },
          description: 'Zone labels to alert, e.g. ["G-10", "G-9"]',
        },
        channels: {
          type: 'array',
          items: { type: 'string', enum: ['sms', 'app', 'variable_message_sign'] },
        },
      },
      required: ['crisisId'],
      additionalProperties: false,
    },
  },
  {
    name: 'notifyHospitals',
    description:
      'Notifies hospitals to stand by for surge capacity, trauma, or heat protocols. Use when plan payload task is hospital_notify. Returns notified facility count.',
    inputSchema: {
      type: 'object',
      properties: {
        crisisId: { type: 'string', description: 'Active crisis UUID' },
        protocol: {
          type: 'string',
          enum: ['trauma', 'flood', 'heat', 'general'],
          description: 'Hospital activation protocol',
        },
        zone: { type: 'string', description: 'Affected area for triage routing' },
      },
      required: ['crisisId'],
      additionalProperties: false,
    },
  },
  {
    name: 'createEmergencyTicket',
    description:
      'Creates a tracked emergency operations ticket for dispatch, engineering, or hospital coordination. Returns ticketId and status.',
    inputSchema: {
      type: 'object',
      properties: {
        crisisId: { type: 'string', description: 'Active crisis UUID' },
        unit: { type: 'string', description: 'Unit or team identifier' },
        task: { type: 'string', description: 'Task description for ops log' },
        priority: {
          type: 'string',
          enum: ['low', 'medium', 'high', 'critical'],
        },
      },
      required: ['crisisId', 'unit'],
      additionalProperties: false,
    },
  },
  {
    name: 'updateDashboard',
    description:
      'Pushes live command-center dashboard state: metrics, map layers, execution progress. Call after each major step or at execution end.',
    inputSchema: {
      type: 'object',
      properties: {
        crisisId: { type: 'string', description: 'Active crisis UUID' },
        phase: {
          type: 'string',
          enum: ['before', 'executing', 'after'],
          description: 'Snapshot phase for metrics comparison',
        },
        progress: {
          type: 'object',
          description: 'Optional execution progress counters',
          properties: {
            completed: { type: 'number' },
            total: { type: 'number' },
            currentAction: { type: 'string' },
          },
        },
      },
      required: ['crisisId'],
      additionalProperties: false,
    },
  },
];

export function getExecutionToolDefinition(name: ExecutionToolName): ExecutionToolDefinition | undefined {
  return EXECUTION_TOOL_DEFINITIONS.find((d) => d.name === name);
}
