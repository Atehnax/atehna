import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import {
  readConfirmationDocumentsSafely,
  scheduleConfirmationDocumentRepairSafely
} from '../../src/commercial/api/orders/confirmation/documentResilience';

test('a document lookup failure returns an empty document list', async () => {
  const failure = new Error('document database unavailable');
  let reported: unknown;

  const documents = await readConfirmationDocumentsSafely(
    async () => {
      throw failure;
    },
    (error) => {
      reported = error;
    }
  );

  assert.deepEqual(documents, []);
  assert.equal(reported, failure);
});

test('invalid document metadata is isolated from the core confirmation', async () => {
  let reported: unknown;
  const documents = await readConfirmationDocumentsSafely(
    async () => [
      {
        type: 'order_summary',
        customer_access_id: ''
      }
    ],
    (error) => {
      reported = error;
    }
  );

  assert.deepEqual(documents, []);
  assert.match(String(reported), /incomplete customer metadata/u);
});

test('a document repair scheduling failure is contained', () => {
  const failure = new Error('scheduler unavailable');
  let reported: unknown;

  assert.doesNotThrow(() =>
    scheduleConfirmationDocumentRepairSafely(
      () => {
        throw failure;
      },
      (error) => {
        reported = error;
      }
    )
  );
  assert.equal(reported, failure);
});

test('the confirmation route uses the isolated document promise alongside core data', async () => {
  const source = await readFile(
    resolve(process.cwd(), 'src/commercial/api/orders/confirmation/route.ts'),
    'utf8'
  );

  assert.match(
    source,
    /const documentsPromise = readConfirmationDocumentsSafely\([\s\S]*?from order_documents[\s\S]*?reportDocumentSubsystemFailure\('lookup'/u
  );
  assert.match(
    source,
    /const \[orderResult, snapshotsResult, documents\] = await Promise\.all\([\s\S]*?documentsPromise/u
  );
  assert.match(
    source,
    /scheduleConfirmationDocumentRepairSafely\([\s\S]*?scheduleInitialOrderSummaryJob/u
  );
  assert.doesNotMatch(
    source,
    /const \[orderResult, snapshotsResult, documentsResult\] = await Promise\.all/u
  );
});
