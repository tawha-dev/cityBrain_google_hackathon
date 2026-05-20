export type WsEventType =
  | 'signal.new'
  | 'crisis.updated'
  | 'agent.step'
  | 'action.executed'
  | 'map.delta'
  | 'escalation.changed'
  | 'pipeline.complete'
  | 'pipeline.failed'
  | 'pipeline.replan'
  | 'execution.started'
  | 'execution.progress'
  | 'execution.completed'
  | 'execution.failed'
  | 'dashboard.updated'
  | 'simulation.started'
  | 'simulation.tick'
  | 'simulation.frame'
  | 'simulation.completed'
  | 'citizen.report.updated'
  | 'citizen.progress'
  | 'citizen.alert'
  | 'dispatch.updated'
  | 'dispatch.rerouted'
  | 'dispatch.position'
  | 'dispatch.eta_update';

export interface WsEvent<T = unknown> {
  type: WsEventType;
  crisisId?: string;
  reportId?: string;
  timestamp: string;
  payload: T;
}

export interface WsSubscribeMessage {
  subscribe: {
    role: 'authority' | 'citizen';
    reportId?: string;
    crisisId?: string;
  };
}

export interface AgentStepPayload {
  agent: string;
  status: 'started' | 'completed' | 'failed';
  thought?: string;
  output?: unknown;
  latencyMs?: number;
}
