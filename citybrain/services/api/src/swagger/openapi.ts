/**
 * CityBrain REST API — OpenAPI 3.0
 * Test via Swagger UI: http://localhost:4000/api-docs
 */
export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'CityBrain Emergency OS API',
    version: '1.0.0',
    description: `
CityBrain hackathon API — citizen reports, crisis dossiers, AI pipeline, dispatch, nearby resources, and traffic-aware rerouting.

**Quick test flow**
1. \`POST /citizen/reports\` — submit incident (header \`X-Device-Id\`)
2. \`GET /crises\` — copy \`crisisId\`
3. \`GET /crises/{id}/dossier\` — validation + nearby assets
4. \`POST /crises/{id}/dispatch\` — dispatch ambulance/rescue
5. \`POST /crises/{id}/dispatch/check-traffic\` — force traffic monitor tick

**WebSocket** (not in Swagger): \`ws://localhost:4000/ws\` — subscribe with \`{"subscribe":{"role":"authority"}}\`
    `.trim(),
    contact: { name: 'CityBrain Team' },
  },
  servers: [
    { url: 'http://localhost:4000/api/v1', description: 'API direct (Docker / dev)' },
    { url: 'http://localhost:8180/api/v1', description: 'Via nginx web proxy' },
    { url: 'http://localhost:4000', description: 'Root (health only — no /api/v1 prefix)' },
  ],
  tags: [
    { name: 'Health', description: 'Service & integration health' },
    { name: 'Citizen', description: 'Mobile/web citizen reports' },
    { name: 'Crises', description: 'Crisis inbox, dossier, traces' },
    { name: 'Dispatch', description: 'Authority dispatch & traffic reroute' },
    { name: 'Live', description: 'Weather, news, live sync' },
    { name: 'Signals', description: 'Signal ingest & analysis' },
    { name: 'Demo', description: 'Demo scenarios' },
    { name: 'Simulation', description: 'Physics simulation & replay' },
    { name: 'Resources', description: 'Deployable units' },
    { name: 'Memory', description: 'Agent memory' },
  ],
  components: {
    securitySchemes: {
      DeviceId: {
        type: 'apiKey',
        in: 'header',
        name: 'X-Device-Id',
        description: 'Citizen device identifier (mobile app)',
      },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: { error: { type: 'string' } },
      },
      LatLng: {
        type: 'object',
        required: ['lat', 'lng'],
        properties: {
          lat: { type: 'number', example: 24.8607 },
          lng: { type: 'number', example: 67.0011 },
        },
      },
      CitizenReportCreate: {
        type: 'object',
        required: ['rawText'],
        properties: {
          deviceId: { type: 'string', example: 'demo-device-001' },
          rawText: { type: 'string', example: 'Fire erupted near Saddar market — need help' },
          category: {
            type: 'string',
            enum: [
              'flood',
              'urban_flood',
              'tsunami',
              'earthquake',
              'landslide',
              'rain_alert',
              'fire',
              'accident',
              'storm',
              'other',
            ],
            example: 'fire',
          },
          language: { type: 'string', example: 'en' },
          location: { $ref: '#/components/schemas/LatLng' },
          mediaUrls: { type: 'array', items: { type: 'string' } },
        },
      },
      CitizenReportAccepted: {
        type: 'object',
        properties: {
          reportId: { type: 'string', format: 'uuid' },
          crisisId: { type: 'string', format: 'uuid' },
          status: { type: 'string', example: 'validating' },
          correlationId: { type: 'string', format: 'uuid' },
        },
      },
      DispatchBody: {
        type: 'object',
        properties: {
          units: {
            type: 'array',
            items: { type: 'string' },
            example: ['ambulance'],
          },
          note: { type: 'string', example: 'Dispatch per authority approval' },
          targets: {
            type: 'array',
            description: 'Optional selected facilities from nearby-resources',
            items: {
              type: 'object',
              properties: {
                placeId: { type: 'string' },
                name: { type: 'string' },
                lat: { type: 'number' },
                lng: { type: 'number' },
                category: { type: 'string' },
              },
            },
          },
        },
      },
      RerouteBody: {
        type: 'object',
        properties: {
          note: { type: 'string', example: 'Authority-approved traffic reroute' },
        },
      },
      SignalIngest: {
        type: 'object',
        properties: {
          source: { type: 'string', example: 'social' },
          rawText: { type: 'string' },
          language: { type: 'string' },
          location: { $ref: '#/components/schemas/LatLng' },
          areaLabel: { type: 'string' },
          confidence: { type: 'number' },
        },
      },
      LiveSyncBody: {
        type: 'object',
        properties: {
          lat: { type: 'number' },
          lon: { type: 'number' },
          query: { type: 'string', example: 'Karachi Pakistan flood' },
          areaLabel: { type: 'string' },
        },
      },
    },
    parameters: {
      CrisisId: {
        name: 'id',
        in: 'path',
        required: true,
        schema: { type: 'string', format: 'uuid' },
        description: 'Crisis UUID',
      },
      ReportId: {
        name: 'id',
        in: 'path',
        required: true,
        schema: { type: 'string', format: 'uuid' },
      },
      ScenarioKey: {
        name: 'key',
        in: 'path',
        required: true,
        schema: {
          type: 'string',
          enum: ['karachi_flood', 'margalla_heat', 'srinagar_accident', 'faiz_road_block'],
        },
      },
    },
  },
  paths: {
    '/health': {
      get: {
        tags: ['Health'],
        summary: 'API health & integrations',
        description:
          'Under `/api/v1/health` (full integrations). For Docker minimal check use server **Root** → same path → `http://localhost:4000/health`.',
        responses: {
          '200': { description: 'OK' },
        },
      },
    },
    '/health/llm': {
      get: {
        tags: ['Health'],
        summary: 'LLM probe (Gemini / OpenRouter)',
        description: 'Also at app root when server **Root** is selected (`/health/llm` without `/api/v1`).',
        responses: {
          '200': { description: 'LLM reachable' },
          '503': { description: 'LLM unavailable' },
        },
      },
    },
    '/live/status': {
      get: {
        tags: ['Live'],
        summary: 'Integration keys status',
        responses: { '200': { description: 'Status object' } },
      },
    },
    '/live/weather': {
      get: {
        tags: ['Live'],
        summary: 'Live weather (OpenWeather)',
        parameters: [
          { name: 'lat', in: 'query', schema: { type: 'number', default: 24.8607 } },
          { name: 'lon', in: 'query', schema: { type: 'number', default: 67.0011 } },
          { name: 'area', in: 'query', schema: { type: 'string' } },
        ],
        responses: {
          '200': { description: 'Weather data' },
          '503': { description: 'OpenWeather unavailable' },
        },
      },
    },
    '/live/news': {
      get: {
        tags: ['Live'],
        summary: 'News feed (NewsAPI)',
        parameters: [
          { name: 'q', in: 'query', schema: { type: 'string' } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 8 } },
        ],
        responses: { '200': { description: 'News articles' } },
      },
    },
    '/live/sync': {
      post: {
        tags: ['Live'],
        summary: 'Ingest live weather + news as signals',
        requestBody: {
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/LiveSyncBody' } },
          },
        },
        responses: { '200': { description: 'Ingested signal IDs' } },
      },
    },
    '/citizen/reports': {
      post: {
        tags: ['Citizen'],
        summary: 'Submit citizen emergency report',
        description: 'Starts validation pipeline (weather, news, Places, AI agents). Requires X-Device-Id.',
        security: [{ DeviceId: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/CitizenReportCreate' } },
          },
        },
        responses: {
          '202': {
            description: 'Accepted — processing',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/CitizenReportAccepted' } },
            },
          },
          '400': { description: 'Missing device id or rawText' },
        },
      },
      get: {
        tags: ['Citizen'],
        summary: 'List reports for device',
        security: [{ DeviceId: [] }],
        parameters: [
          { name: 'deviceId', in: 'query', schema: { type: 'string' } },
        ],
        responses: { '200': { description: 'Report list' } },
      },
    },
    '/citizen/reports/{id}': {
      get: {
        tags: ['Citizen'],
        summary: 'Get single report',
        parameters: [{ $ref: '#/components/parameters/ReportId' }],
        responses: {
          '200': { description: 'Report' },
          '404': { description: 'Not found' },
        },
      },
    },
    '/citizen/reports/{id}/route': {
      get: {
        tags: ['Citizen'],
        summary: 'Safe route for report (Google Routes)',
        parameters: [
          { $ref: '#/components/parameters/ReportId' },
          { name: 'destLat', in: 'query', schema: { type: 'number' } },
          { name: 'destLng', in: 'query', schema: { type: 'number' } },
        ],
        responses: { '200': { description: 'Route polyline + ETA' } },
      },
    },
    '/crises': {
      get: {
        tags: ['Crises'],
        summary: 'List all crises (authority inbox)',
        responses: { '200': { description: 'Crises array with validation_score' } },
      },
    },
    '/crises/{id}': {
      get: {
        tags: ['Crises'],
        summary: 'Get crisis + linked signals',
        parameters: [{ $ref: '#/components/parameters/CrisisId' }],
        responses: {
          '200': { description: 'Crisis detail' },
          '404': { description: 'Not found' },
        },
      },
    },
    '/crises/{id}/dossier': {
      get: {
        tags: ['Crises'],
        summary: 'Full crisis dossier (validation, social, timeline, nearby)',
        parameters: [{ $ref: '#/components/parameters/CrisisId' }],
        responses: { '200': { description: 'Dossier' }, '404': { description: 'Not found' } },
      },
    },
    '/crises/{id}/nearby-resources': {
      get: {
        tags: ['Dispatch'],
        summary: 'Nearby hospitals, rescue, shelters (Google Places)',
        parameters: [
          { $ref: '#/components/parameters/CrisisId' },
          { name: 'refresh', in: 'query', schema: { type: 'boolean', default: false } },
        ],
        responses: { '200': { description: 'Emergency resources list' } },
      },
    },
    '/crises/{id}/dispatch': {
      post: {
        tags: ['Dispatch'],
        summary: 'Authority dispatch units to incident',
        parameters: [{ $ref: '#/components/parameters/CrisisId' }],
        requestBody: {
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/DispatchBody' } },
          },
        },
        responses: { '200': { description: 'Dispatched with facility + ETA' } },
      },
    },
    '/crises/{id}/reroute': {
      post: {
        tags: ['Dispatch'],
        summary: 'Manual traffic reroute',
        parameters: [{ $ref: '#/components/parameters/CrisisId' }],
        requestBody: {
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/RerouteBody' } },
          },
        },
        responses: { '200': { description: 'Rerouted' } },
      },
    },
    '/crises/{id}/dispatch/check-traffic': {
      post: {
        tags: ['Dispatch'],
        summary: 'Run traffic monitor now (auto-reroute dispatched units)',
        parameters: [{ $ref: '#/components/parameters/CrisisId' }],
        responses: { '200': { description: 'Monitor tick completed' } },
      },
    },
    '/crises/{id}/dispatches': {
      get: {
        tags: ['Dispatch'],
        summary: 'Dispatch & reroute action log',
        parameters: [{ $ref: '#/components/parameters/CrisisId' }],
        responses: { '200': { description: 'Dispatch history' } },
      },
    },
    '/crises/{id}/traces': {
      get: {
        tags: ['Crises'],
        summary: 'AI agent traces',
        parameters: [{ $ref: '#/components/parameters/CrisisId' }],
        responses: { '200': { description: 'Agent runs' } },
      },
    },
    '/crises/{id}/executions': {
      get: {
        tags: ['Crises'],
        summary: 'Execution logs',
        parameters: [{ $ref: '#/components/parameters/CrisisId' }],
        responses: { '200': { description: 'Executions' } },
      },
    },
    '/crises/{id}/state': {
      get: {
        tags: ['Crises'],
        summary: 'Before/after snapshots',
        parameters: [{ $ref: '#/components/parameters/CrisisId' }],
        responses: { '200': { description: 'Snapshots' } },
      },
    },
    '/crises/{id}/analyze': {
      post: {
        tags: ['Crises'],
        summary: 'Start 9-agent AI pipeline',
        parameters: [{ $ref: '#/components/parameters/CrisisId' }],
        responses: { '200': { description: 'Pipeline started' } },
      },
    },
    '/crises/{id}/simulation': {
      get: {
        tags: ['Simulation'],
        summary: 'Get simulation run',
        parameters: [{ $ref: '#/components/parameters/CrisisId' }],
        responses: { '200': { description: 'Simulation' }, '404': { description: 'No run' } },
      },
    },
    '/crises/{id}/simulation/replay': {
      get: {
        tags: ['Simulation'],
        summary: 'Simulation replay frames',
        parameters: [
          { $ref: '#/components/parameters/CrisisId' },
          { name: 'fromTick', in: 'query', schema: { type: 'integer', default: 0 } },
          { name: 'toTick', in: 'query', schema: { type: 'integer' } },
          { name: 'interpolate', in: 'query', schema: { type: 'integer', default: 0 } },
          { name: 'fromSimTimeMs', in: 'query', schema: { type: 'integer', default: 0 } },
        ],
        responses: { '200': { description: 'Frames + timeline' } },
      },
    },
    '/crises/{id}/simulation/run': {
      post: {
        tags: ['Simulation'],
        summary: 'Run physics simulation',
        parameters: [{ $ref: '#/components/parameters/CrisisId' }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  tickDelayMs: { type: 'integer', default: 80 },
                  skipExecution: { type: 'boolean', default: true },
                  state: { type: 'object', description: 'Optional CrisisRunState override' },
                },
              },
            },
          },
        },
        responses: { '200': { description: 'Simulation completed' }, '400': { description: 'skipExecution=false not allowed here' } },
      },
    },
    '/signals/ingest': {
      post: {
        tags: ['Signals'],
        summary: 'Ingest crisis signals',
        requestBody: {
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  { $ref: '#/components/schemas/SignalIngest' },
                  {
                    type: 'object',
                    properties: {
                      signals: { type: 'array', items: { $ref: '#/components/schemas/SignalIngest' } },
                    },
                  },
                ],
              },
            },
          },
        },
        responses: { '200': { description: 'Ingested IDs' } },
      },
    },
    '/demo/scenarios/{key}/run': {
      post: {
        tags: ['Demo'],
        summary: 'Run demo scenario',
        parameters: [{ $ref: '#/components/parameters/ScenarioKey' }],
        responses: { '200': { description: 'Scenario started with crisisId' } },
      },
    },
    '/resources': {
      get: {
        tags: ['Resources'],
        summary: 'List available rescue resources',
        responses: { '200': { description: 'Resources' } },
      },
    },
    '/memory': {
      get: {
        tags: ['Memory'],
        summary: 'Agent memory entries',
        parameters: [{ name: 'type', in: 'query', schema: { type: 'string' } }],
        responses: { '200': { description: 'Memory' } },
      },
    },
  },
};
