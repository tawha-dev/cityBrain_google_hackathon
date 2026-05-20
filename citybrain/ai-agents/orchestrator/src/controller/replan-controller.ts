import type { CrisisRunState, ReflectionReport } from '@citybrain/shared';

export class ReplanController {
  readonly maxPlanVersion = 2;
  readonly congestionThreshold = 0.25;
  readonly strandedThreshold = 0.1;

  shouldReplan(state: CrisisRunState): boolean {
    if (state.planVersion >= this.maxPlanVersion) return false;
    const reflection = state.reflection;
    if (!reflection) return false;
    if (reflection.replanRequired) return true;
    return (
      reflection.metricsDelta.congestionReduction < this.congestionThreshold ||
      reflection.metricsDelta.strandedReduction < this.strandedThreshold
    );
  }

  buildReplanContext(state: CrisisRunState): string {
    const reflection = state.reflection as ReflectionReport;
    return [
      'ADAPTIVE REPLAN REQUIRED',
      `Prior plan v${state.planVersion}: ${state.plan?.summary ?? ''}`,
      `Reflection: ${reflection.summary}`,
      `Lessons: ${reflection.lessons.join('; ')}`,
    ].join('\n');
  }
}
