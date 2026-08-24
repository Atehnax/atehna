import { expect, test } from '@playwright/test';
import { ADMIN_STORAGE_STATE_PATH } from './support/auth';

test.use({ storageState: ADMIN_STORAGE_STATE_PATH });

test('admin can configure order email settings and templates without sending mail', async ({ page }) => {
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
    const settingsTab = page.getByRole('tab', { name: 'Nastavitve', exact: true });
    const templatesTab = page.getByRole('tab', { name: 'Predloge', exact: true });
    const emailTabList = page.getByRole('tablist', {
      name: 'Razdelki nastavitev e-pošte'
    });
    await expect(emailTabList).toBeVisible();
    await expect(settingsTab).toHaveAttribute('aria-selected', 'true');
    await expect(templatesTab).toHaveAttribute('aria-selected', 'false');
    await expect(settingsTab).toHaveAttribute('aria-controls', 'order-email-settings-panel');
    await expect(templatesTab).toHaveAttribute('aria-controls', 'order-email-templates-panel');
    await expect(page.getByTestId('order-email-settings-panel')).toBeVisible();
    await expect(page.getByTestId('order-email-settings-panel')).toHaveAttribute(
      'aria-labelledby',
      'order-email-tab-settings'
    );
    await expect(page.getByTestId('order-email-templates-panel')).toHaveCount(0);

    await settingsTab.focus();
    await page.keyboard.press('ArrowRight');
    await expect(templatesTab).toBeFocused();
    await expect(templatesTab).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByTestId('order-email-templates-panel')).toBeVisible();
    await page.keyboard.press('Home');
    await expect(settingsTab).toBeFocused();
    await expect(settingsTab).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('End');
    await expect(templatesTab).toBeFocused();
    await expect(templatesTab).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('ArrowLeft');
    await expect(settingsTab).toBeFocused();
    await expect(settingsTab).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByTestId('order-email-settings-panel')).toBeVisible();

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

    await templatesTab.click();
    await expect(templatesTab).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByTestId('order-email-templates-panel')).toBeVisible();
    await page.getByLabel('Dogodek naročila').selectOption('order_submitted');

    const customerSubjectValue = 'E2E – Vaše naročilo je bilo prejeto';
    const customerBodyValue = 'E2E vsebina za stranko brez interne številke.';
    const adminSubjectValue = 'E2E – Novo naročilo';
    const adminBodyValue = 'E2E vsebina za administratorja.';
    const customerSubject = page.getByLabel('Zadeva za stranko');
    const customerBody = page.getByLabel('Vsebina za stranko');
    const adminSubject = page.getByLabel('Zadeva za administratorja');
    const adminBody = page.getByLabel('Vsebina za administratorja');

    await customerSubject.fill(customerSubjectValue);
    await customerBody.fill(customerBodyValue);
    await adminSubject.fill(adminSubjectValue);
    await adminBody.fill(adminBodyValue);
    await expect(
      page.getByRole('button', { name: 'Ponastavi privzeto predlogo za stranko' })
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Ponastavi privzeto predlogo za administratorja' })
    ).toBeVisible();

    await settingsTab.click();
    await expect(page.getByTestId('order-email-settings-panel')).toBeVisible();
    await templatesTab.click();
    await expect(customerSubject).toHaveValue(customerSubjectValue);
    await expect(customerBody).toHaveValue(customerBodyValue);
    await expect(adminSubject).toHaveValue(adminSubjectValue);
    await expect(adminBody).toHaveValue(adminBodyValue);

    let releaseDelayedSave!: () => void;
    const delayedSaveGate = new Promise<void>((resolve) => {
      releaseDelayedSave = resolve;
    });
    let signalDelayedSaveStarted!: () => void;
    const delayedSaveStarted = new Promise<void>((resolve) => {
      signalDelayedSaveStarted = resolve;
    });
    let delayNextSettingsSave = true;
    await page.route('**/api/admin/order-email-settings', async (route) => {
      if (route.request().method() !== 'PUT' || !delayNextSettingsSave) {
        await route.continue();
        return;
      }
      delayNextSettingsSave = false;
      signalDelayedSaveStarted();
      await delayedSaveGate;
      await route.continue();
    });

    await saveButton.click();
    await delayedSaveStarted;
    const customerBodyAfterSaveStarted =
      'E2E novejša vsebina, vnesena med shranjevanjem.';
    await customerBody.fill(customerBodyAfterSaveStarted);
    releaseDelayedSave();
    await expect(page.getByText('Nastavitve samodejne e-pošte so shranjene.')).toBeVisible();
    await expect(customerBody).toHaveValue(customerBodyAfterSaveStarted);
    await expect(saveButton).toBeEnabled();

    const persistedSaveResponse = page.waitForResponse((response) =>
      response.url().endsWith('/api/admin/order-email-settings') &&
      response.request().method() === 'PUT'
    );
    await saveButton.click();
    expect((await persistedSaveResponse).ok()).toBeTruthy();
    await expect(saveButton).toHaveText('Shranjeno');

    await page.reload();
    await expect(
      page.locator('input[value="e2e-order-email@example.com"]')
    ).toBeVisible();
    await expect(
      page.getByTestId('order-email-event-finished-customer')
    ).toBeChecked({ checked: !originalFinishedCustomer });

    await templatesTab.click();
    await page.getByLabel('Dogodek naročila').selectOption('order_submitted');
    await expect(page.getByLabel('Zadeva za stranko')).toHaveValue(customerSubjectValue);
    await expect(page.getByLabel('Vsebina za stranko')).toHaveValue(customerBodyAfterSaveStarted);
    await expect(page.getByLabel('Zadeva za administratorja')).toHaveValue(adminSubjectValue);
    await expect(page.getByLabel('Vsebina za administratorja')).toHaveValue(adminBodyValue);

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(settingsTab).toBeVisible();
    await expect(templatesTab).toBeVisible();
    const viewportMetrics = await page.evaluate(() => ({
      viewportWidth: window.innerWidth,
      documentWidth: Math.max(
        document.documentElement.scrollWidth,
        document.body.scrollWidth
      )
    }));
    expect(viewportMetrics.documentWidth).toBeLessThanOrEqual(
      viewportMetrics.viewportWidth + 1
    );

    const customerTemplateCard = page.getByTestId('order-email-template-customer');
    const adminTemplateCard = page.getByTestId('order-email-template-admin');
    const [customerCardBox, adminCardBox] = await Promise.all([
      customerTemplateCard.boundingBox(),
      adminTemplateCard.boundingBox()
    ]);
    if (!customerCardBox || !adminCardBox) {
      throw new Error('Email template cards must be rendered on the mobile viewport.');
    }
    expect(Math.abs(customerCardBox.x - adminCardBox.x)).toBeLessThanOrEqual(1);
    expect(adminCardBox.y).toBeGreaterThanOrEqual(
      customerCardBox.y + customerCardBox.height
    );
  } finally {
    const restoreResponse = await page.request.put('/api/admin/order-email-settings', {
      data: { config: originalConfig }
    });
    expect(restoreResponse.ok()).toBeTruthy();
  }
});
