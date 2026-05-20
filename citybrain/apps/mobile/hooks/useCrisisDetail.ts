import { useQuery } from '@tanstack/react-query';
import { fetchApi } from '../lib/api';
import { useCrisisStore } from '../lib/store';

export function useCrisisDetail(id: string | undefined) {
  const liveBefore = useCrisisStore((s) => s.beforeMetrics);
  const liveAfter = useCrisisStore((s) => s.afterMetrics);

  const crisisQuery = useQuery({
    queryKey: ['crisis', id],
    queryFn: () => fetchApi<{ crisis: Record<string, unknown>; signals: unknown[] }>(`/crises/${id}`),
    enabled: !!id,
    refetchInterval: 4000,
  });

  const tracesQuery = useQuery({
    queryKey: ['traces', id],
    queryFn: () => fetchApi<{ traces: Array<Record<string, unknown>> }>(`/crises/${id}/traces`),
    enabled: !!id,
    refetchInterval: 3000,
  });

  const execQuery = useQuery({
    queryKey: ['executions', id],
    queryFn: () => fetchApi<{ executions: Array<Record<string, unknown>> }>(`/crises/${id}/executions`),
    enabled: !!id,
    refetchInterval: 2500,
  });

  const stateQuery = useQuery({
    queryKey: ['state', id],
    queryFn: () =>
      fetchApi<{ before: Record<string, unknown>; after: Record<string, unknown> }>(
        `/crises/${id}/state`
      ),
    enabled: !!id,
    refetchInterval: 4000,
  });

  const resourcesQuery = useQuery({
    queryKey: ['resources'],
    queryFn: () => fetchApi<{ resources: Array<Record<string, unknown>> }>('/resources'),
    refetchInterval: 10000,
  });

  const crisis = crisisQuery.data?.crisis;
  const dossier = (crisis?.dossier_json ?? {}) as Record<string, unknown>;
  const candidate = dossier.candidate as Record<string, unknown> | undefined;
  const reflection = dossier.reflection as Record<string, unknown> | undefined;

  const lat = Number(crisis?.centroid_lat ?? (candidate?.centroid as { lat?: number })?.lat ?? 33.6844);
  const lng = Number(crisis?.centroid_lng ?? (candidate?.centroid as { lng?: number })?.lng ?? 73.0479);

  const beforeDb = (stateQuery.data?.before?.metrics_json ?? {}) as Record<string, number>;
  const afterDb = (stateQuery.data?.after?.metrics_json ?? {}) as Record<string, number>;

  const beforeMetrics = Object.keys(liveBefore).length ? liveBefore : beforeDb;
  const afterMetrics = Object.keys(liveAfter).length ? liveAfter : afterDb;

  return {
    crisis,
    candidate,
    reflection,
    lat,
    lng,
    tracesQuery,
    execQuery,
    stateQuery,
    resourcesQuery,
    crisisQuery,
    beforeMetrics,
    afterMetrics,
  };
}
