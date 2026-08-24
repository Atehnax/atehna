export const ORDER_EMAIL_WORKER_CONCURRENCY = 2;
export const ORDER_EMAIL_WORKER_MIN_START_INTERVAL_MS = 250;
export const DEFAULT_ORDER_EMAIL_WORKER_MAX_JOBS = 25;

export type OrderEmailWorkerFailureOutcome = 'retried' | 'failed';

export type OrderEmailWorkerSummary = {
  claimed: number;
  sent: number;
  retried: number;
  failed: number;
  disabled: boolean;
};

export type OrderEmailWorkerOptions = {
  maxJobs?: number;
  deadlineMs?: number;
};

export type OrderEmailWorkerDependencies<Job> = {
  readEnabled: () => Promise<boolean>;
  claimJobs: (limit: number) => Promise<Job[]>;
  processJob: (job: Job) => Promise<void>;
  handleJobError: (
    job: Job,
    error: unknown
  ) => Promise<OrderEmailWorkerFailureOutcome>;
  now?: () => number;
  sleep?: (durationMs: number) => Promise<void>;
};

function positiveInteger(value: number | undefined, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(0, Math.trunc(value ?? fallback));
}

function deadlineFrom(
  startedAt: number,
  deadlineMs: number | undefined
): number {
  if (!Number.isFinite(deadlineMs)) return Number.POSITIVE_INFINITY;
  return startedAt + Math.max(0, deadlineMs ?? 0);
}

async function processClaimedJob<Job>(
  job: Job,
  dependencies: Pick<
    OrderEmailWorkerDependencies<Job>,
    'processJob' | 'handleJobError'
  >
): Promise<'sent' | OrderEmailWorkerFailureOutcome> {
  try {
    await dependencies.processJob(job);
    return 'sent';
  } catch (error) {
    return dependencies.handleJobError(job, error);
  }
}

export async function runOrderEmailWorker<Job>(
  options: OrderEmailWorkerOptions,
  dependencies: OrderEmailWorkerDependencies<Job>
): Promise<OrderEmailWorkerSummary> {
  const now = dependencies.now ?? Date.now;
  const sleep =
    dependencies.sleep ??
    ((durationMs: number) =>
      new Promise<void>((resolve) => setTimeout(resolve, durationMs)));
  const maxJobs = positiveInteger(
    options.maxJobs,
    DEFAULT_ORDER_EMAIL_WORKER_MAX_JOBS
  );
  const deadlineAt = deadlineFrom(now(), options.deadlineMs);
  let nextStartAt = now();
  const summary: OrderEmailWorkerSummary = {
    claimed: 0,
    sent: 0,
    retried: 0,
    failed: 0,
    disabled: false
  };

  while (summary.claimed < maxJobs && now() < deadlineAt) {
    const enabled = await dependencies.readEnabled();
    if (!enabled) {
      summary.disabled = true;
      break;
    }
    if (now() >= deadlineAt) break;

    const claimLimit = Math.min(
      ORDER_EMAIL_WORKER_CONCURRENCY,
      maxJobs - summary.claimed
    );
    const jobs = await dependencies.claimJobs(claimLimit);
    if (jobs.length === 0) break;

    summary.claimed += jobs.length;
    const outcomePromises: Array<
      Promise<'sent' | OrderEmailWorkerFailureOutcome>
    > = [];
    for (const job of jobs) {
      const waitMs = Math.max(0, nextStartAt - now());
      if (waitMs > 0) await sleep(waitMs);

      const startedAt = now();
      nextStartAt =
        Math.max(nextStartAt, startedAt) +
        ORDER_EMAIL_WORKER_MIN_START_INTERVAL_MS;
      outcomePromises.push(processClaimedJob(job, dependencies));
    }

    const outcomes = await Promise.all(outcomePromises);
    for (const outcome of outcomes) {
      summary[outcome] += 1;
    }

    if (jobs.length < claimLimit) break;
  }

  return summary;
}
