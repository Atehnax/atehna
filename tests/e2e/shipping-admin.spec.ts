import { expect, test, type Locator, type Page } from '@playwright/test';

async function waitForShippingClient(page: Page) {
  await expect(page.getByTestId('shipping-client-surface')).toHaveAttribute(
    'data-client-ready',
    'true'
  );
}

test('Poštnina admin previews weight boundaries and an unsaved dimensional surcharge', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto('/admin/postnina');
  await waitForShippingClient(page);

  await expect(page.getByRole('heading', { name: 'Poštnina', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Poštnina', exact: true })).toBeVisible();
  const saveStatus = page.getByTestId('shipping-save-status');
  await expect(saveStatus).toHaveText('Shranjeno');
  await expect(saveStatus.locator('[aria-hidden="true"]')).toHaveClass(/bg-emerald-500/u);
  for (const heading of [
    'Osnovna poštnina po masi',
    'Dodatek za večje dimenzije',
    'Popust glede na vrednost naročila',
    'Popust za pošiljanje v več kosih',
    'Simulator poštnine'
  ]) {
    await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
  }
  const desktopLayout = await page.getByTestId('shipping-workspace-layout').evaluate((layout) => {
    const rules = layout.querySelector<HTMLElement>('[data-testid="shipping-rules-workspace"]');
    const preview = layout.querySelector<HTMLElement>('[data-testid="shipping-preview"]');
    if (!rules || !preview) throw new Error('Shipping workspace columns are missing.');
    const rulesRect = rules.getBoundingClientRect();
    const previewRect = preview.getBoundingClientRect();
    return {
      rulesRight: rulesRect.right,
      rulesTop: rulesRect.top,
      rulesWidth: rulesRect.width,
      previewLeft: previewRect.left,
      previewTop: previewRect.top,
      previewWidth: previewRect.width
    };
  });
  expect(desktopLayout.previewLeft).toBeGreaterThan(desktopLayout.rulesRight);
  expect(Math.abs(desktopLayout.previewTop - desktopLayout.rulesTop)).toBeLessThanOrEqual(1);
  expect(desktopLayout.previewWidth).toBeGreaterThanOrEqual(380);
  expect(desktopLayout.previewWidth / desktopLayout.rulesWidth).toBeGreaterThan(0.6);
  expect(desktopLayout.previewWidth / desktopLayout.rulesWidth).toBeLessThan(0.75);
  const simulatorStickyStyles = await page.getByTestId('shipping-preview').evaluate((preview) => {
    const style = getComputedStyle(preview);
    return {
      position: style.position,
      top: style.top,
      maxHeight: style.maxHeight,
      overflowY: style.overflowY
    };
  });
  expect(simulatorStickyStyles.position).toBe('sticky');
  expect(simulatorStickyStyles.top).toBe('16px');
  expect(simulatorStickyStyles.maxHeight).not.toBe('none');
  expect(simulatorStickyStyles.overflowY).toBe('auto');
  const ruleGroupGeometry = await page.getByTestId('shipping-rule-groups').evaluate((groups) => {
    const groupRects = [
      'shipping-weight-bands',
      'shipping-dimensional-rules',
      'shipping-order-value-discounts',
      'shipping-multi-piece-discounts'
    ].map((testId) => {
      const group = groups.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
      if (!group) throw new Error(`Shipping rule group ${testId} is missing.`);
      const rect = group.getBoundingClientRect();
      return { left: rect.left, top: rect.top, bottom: rect.bottom, width: rect.width };
    });
    return groupRects;
  });
  expect(Math.max(...ruleGroupGeometry.map(({ left }) => left))
    - Math.min(...ruleGroupGeometry.map(({ left }) => left))).toBeLessThanOrEqual(1);
  expect(Math.max(...ruleGroupGeometry.map(({ width }) => width))
    - Math.min(...ruleGroupGeometry.map(({ width }) => width))).toBeLessThanOrEqual(1);
  for (let index = 1; index < ruleGroupGeometry.length; index += 1) {
    expect(ruleGroupGeometry[index].top)
      .toBeGreaterThanOrEqual(ruleGroupGeometry[index - 1].bottom);
  }
  const ruleTableColumnGeometry = await page.getByTestId('shipping-rule-groups').evaluate(
    (groups) => [
      'shipping-weight-bands',
      'shipping-dimensional-rules',
      'shipping-order-value-discounts',
      'shipping-multi-piece-discounts'
    ].map((testId) => {
      const section = groups.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
      if (!section) throw new Error(`Shipping rule group ${testId} is missing.`);
      const headers = [...section.querySelectorAll<HTMLElement>('thead th')];
      return headers.map((header) => {
        const rect = header.getBoundingClientRect();
        return { left: rect.left, right: rect.right };
      });
    })
  );
  expect(ruleTableColumnGeometry.every((columns) => columns.length === 5)).toBe(true);
  for (let columnIndex = 0; columnIndex < 5; columnIndex += 1) {
    const columnStarts = ruleTableColumnGeometry.map((columns) => columns[columnIndex].left);
    const columnEnds = ruleTableColumnGeometry.map((columns) => columns[columnIndex].right);
    expect(Math.max(...columnStarts) - Math.min(...columnStarts)).toBeLessThanOrEqual(1);
    expect(Math.max(...columnEnds) - Math.min(...columnEnds)).toBeLessThanOrEqual(1);
  }
  const multiPieceBottomSpacing = await page
    .getByTestId('shipping-multi-piece-discounts')
    .evaluate((section) => {
      const lastRow = section.querySelector<HTMLElement>('tbody tr:last-child');
      if (!lastRow) throw new Error('Multi-piece threshold row is missing.');
      return section.getBoundingClientRect().bottom - lastRow.getBoundingClientRect().bottom;
    });
  expect(multiPieceBottomSpacing).toBeGreaterThanOrEqual(14);
  await expect(page.getByText(
    'Če ustreza več pravil, se uporabi prvo aktivno pravilo v tabeli.',
    { exact: true }
  )).toBeVisible();

  const weightBands = page.getByTestId('shipping-weight-bands');
  await expect(
    weightBands.getByLabel('Do 5 kg: matematično območje mase v gramih')
  ).toHaveValue('(0, 5000)');
  await expect(
    weightBands.getByLabel('Od 5 kg do 30 kg: matematično območje mase v gramih')
  ).toHaveValue('[5000, 30000]');

  const preview = page.getByTestId('shipping-preview');
  await expect(preview.getByLabel('Vrednost blaga z DDV')).toHaveValue('100');
  await expect(preview.getByLabel('Število paketov')).toHaveValue('1');
  await expect(preview.getByText('Do 5 kg', { exact: false })).toBeVisible();
  await preview.getByLabel('Skupna masa').fill('5000');
  await expect(preview.getByText('Od 5 kg do 30 kg', { exact: false })).toBeVisible();

  const dimensionalRules = page.getByTestId('shipping-dimensional-rules');
  await expect(
    dimensionalRules.getByLabel('Večji artikel: operator primerjave')
  ).toHaveValue('>');
  const surchargeType = dimensionalRules.getByLabel('Večji artikel: vrsta dodatka');
  await expect(surchargeType).toHaveValue('fixed');
  await expect(surchargeType.locator('option:checked')).toHaveText('€');
  await dimensionalRules.getByLabel('Večji artikel: vrednost dodatka v evrih').fill('5');
  await expect(saveStatus).toHaveText('Neshranjeno');
  await expect(saveStatus.locator('[aria-hidden="true"]')).toHaveClass(/bg-amber-500/u);
  const dimensionalToggle = dimensionalRules.getByLabel('Večji artikel: aktivno');
  await expect(dimensionalToggle).toBeEnabled();
  await dimensionalToggle.click();
  await preview.getByLabel('Največja posamezna dimenzija').fill('1001');
  await expect(
    preview.getByTestId('shipping-preview-calculation-breakdown')
  ).toContainText('S = 10,00 € + 5,00 € = 15,00 €');
  await surchargeType.selectOption('percentage');
  await expect(surchargeType.locator('option:checked')).toHaveText('%');
  const percentageSurcharge = dimensionalRules.getByLabel(
    'Večji artikel: vrednost dodatka v odstotkih'
  );
  await expect(percentageSurcharge).toHaveValue('');
  await expect(dimensionalToggle).toBeDisabled();
  await percentageSurcharge.fill('5');
  await expect(dimensionalToggle).toBeEnabled();
  await expect(dimensionalToggle).toHaveAttribute('aria-checked', 'false');
  await dimensionalToggle.click();
  await expect(dimensionalToggle).toHaveAttribute('aria-checked', 'true');
  await preview.getByLabel('Največja posamezna dimenzija').fill('1000');
  await expect(preview.getByText('Brez dodatka', { exact: true })).toBeVisible();
  await preview.getByLabel('Največja posamezna dimenzija').fill('1001');
  await expect(preview.getByText('Večji artikel ·', { exact: false })).toBeVisible();
  await expect(
    preview.getByTestId('shipping-preview-calculation-breakdown')
  ).toContainText('S = 10,00 € + 0,50 € = 10,50 €');
  await expect(
    preview.getByTestId('shipping-preview-calculation-breakdown')
  ).toContainText('Sₙ = 1 × 10,50 € = 10,50 €');
  await dimensionalRules
    .getByLabel('Večji artikel: operator primerjave')
    .selectOption('>=');
  await preview.getByLabel('Največja posamezna dimenzija').fill('1000');
  await expect(preview.getByText('Večji artikel ·', { exact: false })).toBeVisible();

  const multiPieceDiscounts = page.getByTestId('shipping-multi-piece-discounts');
  await expect(
    multiPieceDiscounts.getByLabel('Večkosovni prag 1: naziv')
  ).toHaveValue('Od 2 paketov');
  await expect(
    multiPieceDiscounts.getByLabel('Od 2 paketov: najmanjše število paketov')
  ).toHaveValue('2');
  await expect(
    multiPieceDiscounts.getByLabel('Od 2 paketov: vrsta popusta')
  ).toHaveValue('percentage');
  await expect(
    multiPieceDiscounts.getByLabel('Od 2 paketov: vrednost popusta na paket v odstotkih')
  ).toHaveValue('50');
  await preview.getByLabel('Število paketov').fill('2');
  await expect(
    preview.getByTestId('shipping-preview-calculation-breakdown')
  ).toContainText('Sₙ = 2 × 10,50 € × (1 − 50 / 100) = 10,50 €');

  const orderValueDiscounts = page.getByTestId('shipping-order-value-discounts');
  await orderValueDiscounts.getByRole('button', { name: 'Dodaj prag' }).click();
  await orderValueDiscounts.getByLabel('Vrednostni prag 1: naziv').fill('Nad 50 evrov');
  const orderValueComparison = orderValueDiscounts
    .getByLabel('Nad 50 evrov: operator primerjave vrednosti blaga z DDV');
  await expect(orderValueComparison).toHaveValue('>=');
  await expect(orderValueComparison.locator('option:checked')).toHaveText('≥');
  await orderValueDiscounts
    .getByLabel('Nad 50 evrov: mejna vrednost blaga z DDV v evrih')
    .fill('50');
  await orderValueDiscounts
    .getByLabel('Nad 50 evrov: vrednost popusta v odstotkih')
    .fill('10');
  await orderValueDiscounts.getByLabel('Nad 50 evrov: aktivno').click();
  await expect(
    preview.getByTestId('shipping-preview-calculation-breakdown')
  ).toContainText('Sₖ = max(0, 10,50 € − 1,05 €) = 9,45 €');
  await preview.getByLabel('Vrednost blaga z DDV').fill('50');
  await expect(preview.getByText('Nad 50 evrov · 10 %', { exact: false })).toBeVisible();
  await orderValueComparison.selectOption('>');
  await expect(preview.getByText('Nad 50 evrov · 10 %', { exact: false })).toHaveCount(0);
  await preview.getByLabel('Vrednost blaga z DDV').fill('50.01');
  await expect(preview.getByText('Nad 50 evrov · 10 %', { exact: false })).toBeVisible();
  await preview.getByLabel('Vrednost blaga z DDV').fill('100');

  await orderValueDiscounts.getByRole('button', { name: 'Dodaj prag' }).click();
  await orderValueDiscounts.getByLabel('Vrednostni prag 2: naziv').fill('Nad 80 evrov');
  await orderValueDiscounts
    .getByLabel('Nad 80 evrov: mejna vrednost blaga z DDV v evrih')
    .fill('80');
  await orderValueDiscounts
    .getByLabel('Nad 80 evrov: vrednost popusta v odstotkih')
    .fill('20');
  await orderValueDiscounts.getByLabel('Nad 80 evrov: aktivno').click();
  await expect(preview.getByText('Nad 80 evrov · 20 %', { exact: false })).toBeVisible();
  await expect(
    preview.getByTestId('shipping-preview-calculation-breakdown')
  ).toContainText('Sₖ = max(0, 10,50 € − 2,10 €) = 8,40 €');
  await orderValueDiscounts.getByRole('button', { name: 'Odstrani Nad 80 evrov' }).click();
  await expect(orderValueDiscounts.getByLabel('Vrednostni prag 2: naziv')).toHaveCount(0);

  await preview.getByLabel('Vrednost blaga z DDV').fill('0');
  await multiPieceDiscounts.getByRole('button', { name: 'Dodaj prag' }).click();
  await multiPieceDiscounts
    .getByLabel('Večkosovni prag 2: naziv')
    .fill('Od 3 paketov');
  await multiPieceDiscounts
    .getByLabel('Od 3 paketov: vrsta popusta')
    .selectOption('fixed');
  await multiPieceDiscounts
    .getByLabel('Od 3 paketov: vrednost popusta na paket v evrih')
    .fill('2');
  await multiPieceDiscounts.getByLabel('Od 3 paketov: aktivno').click();
  await preview.getByLabel('Število paketov').fill('3');
  await expect(
    preview.getByTestId('shipping-preview-calculation-breakdown')
  ).toContainText('Sₙ = 3 × max(0, 10,50 € − 2,00 €) = 25,50 €');
  await multiPieceDiscounts
    .getByRole('button', { name: 'Odstrani Od 3 paketov' })
    .click();
  await expect(
    multiPieceDiscounts.getByLabel('Od 3 paketov: najmanjše število paketov')
  ).toHaveCount(0);
});

test('Poštnina numeric inputs preserve an editable blank and recover after refill', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto('/admin/postnina');
  await waitForShippingClient(page);

  const expectBlankUntilRefill = async (input: Locator) => {
    const originalValue = await input.inputValue();
    expect(originalValue).not.toBe('');

    await input.fill('');
    await expect(input).toHaveValue('');
    await input.blur();
    await expect(input).toHaveValue('');

    await input.fill(originalValue);
    await expect(input).toHaveValue(originalValue);
  };

  await expectBlankUntilRefill(
    page.getByTestId('shipping-weight-bands').getByLabel('Do 5 kg: cena v evrih')
  );
  await expectBlankUntilRefill(
    page
      .getByTestId('shipping-dimensional-rules')
      .getByLabel('Večji artikel: prag v milimetrih')
  );
  const multiPieceDiscounts = page.getByTestId('shipping-multi-piece-discounts');
  await expectBlankUntilRefill(
    multiPieceDiscounts.getByLabel('Od 2 paketov: najmanjše število paketov')
  );
  await expectBlankUntilRefill(
    multiPieceDiscounts.getByLabel(
      'Od 2 paketov: vrednost popusta na paket v odstotkih'
    )
  );
  await expect(page.getByTestId('shipping-save-status')).toHaveText('Shranjeno');

  const preview = page.getByTestId('shipping-preview');
  const merchandiseSubtotal = preview.getByLabel('Vrednost blaga z DDV');
  await merchandiseSubtotal.fill('');
  await expect(merchandiseSubtotal).toHaveValue('');
  await expect(preview.getByTestId('shipping-preview-calculated-result')).toBeVisible();
  await merchandiseSubtotal.fill('100');
  await expect(merchandiseSubtotal).toHaveValue('100');
  await expect(preview.getByTestId('shipping-preview-calculation-breakdown')).toBeVisible();

  const parcelCount = preview.getByLabel('Število paketov');
  await parcelCount.fill('');
  await expect(parcelCount).toHaveValue('');
  await expect(preview.getByText('Ročna ponudba', { exact: true })).toBeVisible();
  await expect(preview).toContainText('Število skupaj oddanih paketov mora biti celo število');

  await parcelCount.fill('1');
  await expect(parcelCount).toHaveValue('1');
  await expect(preview.getByTestId('shipping-preview-calculated-result')).toBeVisible();
  await expect(preview.getByTestId('shipping-preview-calculation-breakdown')).toBeVisible();
});

test('Poštnina admin stacks the consolidated rules and preview for tablet and mobile widths', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 900 });
  await page.goto('/admin/postnina');
  await waitForShippingClient(page);

  await expect(page.getByRole('heading', { name: 'Poštnina', exact: true })).toBeVisible();
  await expect(page.getByTestId('shipping-weight-bands')).toBeVisible();
  await expect(page.getByTestId('shipping-dimensional-rules')).toBeVisible();
  await expect(page.getByTestId('shipping-order-value-discounts')).toBeVisible();
  await expect(page.getByTestId('shipping-multi-piece-discounts')).toBeVisible();
  await expect(page.getByTestId('shipping-draft-rules')).toHaveCount(0);
  await expect(page.getByTestId('shipping-preview')).toBeVisible();

  const tabletLayout = await page.getByTestId('shipping-workspace-layout').evaluate((layout) => {
    const rules = layout.querySelector<HTMLElement>('[data-testid="shipping-rules-workspace"]');
    const preview = layout.querySelector<HTMLElement>('[data-testid="shipping-preview"]');
    if (!rules || !preview) throw new Error('Shipping workspace stack is missing.');
    const rulesRect = rules.getBoundingClientRect();
    const previewRect = preview.getBoundingClientRect();
    return {
      rulesLeft: rulesRect.left,
      rulesWidth: rulesRect.width,
      rulesBottom: rulesRect.bottom,
      previewLeft: previewRect.left,
      previewTop: previewRect.top,
      previewWidth: previewRect.width
    };
  });
  expect(tabletLayout.previewTop).toBeGreaterThan(tabletLayout.rulesBottom);
  expect(Math.abs(tabletLayout.previewLeft - tabletLayout.rulesLeft)).toBeLessThanOrEqual(1);
  expect(Math.abs(tabletLayout.previewWidth - tabletLayout.rulesWidth)).toBeLessThanOrEqual(1);

  await page.setViewportSize({ width: 390, height: 844 });

  const viewportContract = await page.evaluate(() => ({
    viewportWidth: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth,
    ruleTablesScrollable: [
      'shipping-weight-bands',
      'shipping-dimensional-rules',
      'shipping-order-value-discounts',
      'shipping-multi-piece-discounts'
    ].every((testId) => {
      const scroller = document.querySelector(`[data-testid="${testId}"] .overflow-x-auto`);
      return (scroller?.scrollWidth ?? 0) > (scroller?.clientWidth ?? 0);
    })
  }));
  expect(viewportContract.documentWidth).toBeLessThanOrEqual(viewportContract.viewportWidth);
  expect(viewportContract.ruleTablesScrollable).toBe(true);
});
