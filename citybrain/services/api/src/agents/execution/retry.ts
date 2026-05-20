import type { ExecutionToolResult } from '@citybrain/shared';
import type { ToolResult } from '@citybrain/agent-tools';

export const MAX_RETRIES = 3;
export const RETRY_DELAY_MS = 400;

const RETRYABLE_ERRORS = new Set(['rate_limit', 'timeout', 'external_service']);

export function isRetryable(errorType?: string): boolean {
  return Boolean(errorType && RETRYABLE_ERRORS.has(errorType));
}

export async function executeWithRetry<T extends ToolResult>(
  fn: (attempt: number) => Promise<T>,
  options?: { maxRetries?: number; delayMs?: number }
): Promise<{ result: T; attempts: number }> {
  const max = options?.maxRetries ?? MAX_RETRIES;
  const delay = options?.delayMs ?? RETRY_DELAY_MS;
  let last: T | null = null;

  for (let attempt = 1; attempt <= max; attempt++) {
    last = await fn(attempt);
    if (last.success) return { result: last, attempts: attempt };
    if (!isRetryable(last.errorType)) return { result: last, attempts: attempt };
    if (attempt < max) await sleep(delay * attempt);
  }

  return { result: last!, attempts: max };
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export function mergeToolResults(results: ExecutionToolResult[]): {
  success: boolean;
  status: 'success' | 'partial' | 'failed';
  stateDelta: Record<string, unknown>;
  log: string;
} {
  const ok = results.filter((r) => r.success);
  const fail = results.filter((r) => !r.success);

  const stateDelta: Record<string, unknown> = {};
  for (const r of ok) {
    if (r.data) Object.assign(stateDelta, r.data);
  }

  let status: 'success' | 'partial' | 'failed' = 'success';
  if (fail.length > 0 && ok.length > 0) status = 'partial';
  if (fail.length > 0 && ok.length === 0) status = 'failed';

  const log =
    ok.map((r) => r.content).join(' | ') +
    (fail.length ? ` | FAILED: ${fail.map((r) => r.content).join('; ')}` : '');

  return { success: status !== 'failed', status, stateDelta, log };
}
