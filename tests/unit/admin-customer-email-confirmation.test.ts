import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CUSTOMER_EMAIL_CONFIRMATION_REQUIRED_CODE
} from '@/shared/domain/email/adminCustomerEmailConfirmation';
import {
  requireAdminCustomerEmailConfirmationForDeliveries
} from '@/shared/server/adminCustomerEmailConfirmationToken';

const baseInput = {
  action: 'change_order_status',
  actionLabel: 'Sprememba statusa naročila',
  confirmCustomerEmails: true,
  deliveries: [{
    scope: 'order' as const,
    entityId: 42,
    eventType: 'in_progress',
    eventLabel: 'V obdelavi',
    recipientEmail: '  CUSTOMER@Example.COM ',
    masterEmailEnabled: true,
    customerAudienceEnabled: true
  }]
};

test('issues and verifies a signed recipient-bound challenge', () => {
  const challenge =
    requireAdminCustomerEmailConfirmationForDeliveries(baseInput);
  assert.equal(challenge?.code, CUSTOMER_EMAIL_CONFIRMATION_REQUIRED_CODE);
  assert.equal(challenge?.scope, 'order');
  assert.equal(challenge?.recipientEmail, 'customer@example.com');
  assert.equal(challenge?.deliveries.length, 1);
  assert.match(challenge?.confirmationToken ?? '', /^[^.]+\.[^.]+$/u);
  assert.ok(Date.parse(challenge?.expiresAt ?? '') > Date.now());

  assert.equal(requireAdminCustomerEmailConfirmationForDeliveries({
    ...baseInput,
    confirmationToken: challenge?.confirmationToken
  }), null);

  const changedRecipient = requireAdminCustomerEmailConfirmationForDeliveries({
    ...baseInput,
    confirmationToken: challenge?.confirmationToken,
    deliveries: [{
      ...baseInput.deliveries[0],
      recipientEmail: 'other@example.com'
    }]
  });
  assert.equal(changedRecipient?.recipientEmail, 'other@example.com');
  assert.notEqual(changedRecipient?.confirmationToken, challenge?.confirmationToken);
});

test('does not challenge disabled or invalid customer deliveries', () => {
  assert.equal(
    requireAdminCustomerEmailConfirmationForDeliveries({
      ...baseInput,
      confirmCustomerEmails: false
    }),
    null
  );
  for (const patch of [
    { masterEmailEnabled: false },
    { customerAudienceEnabled: false },
    { recipientEmail: 'not-an-email' }
  ]) {
    assert.equal(
      requireAdminCustomerEmailConfirmationForDeliveries({
        ...baseInput,
        deliveries: [{ ...baseInput.deliveries[0], ...patch }]
      }),
      null
    );
  }
});

test('one token binds the complete canonical order and quote delivery set', () => {
  const challenge = requireAdminCustomerEmailConfirmationForDeliveries({
    ...baseInput,
    action: 'issue_quote\nunsafe',
    actionLabel: 'Izdaja\tponudbe',
    deliveries: [
      baseInput.deliveries[0],
      {
        scope: 'quote',
        entityId: 7,
        eventType: 'quote_issued',
        eventLabel: 'Ponudba\r\nizdana',
        recipientEmail: 'quote@example.com',
        masterEmailEnabled: true,
        customerAudienceEnabled: true
      }
    ]
  });

  assert.equal(challenge?.scope, 'multiple');
  assert.equal(challenge?.action, 'issue_quote unsafe');
  assert.equal(challenge?.actionLabel, 'Izdaja ponudbe');
  assert.equal(challenge?.deliveries.length, 2);
  assert.deepEqual(
    challenge?.deliveries.map((delivery) => delivery.recipientEmail).sort(),
    ['customer@example.com', 'quote@example.com']
  );
});
