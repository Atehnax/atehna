import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import {
  isDirectOrderSellerAcceptanceTransition,
  type DirectOrderSellerAcceptanceTransition
} from '../../src/shared/domain/order/contractStatus';

const eligibleTransition: DirectOrderSellerAcceptanceTransition = {
  previousStatus: 'received',
  nextStatus: 'in_progress',
  customerType: 'company',
  commitmentStatus: 'binding',
  contractStatus: 'pending_seller_acceptance',
  sourceQuoteOfferVersionId: null
};

test('only an ordinary pending direct order is implicitly accepted for processing', () => {
  assert.equal(
    isDirectOrderSellerAcceptanceTransition(eligibleTransition),
    true
  );
  assert.equal(
    isDirectOrderSellerAcceptanceTransition({
      ...eligibleTransition,
      customerType: 'individual'
    }),
    true
  );

  assert.equal(
    isDirectOrderSellerAcceptanceTransition({
      ...eligibleTransition,
      commitmentStatus: 'pending_confirmation'
    }),
    true
  );

  const ineligible: DirectOrderSellerAcceptanceTransition[] = [
    { ...eligibleTransition, previousStatus: 'cancelled' },
    { ...eligibleTransition, nextStatus: 'partially_sent' },
    { ...eligibleTransition, customerType: 'school' },
    { ...eligibleTransition, customerType: 'legacy' },
    { ...eligibleTransition, commitmentStatus: 'rejected' },
    { ...eligibleTransition, contractStatus: 'accepted' },
    { ...eligibleTransition, contractStatus: 'rejected' },
    { ...eligibleTransition, sourceQuoteOfferVersionId: 42 }
  ];
  for (const transition of ineligible) {
    assert.equal(
      isDirectOrderSellerAcceptanceTransition(transition),
      false
    );
  }
});

test('status route persists acceptance before status effects in one transaction', () => {
  const route = readFileSync(
    resolve(process.cwd(), 'src/admin/api/orders/[orderId]/status/route.ts'),
    'utf8'
  );
  const acceptanceIndex = route.indexOf("set commitment_status = 'binding'");
  const acceptanceEndIndex = route.indexOf('returning commitment_status, contract_status', acceptanceIndex);
  const statusIndex = route.indexOf('update orders set status = $1');
  const logIndex = route.indexOf('insert into order_status_logs');
  const emailIndex = route.indexOf('await enqueueOrderEmailEvent');
  const auditIndex = route.indexOf('await insertAuditEventForRequest');
  const commitIndex = route.indexOf("await client.query('commit')", auditIndex);

  assert.ok(acceptanceIndex >= 0);
  assert.ok(acceptanceEndIndex > acceptanceIndex);
  assert.ok(statusIndex > acceptanceIndex);
  assert.ok(logIndex > statusIndex);
  assert.ok(emailIndex > logIndex);
  assert.ok(auditIndex > acceptanceIndex);
  assert.ok(commitIndex > auditIndex);
  assert.equal(route.indexOf("await client.query('commit')", commitIndex + 1), -1);

  const acceptanceSql = route.slice(acceptanceIndex, acceptanceEndIndex);
  assert.match(acceptanceSql, /contract_status = 'accepted'/u);
  assert.match(acceptanceSql, /contract_accepted_at = \$2/u);
  assert.match(acceptanceSql, /contract_accepted_actor_type = 'admin'/u);
  assert.match(acceptanceSql, /contract_acceptance_evidence_json = \$3::jsonb/u);
  assert.match(acceptanceSql, /contract_state_version = contract_state_version \+ 1/u);
  assert.match(acceptanceSql, /committed_at = \$2/u);
  assert.match(acceptanceSql, /customer_type in \('individual', 'company'\)/u);
  assert.match(
    acceptanceSql,
    /commitment_status in \('pending_confirmation', 'binding'\)/u
  );
  assert.match(acceptanceSql, /contract_status = 'pending_seller_acceptance'/u);
  assert.match(acceptanceSql, /source_quote_offer_version_id is null/u);
  assert.doesNotMatch(acceptanceSql, /is_draft/u);

  assert.doesNotMatch(route, /ORDER_DELIVERY_PLAN_CONTRACT_NOT_ACCEPTED/u);
  assert.match(route, /contractStatus: resultingContractStatus/u);
  assert.match(route, /before: 'pending_seller_acceptance'[\s\S]*?after: 'accepted'/u);
  assert.match(
    route,
    /contract_accepted_automatically:\s*automaticallyAcceptsPendingOrder/u
  );
  assert.match(
    route,
    /const shouldCommitDirectStock =[\s\S]*?stockEnforcementEnabled[\s\S]*?if \(shouldCommitDirectStock\)[\s\S]*?await commitOrderStockHolds\(/u
  );
  assert.match(route, /direct_stock_finalization_outcome:/u);
  assert.match(route, /\{ type: 'admin' \}/u);
  assert.match(route, /error instanceof OrderStockConflictError/u);
  assert.match(route, /contract_accepted_while_draft:[\s\S]*?workflow\?\.is_draft === true/u);
  assert.match(
    route,
    /else if \(automaticallyAcceptsDirectOrder\) \{[\s\S]*?shouldEnqueueStatusEmail = false/u
  );
  assert.doesNotMatch(route, /eventType:\s*'order_accepted'/u);
});
