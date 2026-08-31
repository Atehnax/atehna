import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { assertAuthenticatedAdmin } from './support/auth';

test.beforeEach(async ({ request }) => {
  await assertAuthenticatedAdmin(request);
});

test('admin can create and remove a test quote request from the quotes table', async ({
  page,
  request
}) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1440, height: 1000 });

  const token = randomUUID().slice(0, 8);
  const organizationName = `E2E testno povpraševanje ${token}`;
  const contactName = `E2E skrbnik ${token}`;
  const email = `quote-${token}@example.test`;
  const reference = `E2E-TEST-${token}`;
  let quoteRequestId: number | null = null;
  let completed = false;
  const readAnalyticsRequestCount = async () => {
    const response = await request.get('/api/admin/analytics/quotes?range=max');
    expect(response.ok()).toBe(true);
    const payload = await response.json() as {
      summary?: { requests?: unknown };
    };
    const count = Number(payload.summary?.requests);
    expect(Number.isSafeInteger(count) && count >= 0).toBe(true);
    return count;
  };
  const baselineRequestCount = await readAnalyticsRequestCount();

  try {
    await page.goto('/admin/orders?view=quotes');
    await page.waitForLoadState('networkidle');
    const createButton = page.getByTestId('quote-table-create-request');
    await expect(createButton).toBeEnabled();
    await createButton.click();

    const createDialog = page.getByRole('dialog');
    await expect(createDialog).toContainText('Novo povpraševanje');
    await createDialog.getByLabel('Naziv organizacije', { exact: true }).fill(organizationName);
    await createDialog.getByLabel('Kontaktna oseba', { exact: true }).fill(contactName);
    await createDialog.getByLabel('E-pošta', { exact: true }).fill(email);
    await createDialog.getByLabel('Naslov', { exact: true }).fill('Testna ulica 1');
    await createDialog.getByLabel('Poštna številka', { exact: true }).fill('1000');
    await createDialog.getByLabel('Kraj', { exact: true }).fill('Ljubljana');
    await createDialog.getByLabel('Referenca', { exact: true }).fill(reference);
    await createDialog
      .getByLabel('Opis povpraševanja')
      .fill(`Samodejni E2E preizkus ${token}; zapis se po preverjanju odstrani.`);

    const intakeSource = createDialog.getByRole('button', {
      name: 'Vir vnosa'
    });
    await intakeSource.click();
    await page.getByRole('option', { name: 'Testni vnos', exact: true }).click();
    await expect(intakeSource).toContainText('Testni vnos');

    const requestedItem = createDialog.getByLabel('Zahtevani artikel');
    await requestedItem.click();
    const catalogList = page.getByRole('listbox', {
      name: 'Kataloški artikli'
    });
    await expect(catalogList).toBeVisible({ timeout: 10_000 });
    await catalogList.getByRole('option').first().click();
    await expect(createDialog).toContainText('Kataloški artikel');
    await createDialog.getByLabel('Količina zahtevanega artikla').fill('2');

    const createResponsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST'
        && response.url().endsWith('/api/admin/quote-requests')
    );
    await createDialog.getByTestId('quote-create-submit').click();
    const createResponse = await createResponsePromise;
    expect(createResponse.status()).toBe(201);

    const submitted = createResponse.request().postDataJSON() as {
      intakeSource?: unknown;
      requestedItems?: Array<{
        catalogItemId?: unknown;
        catalogVariantId?: unknown;
        sku?: unknown;
      }>;
    };
    expect(submitted.intakeSource).toBe('admin_testing');
    expect(submitted.requestedItems).toHaveLength(1);
    expect(Number.isSafeInteger(submitted.requestedItems?.[0]?.catalogItemId)).toBe(true);
    expect(Number.isSafeInteger(submitted.requestedItems?.[0]?.catalogVariantId)).toBe(true);
    expect(submitted.requestedItems?.[0]?.sku).toEqual(expect.any(String));

    const created = await createResponse.json() as {
      quoteRequestId?: unknown;
      requestNumber?: unknown;
    };
    quoteRequestId = Number(created.quoteRequestId);
    expect(Number.isSafeInteger(quoteRequestId) && quoteRequestId > 0).toBe(true);
    expect(created.requestNumber).toEqual(expect.any(String));
    const requestSequenceMatch = /-(\d{6})$/u.exec(String(created.requestNumber));
    expect(requestSequenceMatch).not.toBeNull();
    const requestSequence = Number(requestSequenceMatch?.[1]);
    expect(Number.isSafeInteger(requestSequence) && requestSequence >= 0).toBe(true);
    const nonMatchingRequestSequence = requestSequence === 999_999
      ? requestSequence - 1
      : requestSequence + 1;
    await expect.poll(readAnalyticsRequestCount).toBe(baselineRequestCount + 1);

    await expect(page).toHaveURL(
      new RegExp(`/admin/orders/quotes/${quoteRequestId}$`, 'u')
    );
    await page.getByTestId('quote-header-status-edit').click();
    await expect(page.getByRole('textbox', {
      name: 'Naziv organizacije',
      exact: true
    })).toHaveValue(organizationName);

    const filteredListUrl = `/admin/orders?view=quotes&q=${encodeURIComponent(organizationName)}`;
    await page.goto(filteredListUrl);
    await page.waitForLoadState('networkidle');
    const createdRow = page.getByTestId(`quote-table-row-${quoteRequestId}`);
    await expect(createdRow).toBeVisible();
    await expect(createdRow).toContainText(organizationName);
    const address = page.getByTestId(
      `quote-table-address-${quoteRequestId}`
    );
    await expect(address).toHaveText('Testna ulica 1, 1000 Ljubljana');
    await expect(address).toHaveAttribute(
      'title',
      'Testna ulica 1, 1000 Ljubljana'
    );
    await expect(
      page.getByTestId(`quote-table-type-${quoteRequestId}`)
    ).toHaveText('Podjetje');

    const typeFilter = page.getByRole('button', { name: 'Filtriraj Tip' });
    await typeFilter.click();
    await page.getByRole('menuitem', { name: 'Podjetje' }).click();
    await expect
      .poll(() => new URL(page.url()).searchParams.get('quoteCustomerType'))
      .toBe('company');
    expect(new URL(page.url()).searchParams.get('q')).toBe(organizationName);
    await expect(createdRow).toBeVisible();

    await typeFilter.click();
    await page.getByRole('menuitem', { name: 'Fiz. oseba' }).click();
    await expect
      .poll(() => new URL(page.url()).searchParams.get('quoteCustomerType'))
      .toBe('individual');
    await expect(createdRow).toHaveCount(0);
    await expect(page.getByText('Ni zadetkov za izbrane filtre.')).toBeVisible();

    await typeFilter.click();
    await page.getByRole('menuitem', { name: 'Podjetje' }).click();
    await expect(createdRow).toBeVisible();
    await page
      .getByRole('button', { name: 'Odstrani filter Tip Podjetje' })
      .click();
    await expect
      .poll(() => new URL(page.url()).searchParams.get('quoteCustomerType'))
      .toBeNull();
    expect(new URL(page.url()).searchParams.get('q')).toBe(organizationName);
    await expect(createdRow).toBeVisible();

    const requestNumberFilter = page.getByRole('button', {
      name: 'Filtriraj P/P'
    });
    await requestNumberFilter.click();
    await page.getByLabel('Od', { exact: true }).fill(String(requestSequence));
    await page.getByLabel('Do', { exact: true }).fill(String(requestSequence));
    await page.getByRole('button', { name: 'Potrdi', exact: true }).click();
    await expect
      .poll(() => new URL(page.url()).searchParams.get('quoteMinRequestNumber'))
      .toBe(String(requestSequence));
    await expect
      .poll(() => new URL(page.url()).searchParams.get('quoteMaxRequestNumber'))
      .toBe(String(requestSequence));
    expect(new URL(page.url()).searchParams.get('q')).toBe(organizationName);
    await expect(createdRow).toBeVisible();

    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect(page.getByTestId(`quote-table-row-${quoteRequestId}`)).toBeVisible();
    await expect(
      page.getByRole('button', {
        name: new RegExp(`^Odstrani filter P/P #${requestSequence} – #${requestSequence}$`, 'u')
      })
    ).toBeVisible();

    await requestNumberFilter.click();
    await page.getByLabel('Od', { exact: true }).fill(String(nonMatchingRequestSequence));
    await page.getByLabel('Do', { exact: true }).fill(String(nonMatchingRequestSequence));
    await page.getByRole('button', { name: 'Potrdi', exact: true }).click();
    await expect(page.getByTestId(`quote-table-row-${quoteRequestId}`)).toHaveCount(0);
    await expect(page.getByText('Ni zadetkov za izbrane filtre.')).toBeVisible();

    await requestNumberFilter.click();
    await page.getByRole('button', { name: 'Ponastavi', exact: true }).click();
    await expect
      .poll(() => new URL(page.url()).searchParams.get('quoteMinRequestNumber'))
      .toBeNull();
    await expect
      .poll(() => new URL(page.url()).searchParams.get('quoteMaxRequestNumber'))
      .toBeNull();
    expect(new URL(page.url()).searchParams.get('q')).toBe(organizationName);
    await expect(page.getByTestId(`quote-table-row-${quoteRequestId}`)).toBeVisible();

    const dateFilter = page.getByRole('button', { name: 'Filtriraj Datum' });
    await dateFilter.click();
    await page.getByLabel('Od', { exact: true }).fill('2000-01-01');
    await page.getByLabel('Do', { exact: true }).fill('2099-12-31');
    await page.getByRole('button', { name: 'Potrdi', exact: true }).click();
    await expect
      .poll(() => new URL(page.url()).searchParams.get('quoteFrom'))
      .toBe('2000-01-01');
    await expect
      .poll(() => new URL(page.url()).searchParams.get('quoteTo'))
      .toBe('2099-12-31');
    expect(new URL(page.url()).searchParams.get('q')).toBe(organizationName);
    await expect(createdRow).toBeVisible();

    await dateFilter.click();
    await page.getByLabel('Od', { exact: true }).fill('2000-01-01');
    await page.getByLabel('Do', { exact: true }).fill('2000-01-02');
    await page.getByRole('button', { name: 'Potrdi', exact: true }).click();
    await expect(createdRow).toHaveCount(0);
    await expect(page.getByText('Ni zadetkov za izbrane filtre.')).toBeVisible();
    await page
      .getByRole('button', { name: /^Odstrani filter Datum /u })
      .click();
    await expect
      .poll(() => new URL(page.url()).searchParams.get('quoteFrom'))
      .toBeNull();
    await expect
      .poll(() => new URL(page.url()).searchParams.get('quoteTo'))
      .toBeNull();
    expect(new URL(page.url()).searchParams.get('q')).toBe(organizationName);
    await expect(createdRow).toBeVisible();

    const requestLink = createdRow.getByRole('link').first();
    await expect(requestLink).toHaveAttribute(
      'href',
      `/admin/orders/quotes/${quoteRequestId}`
    );
    await requestLink.click();
    await expect(page).toHaveURL(
      new RegExp(`/admin/orders/quotes/${quoteRequestId}$`, 'u')
    );
    await page.getByTestId('quote-header-status-edit').click();
    await expect(page.getByRole('textbox', {
      name: 'Naziv organizacije',
      exact: true
    })).toHaveValue(organizationName);

    await page.goto(filteredListUrl);
    await page.waitForLoadState('networkidle');
    const selection = page.getByTestId(`quote-table-select-${quoteRequestId}`);
    await selection.click();
    await expect(selection).toBeChecked();

    const deleteSelected = page.getByTestId('quote-table-delete-selected');
    await expect(deleteSelected).toBeEnabled();
    await deleteSelected.click();

    const deleteDialog = page.getByRole('dialog');
    await expect(deleteDialog).toContainText('Izbris povpraševanja');
    const deleteResponsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === 'DELETE'
        && response.url().endsWith(`/api/admin/quote-requests/${quoteRequestId}`)
    );
    await deleteDialog.getByRole('button', {
      name: 'Izbriši',
      exact: true
    }).click();
    const deleteResponse = await deleteResponsePromise;
    expect(deleteResponse.ok()).toBe(true);
    await expect(page.getByTestId(`quote-table-row-${quoteRequestId}`)).toHaveCount(0, {
      timeout: 10_000
    });
    await expect.poll(readAnalyticsRequestCount).toBe(baselineRequestCount);

    completed = true;
  } finally {
    if (quoteRequestId !== null && !completed) {
      const cleanupResponse = await request.delete(
        `/api/admin/quote-requests/${quoteRequestId}`,
        {
          data: {
            reason: `E2E cleanup after failed manual-management test ${token}`
          }
        }
      );
      if (!cleanupResponse.ok()) {
        throw new Error(
          `[e2e-cleanup] Could not logically remove quote request ${quoteRequestId}; status ${cleanupResponse.status()}.`
        );
      }
    }
  }
});
