import { expect, test, type Locator } from '@playwright/test';
import {
  formatEuroWithSuffix,
  formatSlInteger
} from '@/shared/domain/formatting';
import { assertAuthenticatedAdmin } from './support/auth';
import type { BusinessAnalyticsResponse } from '@/shared/domain/analytics/businessAnalytics';

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
  const orderHref = await orderCards.first().getAttribute('href');
  const orderReference = new URL(orderHref!, 'https://example.test');
  const orderResponse = await request.get('/api/admin/analytics/business?view=narocila&range=90D&asOf=' + encodeURIComponent(orderReference.searchParams.get('asOf')!));
  expect(orderResponse.ok()).toBe(true);
  const orderPayload = await orderResponse.json() as BusinessAnalyticsResponse;
  const money = (value: number | null) => value === null ? '—' : formatEuroWithSuffix(value);
  const expectedOrderValues = new Map([
    ['orderCount', formatSlInteger(orderPayload.summary.orderCount)],
    ['activityValue', money(orderPayload.summary.activityValue)],
    ['realisedValue', money(orderPayload.summary.realisedValue)],
    ['realisedCount', formatSlInteger(orderPayload.summary.realisedCount)],
    ['meanOrderValue', money(orderPayload.summary.meanOrderValue)],
    ['medianOrderValue', money(orderPayload.summary.medianOrderValue)]
  ]);
  for (const [key, value] of expectedOrderValues) {
    await expect(page.locator('[data-focus-key="narocila-' + key + '"] p').nth(1)).toHaveText(value);
  }


  await page.goto('/admin/orders?view=quotes');
  await expect(page.getByRole('tab', { name: 'Povpraševanja in ponudbe' })).toHaveAttribute('aria-selected', 'true');
  const quoteCards = page.locator('[data-analytics-summary-card="true"]');
  await expect(quoteCards).toHaveCount(6);
  const comparisonFooters = quoteCards.locator(
    '[data-analytics-comparison-period="30d"]'
  );
  await expect(comparisonFooters).toHaveCount(6);

  const href = await quoteCards.first().getAttribute('href');
  const reference = new URL(href!, 'https://example.test');
  const frozenAsOf = reference.searchParams.get('asOf');
  expect(reference.pathname).toBe('/admin/analitika');
  expect(reference.searchParams.get('view')).toBe('ponudbe');
  expect(reference.searchParams.get('range')).toBe('90D');
  const thirtyDayResponse = await request.get('/api/admin/analytics/business?view=ponudbe&range=30D&asOf=' + encodeURIComponent(frozenAsOf!));
  expect(thirtyDayResponse.ok()).toBe(true);
  const thirtyDayPayload = await thirtyDayResponse.json() as BusinessAnalyticsResponse;
  const quoteSummary = thirtyDayPayload.quotes;
  const hours = (value: number | null) => value === null ? '—' : value.toFixed(1) + ' h';
  const expectedThirtyDayValues = new Map([
    ['ponudbe-issued', formatSlInteger(quoteSummary.mature.total + quoteSummary.immature)],
    ['ponudbe-mature', formatSlInteger(quoteSummary.mature.total)],
    ['ponudbe-accepted', formatSlInteger(quoteSummary.mature.accepted)],
    ['ponudbe-acceptance', quoteSummary.mature.rate === null ? '—' : (100 * quoteSummary.mature.rate).toFixed(1) + ' %'],
    ['ponudbe-response', hours(quoteSummary.responseStatistics.median)],
    ['ponudbe-decision', hours(quoteSummary.decisionStatistics.median)]
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

  await quoteCards.filter({ hasText: 'Mediana do izdaje' }).click();
  await expect(page).toHaveURL(/\/admin\/analitika\?.*view=ponudbe/u);
  await expect(page.getByRole('tab', { name: 'Ponudbe', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('heading', { name: 'Sprejem v 30 dneh od prve izdaje' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Sprejem po začetni vrednosti ponudbe' })).toBeVisible();
  await expect(page).toHaveURL(/range=90D/u);
});
