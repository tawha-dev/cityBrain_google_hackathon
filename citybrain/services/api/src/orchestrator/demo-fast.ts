import type { CrisisRunState } from '@citybrain/shared';

/** Demo scenarios skip per-signal LLM calls so traces appear in seconds, not minutes. */
export function useDemoFastPath(state: Pick<CrisisRunState, 'scenarioKey'>): boolean {
  return Boolean(state.scenarioKey) || process.env.DEMO_FAST_PIPELINE === 'true';
}
