import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  ORDER_EMAIL_WORKER_CONCURRENCY,
  ORDER_EMAIL_WORKER_MIN_START_INTERVAL_MS,
  runOrderEmailWorker
} from '@/shared/server/orderEmailWorker';

async function unexpectedErrorHandler(
  _job: number,
  error: unknown
): Promise<'failed'> {
  throw error;
}

describe('order email worker orchestration', () => {
  test('checks the master switch before claiming any jobs', async () => {
    let claimCalls = 0;
    let processCalls = 0;

    const summary = await runOrderEmailWorker<number>(
      { maxJobs: 21, deadlineMs: 50_000 },
      {
        readEnabled: async () => false,
        claimJobs: async () => {
          claimCalls += 1;
          return [];
        },
        processJob: async () => {
          processCalls += 1;
        },
        handleJobError: unexpectedErrorHandler
      }
    );

    assert.deepEqual(summary, {
      claimed: 0,
      sent: 0,
      retried: 0,
      failed: 0,
      disabled: true
    });
    assert.equal(claimCalls, 0);
    assert.equal(processCalls, 0);
  });

  test('processes a full 21-recipient batch in bounded, rate-limited chunks', async () => {
    let clockMs = 0;
    let enabledReads = 0;
    let active = 0;
    let maxActive = 0;
    const queue = Array.from({ length: 21 }, (_, index) => index + 1);
    const claimLimits: number[] = [];
    const startTimes: number[] = [];
    const sleepDurations: number[] = [];

    const summary = await runOrderEmailWorker<number>(
      { maxJobs: 21, deadlineMs: 50_000 },
      {
        readEnabled: async () => {
          enabledReads += 1;
          return true;
        },
        claimJobs: async (limit) => {
          claimLimits.push(limit);
          return queue.splice(0, limit);
        },
        processJob: async () => {
          startTimes.push(clockMs);
          active += 1;
          maxActive = Math.max(maxActive, active);
          await new Promise<void>((resolve) => setImmediate(resolve));
          active -= 1;
        },
        handleJobError: unexpectedErrorHandler,
        now: () => clockMs,
        sleep: async (durationMs) => {
          sleepDurations.push(durationMs);
          clockMs += durationMs;
        }
      }
    );

    assert.equal(ORDER_EMAIL_WORKER_CONCURRENCY, 2);
    assert.equal(ORDER_EMAIL_WORKER_MIN_START_INTERVAL_MS, 250);
    assert.deepEqual(summary, {
      claimed: 21,
      sent: 21,
      retried: 0,
      failed: 0,
      disabled: false
    });
    assert.deepEqual(claimLimits, [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1]);
    assert.equal(enabledReads, 11);
    assert.equal(queue.length, 0);
    assert.equal(maxActive, 2);
    assert.deepEqual(
      startTimes,
      Array.from(
        { length: 21 },
        (_, index) => index * ORDER_EMAIL_WORKER_MIN_START_INTERVAL_MS
      )
    );
    assert.deepEqual(
      sleepDurations,
      Array.from(
        { length: 20 },
        () => ORDER_EMAIL_WORKER_MIN_START_INTERVAL_MS
      )
    );
  });

  test('re-checks the master switch before every claim chunk', async () => {
    let clockMs = 0;
    let enabledReads = 0;
    const queue = Array.from({ length: 10 }, (_, index) => index + 1);
    const claimLimits: number[] = [];
    const processed: number[] = [];

    const summary = await runOrderEmailWorker<number>(
      { maxJobs: 10, deadlineMs: 50_000 },
      {
        readEnabled: async () => {
          enabledReads += 1;
          return enabledReads === 1;
        },
        claimJobs: async (limit) => {
          claimLimits.push(limit);
          return queue.splice(0, limit);
        },
        processJob: async (job) => {
          processed.push(job);
        },
        handleJobError: unexpectedErrorHandler,
        now: () => clockMs,
        sleep: async (durationMs) => {
          clockMs += durationMs;
        }
      }
    );

    assert.deepEqual(summary, {
      claimed: 2,
      sent: 2,
      retried: 0,
      failed: 0,
      disabled: true
    });
    assert.equal(enabledReads, 2);
    assert.deepEqual(claimLimits, [2]);
    assert.deepEqual(processed, [1, 2]);
    assert.equal(queue.length, 8);
  });

  test('stops claiming at the deadline but starts every job already claimed', async () => {
    let clockMs = 0;
    let enabledReads = 0;
    const queue = Array.from({ length: 25 }, (_, index) => index + 1);
    const claimLimits: number[] = [];
    const started: number[] = [];
    const handledErrors: number[] = [];

    const summary = await runOrderEmailWorker<number>(
      { maxJobs: 25, deadlineMs: 50 },
      {
        readEnabled: async () => {
          enabledReads += 1;
          return true;
        },
        claimJobs: async (limit) => {
          claimLimits.push(limit);
          return queue.splice(0, limit);
        },
        processJob: async (job) => {
          started.push(job);
          if (job === 1) {
            clockMs = 100;
            return;
          }
          throw new Error('provider unavailable');
        },
        handleJobError: async (job) => {
          handledErrors.push(job);
          return 'retried';
        },
        now: () => clockMs,
        sleep: async (durationMs) => {
          clockMs += durationMs;
        }
      }
    );

    assert.deepEqual(summary, {
      claimed: 2,
      sent: 1,
      retried: 1,
      failed: 0,
      disabled: false
    });
    assert.equal(enabledReads, 1);
    assert.deepEqual(claimLimits, [2]);
    assert.deepEqual(started, [1, 2]);
    assert.deepEqual(handledErrors, [2]);
    assert.equal(queue.length, 23);
    assert.ok(clockMs >= 50);
  });
});
