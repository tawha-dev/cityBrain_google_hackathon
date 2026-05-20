import type { Signal } from '@citybrain/shared';
import { runPipeline } from './graph.js';
import { broadcast } from '../ws/hub.js';
import * as repo from '../db/repository.js';

export async function runPipelineInBackground(
  crisisId: string,
  rawSignals: Signal[],
  scenarioKey?: string,
  reportId?: string
) {
  await repo.updateCrisis(crisisId, { status: 'analyzing' });
  broadcast({
    type: 'crisis.updated',
    crisisId,
    reportId,
    timestamp: new Date().toISOString(),
    payload: { crisisId, status: 'analyzing', reportId },
  });

  if (reportId) {
    broadcast({
      type: 'citizen.progress',
      crisisId,
      reportId,
      timestamp: new Date().toISOString(),
      payload: { reportId, step: 'agents', label: 'AI agents analyzing your report…' },
    });
  }

  try {
    const finalState = await runPipeline(
      { rawSignals, scenarioKey, crisisId },
      crisisId,
      {
        onAgentStep: async ({ agent, status, thought, output, latencyMs }) => {
          if (status === 'completed') {
            const reasoningSteps =
              agent === 'crisis_detection' &&
              output &&
              typeof output === 'object' &&
              'reasoningTrace' in output &&
              Array.isArray((output as { reasoningTrace: unknown[] }).reasoningTrace)
                ? (
                    output as {
                      reasoningTrace: Array<{
                        step: number;
                        title: string;
                        analysis: string;
                        conclusion?: string;
                      }>;
                    }
                  ).reasoningTrace.map((s) => ({
                    stepIndex: s.step,
                    thought: `Step ${s.step} — ${s.title}: ${s.analysis}${s.conclusion ? ` → ${s.conclusion}` : ''}`,
                  }))
                : undefined;

            await repo.createAgentRun({
              crisisId,
              agentName: agent,
              status: 'completed',
              outputJson: output,
              latencyMs,
              thought,
              reasoningSteps,
            });
          }
        },
      }
    );

    await repo.updateCrisis(crisisId, {
      status: finalState.replanRequired ? 'monitoring' : 'resolved',
      type: finalState.candidate?.type,
      title: finalState.candidate?.title,
      areaLabel: finalState.candidate?.areaLabel,
      severity: finalState.severity?.level,
      confidence: finalState.candidate?.confidence,
      escalationLevel: finalState.severity?.escalationLevel,
      summary: finalState.candidate?.summary,
      centroidLat: finalState.candidate?.centroid.lat,
      centroidLng: finalState.candidate?.centroid.lng,
      dossierJson: {
        candidate: finalState.candidate,
        severity: finalState.severity,
        plan: finalState.plan,
        reflection: finalState.reflection,
      },
    });

    broadcast({
      type: 'pipeline.complete',
      crisisId,
      reportId,
      timestamp: new Date().toISOString(),
      payload: { crisisId, reportId, dossier: finalState },
    });

    broadcast({
      type: 'crisis.updated',
      crisisId,
      reportId,
      timestamp: new Date().toISOString(),
      payload: {
        crisisId,
        reportId,
        status: finalState.replanRequired ? 'monitoring' : 'resolved',
        dossier: finalState,
        confidence: finalState.candidate?.confidence,
        escalation: finalState.severity?.escalationLevel,
      },
    });

    return finalState;
  } catch (err) {
    console.error('[pipeline]', crisisId, err);
    await repo.updateCrisis(crisisId, { status: 'failed' }).catch(() => {});
    broadcast({
      type: 'pipeline.failed',
      crisisId,
      reportId,
      timestamp: new Date().toISOString(),
      payload: {
        crisisId,
        reportId,
        error: err instanceof Error ? err.message : String(err),
      },
    });
    throw err;
  }
}
