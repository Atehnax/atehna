import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';

function passingReport() {
  return {
    errors: [] as { message: string }[],
    suites: [{
      title: 'commerce.spec.ts',
      suites: [{
        title: 'customer workflow',
        specs: [{
          file: 'commerce.spec.ts',
          line: 12,
          column: 3,
          title: 'preserves its result',
          tests: [{
            projectName: 'chromium',
            status: 'expected',
            results: [{ status: 'passed' }]
          }]
        }]
      }]
    }]
  };
}

type Report = ReturnType<typeof passingReport>;
const reportSpec = (report: Report) => report.suites[0].suites[0].specs[0];
const reportTest = (report: Report) => reportSpec(report).tests[0];

type InvalidCase = {
  name: string;
  change: (merged: Report, expected: Report) => void;
  message: RegExp;
};

const invalidCases: InvalidCase[] = [
  {
    name: 'missing shard tests',
    change: (merged) => { merged.suites = []; },
    message: /missing 1 retained tests/u
  },
  {
    name: 'unexpected tests',
    change: (merged) => {
      const additional = structuredClone(reportSpec(merged));
      additional.title = 'another outcome';
      merged.suites[0].suites[0].specs.push(additional);
    },
    message: /contains 1 unexpected tests/u
  },
  {
    name: 'duplicate shard executions',
    change: (merged) => { merged.suites.push(structuredClone(merged.suites[0])); },
    message: /Duplicate retained test execution/u
  },
  {
    name: 'skipped tests',
    change: (merged) => { reportTest(merged).results[0].status = 'skipped'; },
    message: /Test did not pass/u
  },
  {
    name: 'failed tests',
    change: (merged) => { reportTest(merged).status = 'unexpected'; },
    message: /Unexpected test status unexpected/u
  },
  {
    name: 'flaky results',
    change: (merged) => { reportTest(merged).status = 'flaky'; },
    message: /Unexpected test status flaky/u
  },
  {
    name: 'retried executions',
    change: (merged) => { reportTest(merged).results.unshift({ status: 'failed' }); },
    message: /Expected exactly one execution result/u
  },
  {
    name: 'missing execution results',
    change: (merged) => { reportTest(merged).results = []; },
    message: /Expected exactly one execution result/u
  },
  {
    name: 'global setup or teardown errors',
    change: (merged) => { merged.errors.push({ message: 'setup failed' }); },
    message: /Merged report contains 1 top-level errors/u
  },
  {
    name: 'failed inventory collection',
    change: (_merged, expected) => { expected.errors.push({ message: 'collection failed' }); },
    message: /Expected-test inventory contains 1 top-level errors/u
  },
  {
    name: 'empty inventory',
    change: (_merged, expected) => { expected.suites = []; },
    message: /Expected-test inventory is empty/u
  },
  {
    name: 'duplicate inventory identities',
    change: (_merged, expected) => { expected.suites.push(structuredClone(expected.suites[0])); },
    message: /Expected-test inventory contains a duplicate identity/u
  }
];

async function verifyReports(merged: Report, expected: Report) {
  const directory = await mkdtemp(join(tmpdir(), 'atehna-report-verification-'));
  try {
    const mergedPath = join(directory, 'merged.json');
    const expectedPath = join(directory, 'expected.json');
    await Promise.all([
      writeFile(mergedPath, JSON.stringify(merged)),
      writeFile(expectedPath, JSON.stringify(expected))
    ]);
    return spawnSync(process.execPath, [
      resolve('scripts/verify-playwright-report.mjs'),
      mergedPath,
      expectedPath
    ], { encoding: 'utf8' });
  } finally {
    // This exact directory was created for this case; no repository data is removed.
    await rm(directory, { recursive: true, force: true });
  }
}

test('report verification accepts each expected outcome exactly once', async () => {
  const result = await verifyReports(passingReport(), passingReport());
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Verified 1 retained tests, each executed exactly once/u);
});

for (const scenario of invalidCases) {
  test(`report verification fails closed for ${scenario.name}`, async () => {
    const merged = passingReport();
    const expected = passingReport();
    scenario.change(merged, expected);
    const result = await verifyReports(merged, expected);
    assert.equal(result.status, 1, result.stderr);
    assert.match(result.stderr, scenario.message);
  });
}


type GateStep = { name: string; if?: string; run?: string; id?: string };
async function reportJob() {
  const { load } = createRequire(import.meta.url)('js-yaml');
  const workflow = load(await readFile(resolve('.github/workflows/ci.yml'), 'utf8'));
  return workflow.jobs['e2e-report'] as {
    if: string;
    'timeout-minutes': number;
    steps: GateStep[];
  };
}

function executeGate(step: GateStep, values: Record<string, string>) {
  const bash = process.platform === 'win32'
    ? join(process.env.ProgramFiles ?? 'C:/Program Files', 'Git/usr/bin/bash.exe')
    : 'bash';
  assert.ok(step.run, `Missing gate command: ${step.name}`);
  const result = spawnSync(bash, ['--noprofile', '--norc', '-c', step.run], {
    encoding: 'utf8', env: { ...process.env, ...values }
  });
  assert.ifError(result.error);
  return result;
}

test('required report gate remains scheduled after cancellation and is bounded', async () => {
  const job = await reportJob();
  assert.equal(job.if, '${{ always() }}');
  assert.ok(job['timeout-minutes'] > 0 && job['timeout-minutes'] <= 10);
  assert.equal(job.steps[0].name, 'Reject cancellation before report setup');
  assert.equal(job.steps[0].if, 'cancelled()');
  assert.equal(job.steps[1].name, 'Require successful verification jobs');
  assert.equal(job.steps[1].if, 'always()');
  const cancelledGate = job.steps.at(-1);
  assert.ok(cancelledGate);
  assert.equal(cancelledGate.if, 'cancelled()');
  for (const step of [job.steps[0], cancelledGate]) {
    const result = executeGate(step, {});
    assert.equal(result.status, 1, result.stderr);
  }
  const verifyIndex = job.steps.findIndex((step) => step.id === 'verify-report');
  const finalIndex = job.steps.findIndex((step) => step.name === 'Require a complete verified report');
  assert.ok(verifyIndex > 0 && finalIndex > verifyIndex);
  assert.equal(job.steps[finalIndex].if, 'always()');
});

test('required report gate rejects every incomplete prerequisite combination before setup', async () => {
  const job = await reportJob();
  const states = ['success', 'failure', 'cancelled', 'skipped', ''];
  for (const checks of states) {
    for (const e2e of states) {
      const result = executeGate(job.steps[1], {
        CHECKS_RESULT: checks, E2E_RESULT: e2e
      });
      assert.equal(result.status, checks === 'success' && e2e === 'success' ? 0 : 1, result.stderr);
    }
  }

});

test('final report gate rejects missing or unsuccessful report verification', async () => {
  const job = await reportJob();
  const gate = job.steps.find((step) => step.name === 'Require a complete verified report');
  assert.ok(gate);
  for (const report of ['success', 'failure', 'cancelled', 'skipped', '']) {
    const result = executeGate(gate, { REPORT_RESULT: report });
    assert.equal(result.status, report === 'success' ? 0 : 1, result.stderr);
  }
});
