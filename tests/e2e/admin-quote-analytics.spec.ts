import { expect, test, type Locator } from '@playwright/test';
import {
  formatEuroWithSuffix,
  formatSlInteger
} from '@/shared/domain/formatting';
import { assertAuthenticatedAdmin } from './support/auth';

type CardStyle = {
  height: number;
  borderRadius: string;
  paddingTop: string;
  paddingRight: string;
  paddingBottom: string;
  paddingLeft: string;
  titleFontSize: string;
  titleFontWeight: string;
  metricFontSize: string;
  metricFontWeight: string;
};

const readCardStyle = async (locator: Locator) => {
  return locator.evaluate((element) => {
    const cardStyle = getComputedStyle(element);
    const titleStyle = getComputedStyle(element.querySelector('p')!);
    const metricStyle = getComputedStyle(element.querySelectorAll('p')[1]!);
    return {
      height: element.getBoundingClientRect().height,
      borderRadius: cardStyle.borderRadius,
      paddingTop: cardStyle.paddingTop,
      paddingRight: cardStyle.paddingRight,
      paddingBottom: cardStyle.paddingBottom,
      paddingLeft: cardStyle.paddingLeft,
      titleFontSize: titleStyle.fontSize,
      titleFontWeight: titleStyle.fontWeight,
      metricFontSize: metricStyle.fontSize,
      metricFontWeight: metricStyle.fontWeight
    } satisfies CardStyle;
  });
};

test.beforeEach(async ({ request }) => {
  await assertAuthenticatedAdmin(request);
});

test('quote KPI cards match order cards and open the tracked quote analytics view', async ({ page, request }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });

  await page.goto('/admin/orders');
  const orderCards = page.locator('[data-analytics-summary-card="true"]');
  await expect(orderCards.first()).toBeVisible();
  const orderCardStyle = await readCardStyle(orderCards.first());

  await page.goto('/admin/orders?view=quotes');
  await expect(page.getByRole('tab', { name: 'Povpraševanja in ponudbe' })).toHaveAttribute('aria-selected', 'true');
  const quoteCards = page.locator('[data-analytics-summary-card="true"]');
  await expect(quoteCards).toHaveCount(6);
  const comparisonFooters = quoteCards.locator(
    '[data-analytics-comparison-period="30d"]'
  );
  await expect(comparisonFooters).toHaveCount(6);

  const thirtyDayResponse = await request.get(
    '/api/admin/analytics/quotes?range=30d'
  );
  expect(thirtyDayResponse.ok()).toBe(true);
  const thirtyDayPayload = (await thirtyDayResponse.json()) as {
    summary: {
      requests: number;
      offersIssued: number;
      acceptedOrConverted: number;
      conversionRate: number;
      quotedValue: number;
      convertedOrderValue: number;
    };
  };
  const expectedThirtyDayValues = new Map([
    ['ponudbe-requests', formatSlInteger(thirtyDayPayload.summary.requests)],
    [
      'ponudbe-offers-issued',
      formatSlInteger(thirtyDayPayload.summary.offersIssued)
    ],
    [
      'ponudbe-accepted-converted',
      formatSlInteger(thirtyDayPayload.summary.acceptedOrConverted)
    ],
    [
      'ponudbe-conversion',
      `${thirtyDayPayload.summary.conversionRate.toFixed(1)} %`
    ],
    [
      'ponudbe-quoted-value',
      formatEuroWithSuffix(thirtyDayPayload.summary.quotedValue)
    ],
    [
      'ponudbe-converted-order-value',
      formatEuroWithSuffix(thirtyDayPayload.summary.convertedOrderValue)
    ]
  ]);

  for (const [focusKey, expectedValue] of expectedThirtyDayValues) {
    const resolvedCard = page.locator(
      `[data-analytics-summary-card="true"][data-focus-key="${focusKey}"]`
    );
    await expect(resolvedCard).toHaveCount(1);
    await expect(
      resolvedCard.locator('[data-analytics-comparison-period="30d"]')
    ).toContainText(expectedValue);
  }

  const quoteCardStyles = await quoteCards.evaluateAll((elements) => elements.map((element) => {
    const cardStyle = getComputedStyle(element);
    const titleStyle = getComputedStyle(element.querySelector('p')!);
    const metricStyle = getComputedStyle(element.querySelectorAll('p')[1]!);
    return {
      height: element.getBoundingClientRect().height,
      borderRadius: cardStyle.borderRadius,
      paddingTop: cardStyle.paddingTop,
      paddingRight: cardStyle.paddingRight,
      paddingBottom: cardStyle.paddingBottom,
      paddingLeft: cardStyle.paddingLeft,
      titleFontSize: titleStyle.fontSize,
      titleFontWeight: titleStyle.fontWeight,
      metricFontSize: metricStyle.fontSize,
      metricFontWeight: metricStyle.fontWeight
    } satisfies CardStyle;
  }));

  for (const quoteCardStyle of quoteCardStyles) {
    expect(Math.abs(quoteCardStyle.height - orderCardStyle.height)).toBeLessThanOrEqual(2);
    expect(quoteCardStyle.borderRadius).toBe(orderCardStyle.borderRadius);
    expect(quoteCardStyle.paddingTop).toBe(orderCardStyle.paddingTop);
    expect(quoteCardStyle.paddingRight).toBe(orderCardStyle.paddingRight);
    expect(quoteCardStyle.paddingBottom).toBe(orderCardStyle.paddingBottom);
    expect(quoteCardStyle.paddingLeft).toBe(orderCardStyle.paddingLeft);
    expect(quoteCardStyle.titleFontSize).toBe(orderCardStyle.titleFontSize);
    expect(quoteCardStyle.titleFontWeight).toBe(orderCardStyle.titleFontWeight);
    expect(quoteCardStyle.metricFontSize).toBe(orderCardStyle.metricFontSize);
    expect(quoteCardStyle.metricFontWeight).toBe(orderCardStyle.metricFontWeight);
  }

  const analyticsResponse = await request.get('/api/admin/analytics/quotes?range=max');
  expect(analyticsResponse.ok()).toBe(true);
  const analyticsPayload = await analyticsResponse.json() as {
    range?: string;
    days?: unknown[];
    summary?: Record<string, unknown>;
  };
  expect(analyticsPayload.range).toBe('max');
  expect(Array.isArray(analyticsPayload.days)).toBe(true);
  expect(analyticsPayload.summary).toEqual(expect.objectContaining({
    requests: expect.any(Number),
    offersIssued: expect.any(Number),
    acceptedOrConverted: expect.any(Number),
    conversionRate: expect.any(Number),
    quotedValue: expect.any(Number),
    convertedOrderValue: expect.any(Number)
  }));

  await quoteCards.filter({ hasText: 'Ponujena vrednost' }).click();
  await expect(page).toHaveURL(/\/admin\/analitika\/ponudbe\?range=max&focus=ponudbe-quoted-value/u);
  await expect(page.getByRole('tab', { name: 'Povpraševanja in ponudbe' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByTestId('admin-quote-analytics-dashboard')).toBeVisible();
  await expect(page.locator('[data-focus-key="ponudbe-quoted-value"]')).toHaveAttribute('data-focused', 'true');
  await expect(page.locator('[data-chart-key="ponudbe-lijak"]')).toBeVisible();
  await expect(page.locator('[data-chart-key="ponudbe-vrednosti"]')).toHaveAttribute('data-focused', 'true');
});
