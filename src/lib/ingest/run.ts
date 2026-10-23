export type IsolatedRun<T> = {
  ok: Array<{ item: T; written: number }>;
  failed: Array<{ item: T; error: string }>;
  written: number;
};

/**
 * Run one task per item so a single bad series or symbol cannot abort the
 * rest of the job. Errors are collected, not thrown.
 */
export async function runIsolated<T>(
  items: readonly T[],
  label: (item: T) => string,
  task: (item: T) => Promise<number>,
  options?: {
    pauseMs?: number;
    log?: (line: string) => void;
    sleep?: (ms: number) => Promise<void>;
  },
): Promise<IsolatedRun<T>> {
  const log = options?.log ?? ((line: string) => console.log(line));
  const sleep =
    options?.sleep ??
    ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const result: IsolatedRun<T> = { ok: [], failed: [], written: 0 };

  for (const [index, item] of items.entries()) {
    try {
      const written = await task(item);
      result.ok.push({ item, written });
      result.written += written;
      log(`  ${label(item)}: ${written}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result.failed.push({ item, error: message });
      log(`  ${label(item)}: FAILED (${message})`);
    }

    if (options?.pauseMs && index < items.length - 1) {
      await sleep(options.pauseMs);
    }
  }

  return result;
}

/**
 * Fail the job only when nothing succeeded or failures exceed the budget,
 * so occasional provider flakiness keeps the rest of the pipeline running.
 */
export function assertFailureBudget<T>(
  job: string,
  run: IsolatedRun<T>,
  maxFailureRatio = 0.5,
): void {
  const total = run.ok.length + run.failed.length;
  if (total === 0 || run.failed.length === 0) return;

  const ratio = run.failed.length / total;
  if (run.ok.length === 0 || ratio > maxFailureRatio) {
    throw new Error(
      `${job}: ${run.failed.length}/${total} failed (budget ${Math.round(maxFailureRatio * 100)}%)`,
    );
  }
}
