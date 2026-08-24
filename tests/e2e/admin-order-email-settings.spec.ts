import { expect, test } from '@playwright/test';
import { ADMIN_STORAGE_STATE_PATH } from './support/auth';

test.use({ storageState: ADMIN_STORAGE_STATE_PATH });

test('admin can configure order email recipients and event controls without sending mail', async ({ page }) => {
  const initialResponse = await page.request.get('/api/admin/order-email-settings');
  expect(initialResponse.ok()).toBeTruthy();
  const initialPayload = await initialResponse.json() as {
    state: { config: Record<string, unknown> };
  };
  const originalConfig = initialPayload.state.config;

  try {
    await page.goto('/admin/email');

    await expect(page.getByRole('heading', { name: 'Email', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Email', exact: true })).toBeVisible();
    await expect(page.getByText('Pošiljanje je v E2E izklopljeno')).toBeVisible();
    await expect(page.getByTestId('order-email-event-order_submitted-customer')).toBeChecked();
    await expect(page.getByTestId('order-email-event-in_progress-admins')).toBeChecked();

    const saveButton = page.getByTestId('order-email-settings-save');
    const siteUrl = page.getByLabel('Naslov spletnega mesta');
    const originalSiteUrl = await siteUrl.inputValue();

    await siteUrl.fill('not-a-valid-url');
    await expect(saveButton).toBeEnabled();
    await saveButton.click();
    await expect(
      page.getByRole('alert').filter({ hasText: 'Spletni naslov' }).first()
    ).toBeVisible();
    await expect(siteUrl).toHaveAttribute('aria-invalid', 'true');
    await siteUrl.fill(originalSiteUrl);

    let testRequestBody: {
      recipient?: unknown;
      config?: Record<string, unknown>;
    } | undefined;
    await page.route('**/api/admin/order-email-settings/test', async (route) => {
      testRequestBody = route.request().postDataJSON() as {
        recipient?: unknown;
        config?: Record<string, unknown>;
      };
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Testno sporočilo je prestreženo v E2E.' })
      });
    });
    const testRecipient = page.getByLabel('Prejemnik testa');
    await testRecipient.fill('e2e-test@example.com');
    await testRecipient.press('Enter');
    await expect(page.getByText('Testno sporočilo je prestreženo v E2E.')).toBeVisible();
    expect(testRequestBody).toMatchObject({ recipient: 'e2e-test@example.com' });
    expect(testRequestBody?.config).toEqual(expect.objectContaining({ siteUrl: originalSiteUrl }));
    const serializedTestRequest = JSON.stringify(testRequestBody);
    expect(serializedTestRequest).not.toContain('RESEND_API_KEY');
    expect(serializedTestRequest).not.toContain('apiKey');

    await page.getByRole('button', { name: 'Dodaj naslov' }).click();
    const recipient = page.getByLabel(/E-poštni naslov administratorja/u).last();
    await recipient.fill('  E2E-ORDER-EMAIL@EXAMPLE.COM  ');

    const finishedCustomer = page.getByTestId('order-email-event-finished-customer');
    const originalFinishedCustomer = await finishedCustomer.isChecked();
    await finishedCustomer.setChecked(!originalFinishedCustomer);

    await saveButton.click();
    await expect(page.getByText('Nastavitve samodejne e-pošte so shranjene.')).toBeVisible();

    await page.reload();
    await expect(
      page.locator('input[value="e2e-order-email@example.com"]')
    ).toBeVisible();
    await expect(
      page.getByTestId('order-email-event-finished-customer')
    ).toBeChecked({ checked: !originalFinishedCustomer });
  } finally {
    const restoreResponse = await page.request.put('/api/admin/order-email-settings', {
      data: { config: originalConfig }
    });
    expect(restoreResponse.ok()).toBeTruthy();
  }
});
