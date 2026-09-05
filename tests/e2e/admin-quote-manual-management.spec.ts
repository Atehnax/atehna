import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { assertAuthenticatedAdmin } from './support/auth';

test.beforeEach(async ({ request }) => {
  await assertAuthenticatedAdmin(request);
});

test('admin can create a draft quote directly and remove it from the quotes table', async ({
  page,
  request
}) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1440, height: 1000 });

  const token = randomUUID().slice(0, 8);
  const organizationName = `E2E testno povpraševanje ${token}`;
  const contactName = `E2E skrbnik ${token}`;
  const email = `quote-${token}@example.test`;
  let quoteRequestId: number | null = null;
  let completed = false;
  const readIssuedOpportunityCount = async () => {
    const response = await request.get('/api/admin/analytics/business?view=ponudbe&range=90D');
    expect(response.ok()).toBe(true);
    const payload = await response.json() as {
      quotes: { mature: { total: number }; immature: number };
    };
    const count = Number(payload.quotes.mature.total + payload.quotes.immature);
    expect(Number.isSafeInteger(count) && count >= 0).toBe(true);
    return count;
  };
  const baselineIssuedCount = await readIssuedOpportunityCount();

  try {
    await page.goto('/admin/orders?view=quotes');
    await page.waitForLoadState('networkidle');
    const createButton = page.getByTestId('quote-table-create-request');
    await expect(createButton).toBeEnabled();

    const createResponsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST'
        && response.url().endsWith('/api/admin/quote-requests')
    );
    await createButton.click();
    const createResponse = await createResponsePromise;
    expect(createResponse.status()).toBe(201);
    expect(createResponse.request().postDataJSON()).toEqual({ mode: 'draft' });

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
    await expect.poll(readIssuedOpportunityCount).toBe(baselineIssuedCount);

    await expect(page).toHaveURL(
      new RegExp(`/admin/orders/quotes/${quoteRequestId}$`, 'u')
    );
    await expect(page.getByRole('dialog')).toHaveCount(0);

    const requestCard = page.getByTestId('quote-request-details-card');
    await requestCard
      .getByRole('button', { name: 'Uredi podatke povpraševanja' })
      .click();
    await requestCard.getByRole('button', { name: 'Tip naročnika' }).click();
    await page.getByRole('option', { name: 'Podjetje', exact: true }).click();
    await requestCard.getByLabel('Naziv', { exact: true }).fill(organizationName);
    await requestCard.getByLabel('Kontaktna oseba', { exact: true }).fill(contactName);
    await requestCard.getByLabel('Email', { exact: true }).fill(email);
    await requestCard.getByLabel('Naslov', { exact: true }).fill('Testna ulica 1');
    await requestCard.getByLabel('Poštna številka', { exact: true }).fill('1000');
    await requestCard.getByLabel('Kraj', { exact: true }).fill('Ljubljana');
    await expect(requestCard.getByLabel('Referenca', { exact: true })).toHaveCount(0);
    await requestCard
      .getByLabel('Sporočilo stranke', { exact: true })
      .fill(`Samodejni E2E preizkus ${token}; zapis se po preverjanju odstrani.`);

    const detailsResponsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === 'PUT'
        && response.url().endsWith(`/api/admin/quote-requests/${quoteRequestId}/details`)
    );
    await page.getByRole('button', { name: 'Shrani', exact: true }).click();
    const detailsResponse = await detailsResponsePromise;
    expect(detailsResponse.ok()).toBe(true);
    expect(detailsResponse.request().postDataJSON().reference).toBe('');
    await expect(requestCard.getByLabel('Naziv', { exact: true })).toHaveCount(0);
    await expect(requestCard).toContainText(organizationName);

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
      name: 'Filtriraj po internem zaporedju'
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
    await expect(page.getByTestId('quote-request-details-card')).toContainText(
      organizationName
    );

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
    await expect.poll(readIssuedOpportunityCount).toBe(baselineIssuedCount);

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
