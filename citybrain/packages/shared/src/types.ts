export type CrisisType =
  | 'flood'
  | 'heatwave'
  | 'accident'
  | 'infrastructure_failure'
  | 'road_blockage';

export type CrisisStatus =
  | 'detecting'
  | 'analyzing'
  | 'planning'
  | 'executing'
  | 'reflecting'
  | 'resolved'
  | 'monitoring';

export type EscalationLevel =
  | 'watch'
  | 'advisory'
  | 'operational'
  | 'critical';

export type SeverityLevel = 'low' | 'medium' | 'high' | 'critical';

export type AgentName =
  | 'signal_extraction'
  | 'crisis_detection'
  | 'severity_reasoning'
  | 'planning'
  | 'resource_allocation'
  | 'traffic_rerouting'
  | 'citizen_alert'
  | 'execution'
  | 'reflection';

export type ActionType =
  | 'traffic_reroute'
  | 'dispatch_emergency'
  | 'citizen_alert'
  | 'infrastructure_isolate'
  | 'heat_shelter_open'
  | 'deploy_pumps';

export type SignalSource =
  | 'social'
  | 'weather'
  | 'traffic'
  | 'field_report'
  | 'sensor';

export const AGENT_PIPELINE: AgentName[] = [
  'signal_extraction',
  'crisis_detection',
  'severity_reasoning',
  'planning',
  'resource_allocation',
  'traffic_rerouting',
  'citizen_alert',
  'execution',
  'reflection',
];
