import { readFile } from 'node:fs/promises';
import process from 'node:process';

function collectTests(report) {
  const collected = [];

  function visitSuite(suite, parentTitles = []) {
    const titles = suite.title ? [...parentTitles, suite.title] : parentTitles;
    for (const spec of suite.specs ?? []) {
      for (const test of spec.tests ?? []) {
        const identity = [
          spec.file ?? '',
          spec.line ?? 0,
          spec.column ?? 0,
          test.projectName ?? '',
          ...titles,
          spec.title ?? ''
        ].join('::');
        collected.push({ identity, spec, test });
      }
    }
    for (const child of suite.suites ?? []) visitSuite(child, titles);
  }

  for (const suite of report.suites ?? []) visitSuite(suite);
  return collected;
}

function fail(message) {
  throw new Error(`[playwright-report] ${message}`);
}

async function main() {
  const mergedPath = process.argv[2];
  const expectedPath = process.argv[3];
  if (!mergedPath || !expectedPath) {
    fail('Usage: node scripts/verify-playwright-report.mjs <merged.json> <expected-list.json>.');
  }

  const [merged, expected] = await Promise.all([
    readFile(mergedPath, 'utf8').then(JSON.parse),
    readFile(expectedPath, 'utf8').then(JSON.parse)
  ]);
  if ((merged.errors ?? []).length > 0) {
    fail(`Merged report contains ${(merged.errors ?? []).length} top-level errors.`);
  }
  if ((expected.errors ?? []).length > 0) {
    fail(`Expected-test inventory contains ${(expected.errors ?? []).length} top-level errors.`);
  }
  const mergedTests = collectTests(merged);
  const expectedTests = collectTests(expected);
  if (expectedTests.length === 0) fail('Expected-test inventory is empty.');
  const mergedByIdentity = new Map();

  for (const entry of mergedTests) {
    const duplicateCount = (mergedByIdentity.get(entry.identity)?.length ?? 0) + 1;
    const matches = mergedByIdentity.get(entry.identity) ?? [];
    matches.push(entry);
    mergedByIdentity.set(entry.identity, matches);
    if (duplicateCount > 1) fail(`Duplicate retained test execution: ${entry.identity}.`);

    if (entry.test.status !== 'expected') {
      fail(`Unexpected test status ${entry.test.status}: ${entry.identity}.`);
    }
    if ((entry.test.results ?? []).length !== 1) {
      fail(`Expected exactly one execution result for ${entry.identity}, found ${(entry.test.results ?? []).length}.`);
    }
    if (entry.test.results[0]?.status !== 'passed') {
      fail(`Test did not pass: ${entry.identity} (${entry.test.results[0]?.status ?? 'missing result'}).`);
    }
  }

  const expectedIdentities = new Set();
  for (const entry of expectedTests) {
    if (expectedIdentities.has(entry.identity)) {
      fail(`Expected-test inventory contains a duplicate identity: ${entry.identity}.`);
    }
    expectedIdentities.add(entry.identity);
  }
  const mergedIdentities = new Set(mergedTests.map((entry) => entry.identity));
  const missing = [...expectedIdentities].filter((identity) => !mergedIdentities.has(identity));
  const unexpected = [...mergedIdentities].filter((identity) => !expectedIdentities.has(identity));
  if (missing.length > 0) fail(`Merged report is missing ${missing.length} retained tests; first missing test: ${missing[0]}.`);
  if (unexpected.length > 0) fail(`Merged report contains ${unexpected.length} unexpected tests; first: ${unexpected[0]}.`);
  if (mergedTests.length !== expectedTests.length) {
    fail(`Merged test count ${mergedTests.length} does not match retained count ${expectedTests.length}.`);
  }

  console.info(`[playwright-report] Verified ${mergedTests.length} retained tests, each executed exactly once.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : '[playwright-report] Unknown verification failure.');
  process.exitCode = 1;
});
