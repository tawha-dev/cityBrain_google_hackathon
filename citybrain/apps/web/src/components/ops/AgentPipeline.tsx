import { AGENT_LABELS, AGENT_ORDER } from '../../theme/tokens';

interface Trace {
  agent: string;
  status: string;
  thought?: string;
}

interface AgentPipelineProps {
  traces: Trace[];
}

export function AgentPipeline({ traces }: AgentPipelineProps) {
  const completed = new Set(
    traces.filter((t) => t.status === 'completed').map((t) => t.agent)
  );
  const started = new Set(traces.filter((t) => t.status === 'started').map((t) => t.agent));

  let activeAgent: string | null = null;
  for (const agent of AGENT_ORDER) {
    if (started.has(agent) && !completed.has(agent)) activeAgent = agent;
  }
  if (!activeAgent) {
    const lastCompleted = [...AGENT_ORDER].reverse().find((a) => completed.has(a));
    activeAgent = lastCompleted ?? null;
  }

  const progress = Math.round(
    (AGENT_ORDER.filter((a) => completed.has(a)).length / AGENT_ORDER.length) * 100
  );

  return (
    <div className="agent-pipeline">
      <div className="agent-pipeline__bar">
        <div className="agent-pipeline__fill" style={{ width: `${progress}%` }} />
        <span className="agent-pipeline__pct">{progress}%</span>
      </div>
      <div className="agent-pipeline__track">
        {AGENT_ORDER.map((agent, i) => {
          const done = completed.has(agent);
          const active = agent === activeAgent && !done;
          const pending = !done && !active;
          return (
            <div key={agent} className="agent-pipeline__node-wrap">
              {i > 0 && (
                <span
                  className={`agent-pipeline__connector ${done ? 'agent-pipeline__connector--done' : ''}`}
                />
              )}
              <div
                className={`agent-pipeline__node ${done ? 'agent-pipeline__node--done' : ''} ${active ? 'agent-pipeline__node--active' : ''} ${pending ? 'agent-pipeline__node--pending' : ''}`}
                title={agent}
              >
                <span className="agent-pipeline__dot" />
                <span className="agent-pipeline__label">
                  {AGENT_LABELS[agent] ?? agent}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
