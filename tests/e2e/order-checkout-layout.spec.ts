import { expect, test, type Locator, type Page } from '@playwright/test';

const CART_STORAGE_KEY = 'atehna-cart-v3';

const cartItem = {
  lineId: 'checkout-layout-product::41001::',
  sku: 'CHECKOUT-LAYOUT-001',
  name: 'Preizkusni artikel',
  productId: 'checkout-layout-product',
  productSlug: 'preizkusni-artikel',
  productHref: '/products/preizkus/items/preizkusni-artikel',
  imageUrl: null,
  imageAlt: 'Preizkusni artikel',
  variant: {
    id: 41001,
    name: '100 × 100 mm',
    sku: 'CHECKOUT-LAYOUT-001',
    options: [
      {
        axisId: 'dimensions',
        axisName: 'Dimenzije',
        valueId: '100x100',
        valueLabel: '100 × 100 mm'
      }
    ]
  },
  unit: 'kos',
  unitPrice: 10,
  pricing: {
    currency: 'EUR',
    taxRate: 0.22,
    baseUnitNet: 10,
    discountPct: 0,
    unitNet: 10,
    estimatedUnitGross: 12.2,
    quotedUnitGross: 12.2
  },
  quantity: 1,
  reconciliation: {
    status: 'valid'
  }
} as const;

const quote = {
  quoteFingerprint: `order-quote-v1:${'1'.repeat(64)}`,
  shippingConfigurationVersion: 1,
  items: [
    {
      variantId: 41001,
      productId: 410,
      productSlug: 'preizkusni-artikel',
      productName: 'Preizkusni artikel',
      variantName: '100 × 100 mm',
      sku: 'CHECKOUT-LAYOUT-001',
      unit: 'kos',
      quantity: 1,
      minOrder: 1,
      availableStock: 25,
      imageUrl: null,
      attributes: {},
      baseUnitNet: 10,
      discountPct: 0,
      unitNet: 10,
      lineNet: 10,
      lineTax: 2.2,
      lineGross: 12.2,
      taxRate: 0.22
    }
  ],
  totals: {
    net: 10,
    tax: 2.2,
    shipping: 3,
    gross: 15.2,
    currency: 'EUR'
  },
  shipping: {
    status: 'calculated',
    source: 'automatic',
    calculationVersion: 'shipping-v2',
    configurationVersion: 1,
    items: [
      {
        productId: '410',
        variantId: '41001',
        sku: 'CHECKOUT-LAYOUT-001',
        name: 'Preizkusni artikel',
        quantity: 1,
        weightGrams: 1_000,
        lengthMm: 100,
        widthMm: 100,
        heightMm: 10
      }
    ],
    combinedWeightGrams: 1_000,
    largestDimensionMm: 100,
    triggeringItem: null,
    basePriceCents: 300,
    surchargeAmountCents: 0,
    automaticAmountCents: 300,
    finalAmountCents: 300,
    matchedWeightBand: {
      id: 'under-5000',
      name: 'Do 5 kg',
      minWeightGrams: 1,
      maxWeightGrams: 4_999,
      priceCents: 300,
      enabled: true,
      position: 0
    },
    matchedDimensionalRule: null,
    manualOverride: null
  }
} as const;

async function seedCheckout(page: Page) {
  await page.route('**/api/orders/estimate', async (route) => {
    expect(route.request().method()).toBe('POST');
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(quote)
    });
  });

  await page.addInitScript(
    ({ storageKey, persistedCart }) => {
      window.localStorage.setItem(storageKey, persistedCart);
    },
    {
      storageKey: CART_STORAGE_KEY,
      persistedCart: JSON.stringify({
        state: { items: [cartItem] },
        version: 0
      })
    }
  );
}

type RemoveActionMetrics = {
  buttonHeight: number;
  buttonWidth: number;
  iconHeight: number;
  iconWidth: number;
};

async function readRemoveActionColors(removeButton: Locator) {
  return removeButton.evaluate((button) => {
    const style = getComputedStyle(button);
    const theme =
      button.closest<HTMLElement>('[data-storefront-theme]') ??
      document.documentElement;
    const resolveColor = (variableName: string) => {
      const probe = document.createElement('span');
      probe.style.color = `var(${variableName})`;
      probe.style.display = 'none';
      theme.append(probe);
      const resolved = getComputedStyle(probe).color;
      probe.remove();
      return resolved;
    };

    return {
      backgroundColor: style.backgroundColor,
      borderColor: style.borderColor,
      color: style.color,
      focused: document.activeElement === button,
      focusVisible: button.matches(':focus-visible'),
      themeDanger: resolveColor('--site-color-danger'),
      themeNeutralBorder: resolveColor('--site-border-color'),
      themeNeutralText: resolveColor('--site-color-text-muted')
    };
  });
}

async function waitForRemoveActionTransitions(removeButton: Locator) {
  await removeButton.evaluate(async (button) => {
    // Force the newly applied interaction state to resolve before collecting
    // its CSS transitions, then wait for their settled computed values.
    void getComputedStyle(button).color;
    await Promise.all(
      button
        .getAnimations({ subtree: true })
        .map((animation) => animation.finished.catch(() => undefined))
    );
  });
}

async function expectAdminStyleRemoveAction(
  page: Page,
  removeButton: Locator
): Promise<RemoveActionMetrics> {
  await expect(removeButton).toBeVisible();
  await expect(removeButton).toHaveAccessibleName('Odstrani Preizkusni artikel');
  await expect(removeButton).toHaveAttribute('type', 'button');
  await expect(removeButton).toHaveAttribute('data-testid', 'cart-line-remove-item');

  const metrics = await removeButton.evaluate((button) => {
    const buttonBox = button.getBoundingClientRect();
    const icon = button.querySelector('svg');
    const iconBox = icon?.getBoundingClientRect();

    return {
      buttonWidth: buttonBox.width,
      buttonHeight: buttonBox.height,
      iconWidth: iconBox?.width ?? 0,
      iconHeight: iconBox?.height ?? 0,
      iconViewBox: icon?.getAttribute('viewBox'),
      iconFill: icon?.getAttribute('fill'),
      iconStroke: icon?.getAttribute('stroke')
    };
  });

  expect(
    metrics.buttonWidth,
    'the checkout remove action should be slightly smaller than its former 40px size'
  ).toBeGreaterThanOrEqual(35);
  expect(metrics.buttonWidth).toBeLessThanOrEqual(37);
  expect(metrics.buttonHeight).toBeGreaterThanOrEqual(35);
  expect(metrics.buttonHeight).toBeLessThanOrEqual(37);
  expect(
    metrics.iconWidth,
    'the canonical checkout trash glyph should stay proportional inside the smaller action'
  ).toBeGreaterThanOrEqual(15);
  expect(metrics.iconWidth).toBeLessThanOrEqual(17);
  expect(metrics.iconHeight).toBeGreaterThanOrEqual(15);
  expect(metrics.iconHeight).toBeLessThanOrEqual(17);
  expect(metrics.iconViewBox, 'the checkout action should use the canonical admin trash glyph')
    .toBe('0 0 640 640');
  expect(metrics.iconFill).toBe('currentColor');
  expect(metrics.iconStroke).toBeNull();

  const neutralColors = await readRemoveActionColors(removeButton);
  expect(
    neutralColors.color,
    'the destructive action should read as neutral until the customer interacts with it'
  ).toBe(neutralColors.themeNeutralText);
  expect(neutralColors.borderColor).toBe(neutralColors.themeNeutralBorder);
  expect(neutralColors.backgroundColor).toBe('rgba(0, 0, 0, 0)');

  await removeButton.hover();
  await waitForRemoveActionTransitions(removeButton);
  const hoverColors = await readRemoveActionColors(removeButton);
  expect(hoverColors.color).toBe(hoverColors.themeDanger);
  expect(hoverColors.backgroundColor).not.toBe(neutralColors.backgroundColor);
  expect(hoverColors.borderColor).not.toBe(neutralColors.borderColor);

  // Return with the keyboard so the test exercises the focus-visible treatment,
  // not the mouse hover that preceded it.
  await page.mouse.move(0, 0);
  await removeButton.focus();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Shift+Tab');
  await waitForRemoveActionTransitions(removeButton);
  const focusedColors = await readRemoveActionColors(removeButton);
  expect(focusedColors.focused).toBe(true);
  expect(focusedColors.focusVisible).toBe(true);
  expect(focusedColors.color).toBe(focusedColors.themeDanger);
  expect(focusedColors.backgroundColor).toBe(hoverColors.backgroundColor);
  expect(focusedColors.borderColor).toBe(hoverColors.borderColor);

  return {
    buttonHeight: metrics.buttonHeight,
    buttonWidth: metrics.buttonWidth,
    iconHeight: metrics.iconHeight,
    iconWidth: metrics.iconWidth
  };
}

type FloatingLabelPosition = {
  controlHeight: number;
  controlTextBottom: number;
  controlTextTop: number;
  dataFilled: string | null;
  fontSize: number;
  labelBottom: number;
  labelCenterRatio: number;
  labelLeftInset: number;
  labelTop: number;
  shellBottom: number;
  shellHeight: number;
  shellTop: number;
};

async function readFloatingLabelPosition(
  control: Locator
): Promise<FloatingLabelPosition> {
  const controlId = await control.getAttribute('id');
  expect(controlId, 'checkout controls need stable ids for accessible labels').toBeTruthy();

  const shell = control.locator('xpath=ancestor::*[@data-floating-field][1]');
  await expect(shell, 'checkout controls should use the shared floating field shell')
    .toBeVisible();

  return shell.evaluate((element, id) => {
    const field = element.querySelector<HTMLElement>(`#${CSS.escape(id)}`);
    const label = element.querySelector<HTMLElement>(
      `label[for="${CSS.escape(id)}"]`
    );

    if (!field || !label) {
      throw new Error(`Missing floating field control or label for #${id}`);
    }

    const shellBox = element.getBoundingClientRect();
    const controlBox = field.getBoundingClientRect();
    const labelBox = label.getBoundingClientRect();
    const labelStyle = getComputedStyle(label);
    const controlStyle = getComputedStyle(field);
    const logicalControlHeight = Number.parseFloat(controlStyle.height);
    const physicalScale = Number.isFinite(logicalControlHeight) && logicalControlHeight > 0
      ? controlBox.height / logicalControlHeight
      : 1;
    const controlTextTop =
      controlBox.top + Number.parseFloat(controlStyle.paddingTop) * physicalScale;
    const controlTextBottom =
      controlTextTop + Number.parseFloat(controlStyle.lineHeight) * physicalScale;

    return {
      controlHeight: controlBox.height,
      controlTextBottom,
      controlTextTop,
      dataFilled: element.getAttribute('data-filled'),
      fontSize: Number.parseFloat(labelStyle.fontSize) * physicalScale,
      labelBottom: labelBox.bottom,
      labelCenterRatio:
        (labelBox.top + labelBox.height / 2 - shellBox.top) / shellBox.height,
      labelLeftInset: labelBox.left - shellBox.left,
      labelTop: labelBox.top,
      shellBottom: shellBox.bottom,
      shellHeight: shellBox.height,
      shellTop: shellBox.top
    };
  }, controlId!);
}

async function expectFloatingLabelResting(
  control: Locator,
  options: { multiline?: boolean } = {}
) {
  await expect
    .poll(async () => (await readFloatingLabelPosition(control)).labelCenterRatio)
    .toBeGreaterThanOrEqual(options.multiline ? 0.12 : 0.4);

  const metrics = await readFloatingLabelPosition(control);
  expect(metrics.dataFilled).toBe('false');
  expect(metrics.fontSize).toBeGreaterThanOrEqual(10);
  if (options.multiline) {
    expect(
      metrics.labelCenterRatio,
      'an empty blurred textarea label should sit in its first text row'
    ).toBeGreaterThanOrEqual(0.12);
    expect(metrics.labelCenterRatio).toBeLessThanOrEqual(0.35);
  } else {
    expect(
      metrics.labelCenterRatio,
      'an empty blurred label should sit vertically centered inside its field'
    ).toBeGreaterThanOrEqual(0.4);
    expect(metrics.labelCenterRatio).toBeLessThanOrEqual(0.6);
  }
  expect(metrics.labelTop).toBeGreaterThanOrEqual(metrics.shellTop - 1);
  expect(metrics.labelBottom).toBeLessThanOrEqual(metrics.shellBottom + 1);
}

async function expectFloatingLabelRetracted(control: Locator) {
  await expect
    .poll(async () => {
      const metrics = await readFloatingLabelPosition(control);
      return metrics.controlTextTop - metrics.labelBottom;
    })
    .toBeGreaterThanOrEqual(0.5);

  const metrics = await readFloatingLabelPosition(control);
  expect(metrics.fontSize).toBeLessThanOrEqual(10.5);
  expect(
    metrics.labelCenterRatio,
    'a focused or filled label should retract into the field top-left'
  ).toBeLessThanOrEqual(0.38);
  expect(metrics.labelLeftInset).toBeGreaterThanOrEqual(5);
  expect(metrics.labelLeftInset).toBeLessThanOrEqual(20);
  expect(metrics.labelTop).toBeGreaterThanOrEqual(metrics.shellTop - 1);
  expect(metrics.labelBottom).toBeLessThanOrEqual(metrics.shellBottom + 1);
  expect(
    metrics.labelBottom,
    'a retracted label must finish above the entered-text line'
  ).toBeLessThanOrEqual(metrics.controlTextTop - 0.5);
  expect(
    metrics.controlTextBottom,
    'the entered-text line must remain fully inside the compact control'
  ).toBeLessThanOrEqual(metrics.shellBottom - 1);
}

async function requireBoundingBox(locator: Locator, description: string) {
  const box = await locator.boundingBox();
  expect(box, `${description} should have measurable geometry`).not.toBeNull();
  return box!;
}

async function expectDesktopPair(
  first: Locator,
  second: Locator,
  description: string,
  options: { balanced?: boolean } = {}
) {
  const [firstBox, secondBox] = await Promise.all([
    requireBoundingBox(first, `${description} first field`),
    requireBoundingBox(second, `${description} second field`)
  ]);

  expect(
    Math.abs(firstBox.y - secondBox.y),
    `${description} should share one desktop row`
  ).toBeLessThanOrEqual(2);
  expect(
    secondBox.x,
    `${description} should read left-to-right without overlap`
  ).toBeGreaterThan(firstBox.x + firstBox.width);
  if (options.balanced !== false) {
    expect(
      Math.abs(firstBox.width - secondBox.width),
      `${description} should use balanced columns`
    ).toBeLessThanOrEqual(3);
  }
}

async function expectControlsDisabled(controls: Locator[]) {
  for (const control of controls) {
    await expect(control).toBeDisabled();
  }
}

async function expectControlsEnabled(controls: Locator[]) {
  for (const control of controls) {
    await expect(control).toBeEnabled();
  }
}

async function finishMotion(locator: Locator) {
  await locator.evaluate(async (element) => {
    await Promise.all(
      element
        .getAnimations({ subtree: true })
        .map((animation) => animation.finished.catch(() => undefined))
    );
  });
}

test.describe('order checkout layout', () => {
  test.beforeEach(async ({ page }) => {
    await seedCheckout(page);
  });

  test('uses a compact responsive checkout heading', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('/order');

    const heading = page.getByTestId('order-page-heading');
    await expect(heading).toHaveText('Oddaja naročila');
    await expect(heading).toHaveCSS('font-size', '30px');
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(heading).toHaveCSS('font-size', '24px');
  });

  test('selects the checkout intent at the top and shows one contextual action', async ({
    page
  }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('/order');

    const formColumn = page.getByTestId('order-form-column');
    const intentSection = formColumn.getByTestId(
      'order-checkout-intent-section'
    );
    const intentGroup = intentSection.getByRole('radiogroup', {
      name: 'Način oddaje'
    });
    const orderIntent = intentGroup.getByRole('radio', {
      name: 'Naročilo',
      exact: true
    });
    const quoteIntent = intentGroup.getByRole('radio', {
      name: 'Zahtevaj ponudbo',
      exact: true
    });
    const customerTypeGroup = formColumn.getByRole('radiogroup', {
      name: 'Vrsta naročnika'
    });
    const desktopActions = page.getByTestId('order-summary-column');

    await expect(intentSection).toBeVisible({ timeout: 15_000 });
    await expect(orderIntent).toHaveAttribute('aria-checked', 'true');
    await expect(quoteIntent).toHaveAttribute('aria-checked', 'false');
    await expect(page.getByTestId('quote-request-details-section')).toHaveCount(
      0
    );
    await expect(
      page.getByText('Vrsta povpraševanja', { exact: true })
    ).toHaveCount(0);

    const intentBox = await intentSection.boundingBox();
    const customerTypeBox = await customerTypeGroup.boundingBox();
    expect(intentBox).not.toBeNull();
    expect(customerTypeBox).not.toBeNull();
    expect(intentBox!.y).toBeLessThan(customerTypeBox!.y);

    await expect(desktopActions).toBeVisible({ timeout: 15_000 });
    await expect(desktopActions.locator('button[type="submit"]')).toHaveCount(
      1
    );
    await expect(desktopActions.locator('button[type="submit"]')).toHaveAttribute(
      'value',
      'order'
    );
    await expect(
      desktopActions.getByRole('button', {
        name: 'Oddaj naročilo',
        exact: true
      })
    ).toBeVisible();

    await quoteIntent.click();
    await expect(orderIntent).toHaveAttribute('aria-checked', 'false');
    await expect(quoteIntent).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByTestId('order-page-heading')).toHaveText(
      'Oddaja povpraševanja'
    );
    await customerTypeGroup
      .getByRole('radio', { name: 'Šola / javni zavod' })
      .click();
    const quoteDetails = page.getByTestId('quote-request-details-section');
    await expect(quoteDetails).toBeVisible();
    await expect(quoteDetails.getByLabel('Opombe', { exact: true })).toBeVisible();
    await expect(quoteDetails.getByRole('textbox')).toHaveCount(1);
    await expect(quoteDetails.getByTestId('quote-request-fixed-type')).toHaveCount(
      0
    );
    await expect(quoteDetails.locator('#quoteReason')).toHaveCount(0);
    await expect(
      formColumn.getByLabel('Vaša referenca ali št. naročilnice', {
        exact: true
      })
    ).toHaveCount(0);
    await expect(
      formColumn.getByText('Neobvezujoče povpraševanje', { exact: true })
    ).toHaveCount(0);
    await expect(
      formColumn.getByText('Kaj potrebujete?', { exact: true })
    ).toHaveCount(0);
    await expect(
      formColumn.getByText('Formalno ponudbo za izbrane artikle', {
        exact: true
      })
    ).toHaveCount(0);
    await expect(
      formColumn.getByText('Dodatne želje ali vprašanja', { exact: true })
    ).toHaveCount(0);
    await expect(
      desktopActions.getByRole('button', {
        name: 'Zahtevaj ponudbo',
        exact: true
      })
    ).toBeVisible();
    await expect(desktopActions.locator('button[type="submit"]')).toHaveAttribute(
      'value',
      'quote_request'
    );

    await orderIntent.click();
    await expect(page.getByTestId('quote-request-details-section')).toHaveCount(
      0
    );
    await expect(page.getByTestId('order-payment-section')).toBeVisible();
    await expect(
      formColumn.getByLabel('Vaša referenca ali št. naročilnice', {
        exact: true
      })
    ).toBeVisible();
    await expect(
      page.getByText('Vrsta povpraševanja', { exact: true })
    ).toHaveCount(0);
    await quoteIntent.click();

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(desktopActions).toBeHidden();

    const mobileActions = page
      .locator('form')
      .locator('div[class~="sticky"][class~="bottom-0"][class~="lg:hidden"]');
    await expect(mobileActions).toBeVisible();
    await expect(mobileActions.locator('button[type="submit"]')).toHaveCount(1);
    await expect(
      mobileActions.getByRole('button', {
        name: 'Zahtevaj ponudbo',
        exact: true
      })
    ).toBeVisible();
  });

  test('submits the single quote notes field without hidden order-only values', async ({
    page
  }) => {
    let submittedPayload: Record<string, unknown> | null = null;
    await page.route('**/api/addresses/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ results: [] })
      });
    });
    await page.route('**/api/quote-requests', async (route) => {
      submittedPayload = route.request().postDataJSON() as Record<
        string,
        unknown
      >;
      await route.fulfill({
        status: 422,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 'E2E_CAPTURED_QUOTE_REQUEST',
          message: 'Testna zahteva je bila zajeta.'
        })
      });
    });

    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('/order');

    const formColumn = page.getByTestId('order-form-column');
    await formColumn
      .getByRole('radio', { name: 'Šola / javni zavod' })
      .click();
    await formColumn
      .getByLabel('E-poštni naslov *', { exact: true })
      .fill('nabava@example.com');
    await formColumn
      .getByLabel('Naziv naročnika *', { exact: true })
      .fill('Testna šola');
    await formColumn
      .getByLabel('Kontaktna oseba *', { exact: true })
      .fill('Maja Novak');
    await formColumn
      .getByLabel('Ulica ali naselje in hišna številka', { exact: true })
      .fill('Testna ulica 1');
    await formColumn
      .getByLabel('Poštna številka *', { exact: true })
      .fill('1000');
    await formColumn
      .getByLabel('Poštni kraj *', { exact: true })
      .fill('Ljubljana');
    await formColumn
      .getByLabel('Vaša referenca ali št. naročilnice', { exact: true })
      .fill('SKRITA-REFERENCA');
    await formColumn
      .getByLabel('Opombe', { exact: true })
      .fill('Skrite opombe naročila');

    await formColumn
      .getByRole('radio', { name: 'Zahtevaj ponudbo', exact: true })
      .click();
    const quoteNotes = formColumn.getByLabel('Opombe', { exact: true });
    await expect(quoteNotes).toHaveCount(1);
    await quoteNotes.fill('Prosimo za dobavni rok.');

    const submit = page
      .getByTestId('order-summary-column')
      .locator('button[type="submit"]');
    await expect(submit).toBeEnabled();
    await submit.click();
    await expect.poll(() => submittedPayload).not.toBeNull();

    expect(submittedPayload).toMatchObject({
      quoteReason: 'formal_offer',
      quoteMessage: 'Prosimo za dobavni rok.'
    });
    expect(submittedPayload).not.toHaveProperty('notes');
    expect(submittedPayload).not.toHaveProperty('reference');
  });


  test('quickly expands and collapses the school-order notice', async ({
    page
  }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.goto('/order');

    const formColumn = page.getByTestId('order-form-column');
    const notice = formColumn.getByTestId('order-school-notice');
    const school = formColumn.getByRole('radio', {
      name: 'Šola / javni zavod'
    });
    const company = formColumn.getByRole('radio', { name: 'Podjetje' });

    await expect(formColumn).toBeVisible({ timeout: 15_000 });
    await expect(notice).toHaveAttribute('data-visible', 'false');
    await expect(notice).toHaveAttribute('aria-hidden', 'true');
    await expect(notice).toBeHidden();

    const motionContract = await notice.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        properties: style.transitionProperty,
        durations: style.transitionDuration,
        reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches
      };
    });
    expect(motionContract.reducedMotion).toBe(false);
    expect(motionContract.properties).toContain('grid-template-rows');
    expect(motionContract.properties).toContain('opacity');
    expect(motionContract.durations).toContain('0.16s');
    expect(motionContract.durations).toContain('0.12s');

    await school.click();
    await expect(notice).toHaveAttribute('data-visible', 'true');
    await expect(notice).toHaveAttribute('aria-hidden', 'false');
    await expect(formColumn.getByRole('radiogroup', {
      name: 'Vrsta naročnika'
    })).toHaveAttribute('aria-describedby', 'order-school-notice-message');
    await finishMotion(notice);
    await expect(notice).toBeVisible();
    await expect(notice).toHaveCSS('opacity', '1');
    const expandedHeight = await notice.evaluate(
      (element) => element.getBoundingClientRect().height
    );
    expect(expandedHeight).toBeGreaterThan(0);

    await company.click();
    await expect(notice).toHaveAttribute('data-visible', 'false');
    await expect(notice).toHaveAttribute('aria-hidden', 'true');
    await finishMotion(notice);
    await expect(notice).toBeHidden();
    const collapsedHeight = await notice.evaluate(
      (element) => element.getBoundingClientRect().height
    );
    expect(collapsedHeight).toBe(0);

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await school.click();
    await expect(notice).toBeVisible();
    await expect(notice).toHaveCSS('transition-duration', '0s');
    await expect(
      notice.locator('.order-school-notice__message')
    ).toHaveCSS('transform', 'none');
    await company.click();
    await expect(notice).toBeHidden();
    await expect(notice).toHaveCSS('transition-duration', '0s');
  });

  test('uses a 3:2 desktop split with compact one-line fields', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('/order');

    const layout = page.getByTestId('order-checkout-layout');
    const formColumn = page.getByTestId('order-form-column');
    const summaryColumn = page.getByTestId('order-summary-column');

    await expect(layout).toBeVisible({ timeout: 15_000 });
    await expect(formColumn).toBeVisible();
    await expect(summaryColumn).toBeVisible();
    const customerDetailsCard = formColumn.getByTestId(
      'order-customer-details-card'
    );
    await expect(
      formColumn.getByText('Za nadaljevanje izberite vrsto naročnika.', {
        exact: true
      })
    ).toBeVisible();
    await expect(customerDetailsCard).toHaveCount(0);
    await page.getByRole('radio', { name: 'Šola / javni zavod' }).click();
    await expect(customerDetailsCard).toBeVisible();
    await expect(customerDetailsCard.getByTestId('order-contact-section'))
      .toBeVisible();
    await expect(customerDetailsCard.getByTestId('order-address-section'))
      .toBeVisible();
    await expect(customerDetailsCard.getByTestId('order-payment-section'))
      .toBeVisible();
    await expect(
      customerDetailsCard.getByRole('heading', { name: 'Naslov za dostavo' })
    ).toHaveCount(0);
    await expect(
      customerDetailsCard.getByRole('heading', {
        name: 'Plačilo in dodatni podatki'
      })
    ).toHaveCount(0);
    await expect(
      customerDetailsCard.locator('.site-card'),
      'contact, delivery and payment should share one outer card without nested card windows'
    ).toHaveCount(0);
    await expect(
      summaryColumn.getByRole('heading', { name: 'Povzetek naročila' })
    ).toBeVisible();
    await expect(summaryColumn.getByText('Preizkusni artikel')).toBeVisible();
    await expect(
      summaryColumn.getByText('Osnovna poštnina', { exact: true })
    ).toHaveCount(0);
    await expect(
      summaryColumn.getByText('Samodejno izračunana poštnina', { exact: true })
    ).toHaveCount(0);
    const summaryShippingRow = summaryColumn.locator(
      '[data-summary-row="shipping"]'
    );
    await expect(summaryShippingRow).toHaveCount(1);
    await expect(summaryShippingRow).toContainText('3,00 €');
    await expect(
      summaryColumn.getByText('Poštnina', { exact: true })
    ).toBeVisible();
    const summaryLabelStyles = await Promise.all(
      ['Cena brez DDV', 'DDV', 'Poštnina'].map((label) =>
        summaryColumn
          .getByText(label, { exact: true })
          .evaluate((element) => {
            const style = getComputedStyle(element);
            return {
              color: style.color,
              fontFamily: style.fontFamily,
              fontSize: style.fontSize,
              fontStyle: style.fontStyle,
              fontWeight: style.fontWeight,
              letterSpacing: style.letterSpacing,
              lineHeight: style.lineHeight
            };
          })
      )
    );
    for (const style of summaryLabelStyles.slice(1)) {
      expect(
        style,
        'all non-total checkout summary labels should share one rendered text style'
      ).toEqual(summaryLabelStyles[0]);
    }
    const summaryCartLine = summaryColumn.locator(
      `[data-cart-line-id="${cartItem.lineId}"]`
    );
    await expect(
      summaryCartLine.getByText('Dimenzije: 100 × 100 mm', { exact: true })
    ).toBeVisible();
    await expect(
      summaryCartLine.getByText('100 × 100 mm', { exact: true })
    ).toHaveCount(0);
    const summaryTypeSizes = await summaryCartLine.evaluate((line) => {
      const scaleRoot = line.closest<HTMLElement>(
        '.commercial-storefront-scale'
      );
      const scale = scaleRoot
        ? Number.parseFloat(getComputedStyle(scaleRoot).zoom || '1')
        : 1;
      const physicalFontSize = (selector: string) => {
        const element = line.querySelector<HTMLElement>(selector);
        return element
          ? Number.parseFloat(getComputedStyle(element).fontSize) * scale
          : 0;
      };
      return {
        title: physicalFontSize('.storefront-cart-line-title'),
        options: physicalFontSize('.storefront-cart-line-options'),
        sku: physicalFontSize('.storefront-cart-line-sku'),
        price: physicalFontSize('.storefront-price-primary'),
        priceLabel: physicalFontSize('.storefront-price-label'),
        tax: physicalFontSize('.storefront-price-tax')
      };
    });
    expect(summaryTypeSizes.title).toBeGreaterThanOrEqual(15.5);
    expect(summaryTypeSizes.options).toBeGreaterThanOrEqual(12.5);
    expect(summaryTypeSizes.sku).toBeGreaterThanOrEqual(11.5);
    expect(summaryTypeSizes.price).toBeGreaterThanOrEqual(16.5);
    expect(summaryTypeSizes.priceLabel).toBeGreaterThanOrEqual(11.5);
    expect(summaryTypeSizes.tax).toBeGreaterThanOrEqual(11.5);
    const desktopRemoveMetrics = await expectAdminStyleRemoveAction(
      page,
      summaryColumn.getByRole('button', {
        name: 'Odstrani Preizkusni artikel'
      })
    );
    const desktopTotal = summaryColumn
      .getByText('Skupaj z DDV', { exact: true })
      .locator('..');
    await expect(desktopTotal).toContainText('15,20 €');

    await page.getByRole('button', { name: /^Košarica/ }).click();
    const cartDrawer = page.getByRole('dialog', { name: 'Košarica (1)' });
    await expect(cartDrawer).toBeVisible();
    const drawerShippingRow = cartDrawer.getByTestId('cart-drawer-shipping');
    await expect(drawerShippingRow).toHaveCount(1);
    await expect(drawerShippingRow).toHaveAttribute('data-summary-row', 'shipping');
    await expect(drawerShippingRow).toContainText(
      'Izračun na strani za naročilo'
    );
    const drawerSubtotal = cartDrawer
      .getByText('Vmesni seštevek z DDV', { exact: true })
      .locator('..');
    await expect(drawerSubtotal).toContainText('12,20 €');
    await expect(cartDrawer.locator('[data-shipping-row]')).toHaveCount(0);
    await expect.poll(async () => (
      (await cartDrawer.innerText()).match(/poštnina/giu) ?? []
    ).length).toBe(1);
    await expect(
      cartDrawer.getByText('Poštnina', { exact: true })
    ).toHaveCount(1);
    for (const oldShippingLabel of [
      'Osnovna poštnina',
      'Referenčna cena posameznega paketa (S)',
      '1 × S',
      'Po popustu za več kosov',
      'Izračun',
      'Samodejno izračunana poštnina'
    ]) {
      await expect(
        cartDrawer.getByText(oldShippingLabel, { exact: true })
      ).toHaveCount(0);
    }
    const drawerRemoveMetrics = await expectAdminStyleRemoveAction(
      page,
      cartDrawer.getByRole('button', {
        name: 'Odstrani Preizkusni artikel'
      })
    );
    expect(
      Math.abs(drawerRemoveMetrics.buttonWidth - desktopRemoveMetrics.buttonWidth),
      'the unscaled cart drawer and scaled checkout summary should expose the same physical action size'
    ).toBeLessThanOrEqual(1);
    expect(
      Math.abs(drawerRemoveMetrics.iconWidth - desktopRemoveMetrics.iconWidth),
      'the canonical trash glyph should retain physical-size parity in the cart drawer'
    ).toBeLessThanOrEqual(1);
    await cartDrawer.getByRole('button', { name: 'Zapri košarico' }).click();
    await expect(cartDrawer).toBeHidden();

    await expect(
      formColumn.getByText(
        'Po oddaji boste po e-pošti prejeli varno povezavo za nalaganje naročilnice. Naročilo začnemo obdelovati šele po prejemu in pregledu naročilnice.',
        { exact: true }
      )
    ).toBeVisible();
    await expect(formColumn.getByText(/ročno potrditev/i)).toHaveCount(0);

    const [formBox, summaryBox] = await Promise.all([
      formColumn.boundingBox(),
      summaryColumn.boundingBox()
    ]);
    expect(formBox, 'the desktop form column should have measurable geometry')
      .not.toBeNull();
    expect(summaryBox, 'the desktop summary column should have measurable geometry')
      .not.toBeNull();

    const columnRatio = formBox!.width / summaryBox!.width;
    expect(
      columnRatio,
      'the available desktop width should be split 3:2 after the grid gap'
    ).toBeGreaterThanOrEqual(1.47);
    expect(columnRatio).toBeLessThanOrEqual(1.53);

    const fieldMetrics = await page
      .locator(
        'input.storefront-checkout-input, select.storefront-checkout-input'
      )
      .evaluateAll((fields) =>
        fields
          .filter((field) => {
            const box = field.getBoundingClientRect();
            const style = getComputedStyle(field);
            return box.width > 0 && box.height > 0 && style.visibility !== 'hidden';
          })
          .map((field) => {
            const box = field.getBoundingClientRect();
            const shell = field.closest<HTMLElement>(
              '.storefront-checkout-input-shell'
            );
            const shellBox = shell?.getBoundingClientRect();
            const shellStyle = shell ? getComputedStyle(shell) : null;
            const fieldStyle = getComputedStyle(field);
            const control = field as HTMLInputElement | HTMLSelectElement;
            return {
              tagName: field.tagName,
              type: field instanceof HTMLInputElement ? field.type : null,
              height: box.height,
              clientHeight: control.clientHeight,
              scrollHeight: control.scrollHeight,
              shellHeight: shellBox?.height ?? 0,
              shellTopInset: shellBox ? box.top - shellBox.top : -1,
              shellRightInset: shellBox ? shellBox.right - box.right : -1,
              shellBottomInset: shellBox ? shellBox.bottom - box.bottom : -1,
              shellLeftInset: shellBox ? box.left - shellBox.left : -1,
              shellOverflow: shellStyle?.overflow ?? '',
              shellBorderWidths: shellStyle
                ? [
                    shellStyle.borderTopWidth,
                    shellStyle.borderRightWidth,
                    shellStyle.borderBottomWidth,
                    shellStyle.borderLeftWidth
                  ].map(Number.parseFloat)
                : [],
              shellRadius: shellStyle
                ? Number.parseFloat(shellStyle.borderTopLeftRadius)
                : 0,
              fieldRadius: Number.parseFloat(fieldStyle.borderTopLeftRadius)
            };
          })
      );

    expect(
      fieldMetrics.length,
      'checkout text/select controls should expose the compact checkout hook'
    ).toBeGreaterThan(0);
    for (const metric of fieldMetrics) {
      expect(['INPUT', 'SELECT']).toContain(metric.tagName);
      expect(metric.type).not.toBe('hidden');
      expect(metric.height, 'checkout inputs should use the compact 40px row')
        .toBeGreaterThanOrEqual(38);
      expect(metric.height).toBeLessThanOrEqual(41);
      expect(metric.shellHeight).toBeGreaterThanOrEqual(39);
      expect(metric.shellHeight).toBeLessThanOrEqual(41);
      expect(
        metric.scrollHeight,
        'compact text/select controls should not grow into multiline fields'
      ).toBeLessThanOrEqual(metric.clientHeight + 1);
      expect(
        metric.shellTopInset,
        'the control must stay inside the top border of its floating shell'
      ).toBeGreaterThanOrEqual(0.5);
      expect(
        metric.shellBottomInset,
        'the control must not cover the floating shell bottom border'
      ).toBeGreaterThanOrEqual(0.5);
      expect(
        Math.abs(metric.shellTopInset - metric.shellBottomInset),
        'the floating field should expose equally visible top and bottom borders'
      ).toBeLessThanOrEqual(0.25);
      expect(
        metric.shellLeftInset,
        'the control must stay inside the left border of its floating shell'
      ).toBeGreaterThanOrEqual(0.5);
      expect(
        metric.shellRightInset,
        'the control must stay inside the right border of its floating shell'
      ).toBeGreaterThanOrEqual(0.5);
      expect(
        Math.abs(metric.shellLeftInset - metric.shellRightInset),
        'the floating field should expose equally visible side borders'
      ).toBeLessThanOrEqual(0.25);
      expect(new Set(metric.shellBorderWidths).size).toBe(1);
      expect(metric.shellOverflow).toBe('hidden');
      expect(
        metric.fieldRadius,
        'the inner control radius must remain inside the shell curve'
      ).toBeLessThan(metric.shellRadius);
    }

    const notes = page.getByLabel('Opombe');
    await expect(notes).toBeVisible();
    const notesBox = await notes.boundingBox();
    expect(notesBox).not.toBeNull();
    const tallestCompactField = Math.max(
      ...fieldMetrics.map((metric) => metric.height)
    );
    expect(
      notesBox!.height,
      'the deliberately multiline notes textarea should remain taller than inputs'
    ).toBeGreaterThan(tallestCompactField * 1.5);
  });

  test('floats accessible checkout labels on focus, values, and autofill-style input', async ({
    page
  }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('/order');

    const formColumn = page.getByTestId('order-form-column');
    await expect(formColumn).toBeVisible({ timeout: 15_000 });
    await page.getByRole('radio', { name: 'Šola / javni zavod' }).click();

    const email = formColumn.getByLabel('E-poštni naslov *', { exact: true });
    await expect(email).toBeVisible();
    await expect(email).toHaveAttribute('autocomplete', 'email');
    await expect(email).toHaveAccessibleName('E-poštni naslov *');
    await expect(email).toHaveAttribute('aria-invalid', 'false');
    await expectFloatingLabelResting(email);

    await email.focus();
    await expect(email).toBeFocused();
    await expectFloatingLabelRetracted(email);

    await email.fill('kupec@example.com');
    const emailShell = email.locator(
      'xpath=ancestor::*[@data-floating-field][1]'
    );
    await expect(emailShell).toHaveAttribute('data-filled', 'true');
    await formColumn
      .getByRole('heading', { name: 'Kontakt in naročnik' })
      .click();
    await expect(email).not.toBeFocused();
    await expectFloatingLabelRetracted(email);

    await email.fill('');
    await expect(emailShell).toHaveAttribute('data-filled', 'false');
    await formColumn
      .getByRole('heading', { name: 'Kontakt in naročnik' })
      .click();
    await expectFloatingLabelResting(email);

    await email.evaluate((element) => {
      const valueSetter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'value'
      )?.set;
      valueSetter?.call(element, 'samodejno@example.com');
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await expect(email).toHaveValue('samodejno@example.com');
    await expect(emailShell).toHaveAttribute('data-filled', 'true');
    await expectFloatingLabelRetracted(email);

    await email.fill('');
    await formColumn
      .getByRole('heading', { name: 'Kontakt in naročnik' })
      .click();
    await expectFloatingLabelResting(email);

    await email.fill('kupec@example.com');
    await expect(email).toHaveAttribute('aria-invalid', 'false');
    await expect(email).not.toHaveAttribute('aria-describedby', /.+/);

    const address = formColumn.getByLabel(
      'Ulica ali naselje in hišna številka',
      { exact: true }
    );
    await expect(address).toHaveAttribute('autocomplete', 'off');
    await address.fill('AJDOVSKA 1g');
    await expectFloatingLabelRetracted(address);

    const notes = formColumn.getByLabel('Opombe', { exact: true });
    await expect(notes).toHaveAccessibleName('Opombe');
    await expectFloatingLabelResting(notes, { multiline: true });
    const notesMetrics = await readFloatingLabelPosition(notes);
    expect(notesMetrics.controlHeight, 'notes should remain a multiline textarea')
      .toBeGreaterThanOrEqual(82);
    expect(notesMetrics.controlHeight).toBeLessThanOrEqual(90);

    await notes.fill('Prva vrstica\nDruga vrstica');
    await expect(notes).toHaveValue('Prva vrstica\nDruga vrstica');
    await expectFloatingLabelRetracted(notes);
    await formColumn.getByText('Obdelava plačila', { exact: true }).click();
    await expectFloatingLabelRetracted(notes);
  });

  test('requires customer type, then gates coherent customer details until email is valid', async ({
    page
  }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('/order');

    const formColumn = page.getByTestId('order-form-column');
    await expect(formColumn).toBeVisible({ timeout: 15_000 });

    const customerTypeGroup = formColumn.getByRole('radiogroup', {
      name: 'Vrsta naročnika'
    });
    const customerTypePrompt = formColumn.getByText(
      'Za nadaljevanje izberite vrsto naročnika.',
      { exact: true }
    );
    const customerDetailsCard = formColumn.getByTestId(
      'order-customer-details-card'
    );
    const submit = page
      .getByTestId('order-summary-column')
      .locator('button[type="submit"]');

    await expect(customerTypeGroup).toHaveAttribute('aria-required', 'true');
    await expect(customerTypeGroup.getByRole('radio')).toHaveCount(3);
    for (const radio of await customerTypeGroup.getByRole('radio').all()) {
      await expect(radio).toHaveAttribute('aria-checked', 'false');
    }
    await expect(customerTypePrompt).toBeVisible();
    await expect(customerDetailsCard).toHaveCount(0);
    await expect(submit).toBeDisabled();
    await expect(
      formColumn.getByText(
        'Z oddajo pošiljate zavezujoče naročilo po prikazanem izračunu.',
        { exact: true }
      )
    ).toHaveCount(0);

    await page.getByRole('radio', { name: 'Šola / javni zavod' }).click();
    await expect(customerTypePrompt).toHaveCount(0);
    await expect(customerDetailsCard).toBeVisible();
    await expect(submit).toHaveText('Pošlji naročilo v potrditev');

    const email = formColumn.getByLabel('E-poštni naslov *', { exact: true });
    const organizationName = formColumn.getByLabel('Naziv naročnika *', {
      exact: true
    });
    const contactName = formColumn.getByLabel(
      'Kontaktna oseba *',
      { exact: true }
    );
    const address = formColumn.getByLabel(
      'Ulica ali naselje in hišna številka',
      { exact: true }
    );
    const city = formColumn.getByLabel('Poštni kraj *', { exact: true });
    const postalCode = formColumn.getByLabel('Poštna številka *', {
      exact: true
    });
    const reference = formColumn.getByLabel(
      'Vaša referenca ali št. naročilnice',
      { exact: true }
    );
    const notes = formColumn.getByLabel('Opombe', { exact: true });
    const gatedControls = [
      organizationName,
      contactName,
      address,
      city,
      postalCode,
      reference,
      notes
    ];
    const gateMessage = formColumn.getByTestId('order-email-gate-message');
    await expect(email).toBeEnabled();
    await expectControlsDisabled(gatedControls);
    await expect(gateMessage).toBeVisible();
    await expect(gateMessage).toHaveAttribute('role', 'status');
    await expect(gateMessage).toContainText(/veljaven e-poštni naslov/i);
    const gateMessageId = await gateMessage.getAttribute('id');
    expect(gateMessageId, 'the email gate helper should have a stable id').toBeTruthy();
    await expect(email).toHaveAttribute(
      'aria-describedby',
      new RegExp(`(?:^|\\s)${gateMessageId}(?:\\s|$)`)
    );
    await expect(submit).toBeDisabled();

    await email.focus();
    await page.keyboard.press('Tab');
    const focusedId = await page.evaluate(
      () => (document.activeElement as HTMLElement | null)?.id ?? ''
    );
    const gatedControlIds = await Promise.all(
      gatedControls.map((control) => control.getAttribute('id'))
    );
    expect(
      gatedControlIds,
      'keyboard navigation should skip email-gated controls'
    ).not.toContain(focusedId);

    await email.fill('neveljaven-naslov');
    await expectControlsDisabled(gatedControls);
    await expect(gateMessage).toBeVisible();
    await expect(submit).toBeDisabled();

    await email.fill('kupec@example.com');
    await expectControlsEnabled(gatedControls);
    await expect(gateMessage).toBeHidden();
    await expect(submit).toBeEnabled();
    await expect(contactName).toHaveAttribute('required', '');
    await expect(reference).toBeVisible();
    await reference.fill('NAROČILNICA-123');

    await expectDesktopPair(
      organizationName,
      contactName,
      'organization and contact fields'
    );
    await expectDesktopPair(postalCode, city, 'postal-code and city fields', {
      balanced: false
    });

    const [emailBox, organizationBox, addressBox, cityBox] = await Promise.all([
      requireBoundingBox(email, 'email field'),
      requireBoundingBox(organizationName, 'organization field'),
      requireBoundingBox(address, 'street-address field'),
      requireBoundingBox(city, 'city field')
    ]);
    expect(
      emailBox.width,
      'the important email field should retain its own full row'
    ).toBeGreaterThan(organizationBox.width * 1.9);
    expect(
      addressBox.width,
      'street address should retain a full row for longer addresses'
    ).toBeGreaterThan(cityBox.width * 1.15);

    await organizationName.fill('Primer podjetje');
    await contactName.fill('Maja Primer');
    await email.fill('');
    await expectControlsDisabled(gatedControls);
    await expect(gateMessage).toBeVisible();
    await expect(submit).toBeDisabled();
    await expect(organizationName).toHaveValue('Primer podjetje');
    await expect(contactName).toHaveValue('Maja Primer');

    await email.fill('ponovno@example.com');
    await expectControlsEnabled(gatedControls);
    await expect(organizationName).toHaveValue('Primer podjetje');
    await expect(contactName).toHaveValue('Maja Primer');

    await page.getByRole('radio', { name: 'Fizična oseba' }).click();
    await expect(reference).toHaveCount(0);
    const schoolNotice = formColumn.getByTestId('order-school-notice');
    await expect(schoolNotice).toHaveAttribute('data-visible', 'false');
    await finishMotion(schoolNotice);
    const firstName = formColumn.getByLabel('Ime *', { exact: true });
    const lastName = formColumn.getByLabel('Priimek *', { exact: true });
    await expectControlsEnabled([firstName, lastName]);
    await expectDesktopPair(firstName, lastName, 'first- and last-name fields');

    await email.fill('spet-neveljavno');
    await expectControlsDisabled([firstName, lastName, address, city, postalCode]);

    await page.getByRole('radio', { name: 'Podjetje' }).click();
    await expectControlsDisabled([organizationName, contactName]);
    await email.fill('podjetje@example.com');
    await expectControlsEnabled([organizationName, contactName]);
    await expectDesktopPair(
      organizationName,
      contactName,
      'company organization and contact fields'
    );
    await expect(reference).toHaveCount(0);

    await page.getByRole('radio', { name: 'Šola / javni zavod' }).click();
    await expect(reference).toBeVisible();
    await expect(reference).toHaveValue('NAROČILNICA-123');
    await page.getByRole('radio', { name: 'Podjetje' }).click();
    await expect(reference).toHaveCount(0);

    await page.reload();
    await expect(formColumn).toBeVisible({ timeout: 15_000 });
    await expect(email).toHaveValue('podjetje@example.com');
    await expectControlsEnabled([organizationName, contactName, address]);
    await expect(gateMessage).toBeHidden();
  });

  test('uses a single-column progressive form on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/order');

    const formColumn = page.getByTestId('order-form-column');
    await expect(formColumn).toBeVisible({ timeout: 15_000 });
    await page.getByRole('radio', { name: 'Šola / javni zavod' }).click();

    const email = formColumn.getByLabel('E-poštni naslov *', { exact: true });
    const organizationName = formColumn.getByLabel('Naziv naročnika *', {
      exact: true
    });
    const contactName = formColumn.getByLabel(
      'Kontaktna oseba *',
      { exact: true }
    );
    const address = formColumn.getByLabel(
      'Ulica ali naselje in hišna številka',
      { exact: true }
    );
    const city = formColumn.getByLabel('Poštni kraj *', { exact: true });
    const postalCode = formColumn.getByLabel('Poštna številka *', {
      exact: true
    });

    await expectControlsDisabled([
      organizationName,
      contactName,
      address,
      city,
      postalCode
    ]);
    await email.fill('mobilni@example.com');
    await expectControlsEnabled([
      organizationName,
      contactName,
      address,
      city,
      postalCode
    ]);

    const controls = [
      email,
      organizationName,
      contactName,
      address,
      postalCode,
      city
    ];
    const boxes = await Promise.all(
      controls.map((control, index) =>
        requireBoundingBox(control, `mobile checkout field ${index + 1}`)
      )
    );

    for (let index = 1; index < boxes.length; index += 1) {
      expect(
        Math.abs(boxes[index].x - boxes[0].x),
        'mobile fields should share one left edge'
      ).toBeLessThanOrEqual(2);
      expect(
        Math.abs(boxes[index].width - boxes[0].width),
        'mobile fields should use the full single-column width'
      ).toBeLessThanOrEqual(3);
      expect(
        boxes[index].y,
        'mobile fields should progress vertically in document order'
      ).toBeGreaterThan(boxes[index - 1].y + boxes[index - 1].height);
    }
  });

  test('stacks cleanly on mobile and keeps the collapsible summary', async ({
    page
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/order');

    const layout = page.getByTestId('order-checkout-layout');
    const formColumn = page.getByTestId('order-form-column');
    const desktopSummary = page.getByTestId('order-summary-column');

    await expect(layout).toBeVisible({ timeout: 15_000 });
    await expect(formColumn).toBeVisible();
    await expect(desktopSummary).toBeHidden();

    const [layoutBox, formBox] = await Promise.all([
      layout.boundingBox(),
      formColumn.boundingBox()
    ]);
    expect(layoutBox).not.toBeNull();
    expect(formBox).not.toBeNull();
    expect(Math.abs(formBox!.x - layoutBox!.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(formBox!.width - layoutBox!.width)).toBeLessThanOrEqual(1);

    const mobileSummary = page.locator('details').filter({
      has: page.getByText('Povzetek naročila (1)', { exact: true })
    });
    await expect(mobileSummary).toBeVisible();
    await mobileSummary.getByText('Povzetek naročila (1)', { exact: true }).click();
    await expect(mobileSummary.getByText('Preizkusni artikel')).toBeVisible();
    const mobileRemoveButton = mobileSummary.getByRole('button', {
      name: 'Odstrani Preizkusni artikel'
    });
    await expectAdminStyleRemoveAction(page, mobileRemoveButton);
    const mobileTotal = mobileSummary
      .getByText('Skupaj z DDV', { exact: true })
      .locator('..');
    await expect(mobileTotal).toContainText('15,20 €');

    const overflow = await page.evaluate(() => ({
      viewportWidth: window.innerWidth,
      documentWidth: document.documentElement.scrollWidth
    }));
    expect(
      overflow.documentWidth,
      'the single-column mobile checkout should not create horizontal overflow'
    ).toBeLessThanOrEqual(overflow.viewportWidth + 1);

    await page.getByRole('radio', { name: 'Šola / javni zavod' }).click();
    const mobileEmail = formColumn.getByLabel('E-poštni naslov *', {
      exact: true
    });
    await expectFloatingLabelResting(mobileEmail);
    const mobileEmailMetrics = await readFloatingLabelPosition(mobileEmail);
    expect(mobileEmailMetrics.controlHeight).toBeGreaterThanOrEqual(38);
    expect(mobileEmailMetrics.controlHeight).toBeLessThanOrEqual(41);
    await mobileEmail.focus();
    await expectFloatingLabelRetracted(mobileEmail);

    await mobileRemoveButton.click();
    await expect(
      page.getByRole('heading', { name: 'Košarica je prazna' })
    ).toBeVisible();
  });
});
