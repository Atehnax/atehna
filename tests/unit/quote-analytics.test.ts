import assert from 'node:assert/strict';
import test from 'node:test';
import {
  aggregateQuoteAnalyticsRows,
  buildQuoteAnalyticsComparisonWindows,
  type QuoteAnalyticsSourceRow
} from '@/shared/domain/quote/quoteAnalytics';

// These are the request-cohort rows returned after the server query has
// collapsed revisions, acceptance evidence, and connected orders. In
// particular, A contains only its latest issued V2 value, while E and F keep
// their quote acceptances but exclude their non-financial connected orders.
const cohortRows = [
  {
    id: 1,
    createdAt: '2026-08-01T00:00:00.000Z',
    status: 'converted_to_order',
    firstIssuedAt: '2026-08-02T00:00:00.000Z',
    acceptedAt: '2026-08-05T00:00:00.000Z',
    quotedValue: 150,
    convertedOrderValue: 160
  },
  {
    id: 2,
    createdAt: '2026-08-02T00:00:00.000Z',
    status: 'received',
    firstIssuedAt: null,
    acceptedAt: null,
    quotedValue: 0,
    convertedOrderValue: 0
  },
  {
    id: 3,
    createdAt: '2026-08-03T00:00:00.000Z',
    status: 'declined',
    firstIssuedAt: '2026-08-04T00:00:00.000Z',
    acceptedAt: null,
    quotedValue: 200,
    convertedOrderValue: 0
  },
  {
    id: 4,
    createdAt: '2026-08-04T00:00:00.000Z',
    status: 'offer_issued',
    firstIssuedAt: '2026-08-05T00:00:00.000Z',
    acceptedAt: null,
    quotedValue: 300,
    convertedOrderValue: 0
  },
  {
    id: 5,
    createdAt: '2026-08-05T00:00:00.000Z',
    status: 'accepted',
    firstIssuedAt: '2026-08-06T00:00:00.000Z',
    acceptedAt: '2026-08-07T00:00:00.000Z',
    quotedValue: 400,
    // Its connected order is contract-accepted but nonbinding.
    convertedOrderValue: 0
  },
  {
    id: 6,
    createdAt: '2026-08-06T00:00:00.000Z',
    status: 'converted_to_order',
    firstIssuedAt: '2026-08-07T00:00:00.000Z',
    acceptedAt: '2026-08-07T12:00:00.000Z',
    quotedValue: 500,
    // Its connected order is accepted and binding but cancelled.
    convertedOrderValue: 0
  },
  {
    id: 7,
    createdAt: '2026-08-07T00:00:00.000Z',
    status: 'received',
    // Its offer is issued after the cohort as-of boundary, so the server row
    // intentionally contains no issued fact or offered value yet.
    firstIssuedAt: null,
    acceptedAt: null,
    quotedValue: 0,
    convertedOrderValue: 0
  }
] satisfies QuoteAnalyticsSourceRow[];

test('quote analytics comparisons use two adjacent inclusive 30-day UTC windows', () => {
  assert.deepEqual(buildQuoteAnalyticsComparisonWindows('2026-08-29'), {
    anchorTo: '2026-08-29',
    currentFrom: '2026-07-31',
    currentTo: '2026-08-29',
    previousFrom: '2026-07-01',
    previousTo: '2026-07-30'
  });
  assert.throws(
    () => buildQuoteAnalyticsComparisonWindows('29-08-2026'),
    /Invalid quote analytics comparison anchor/u
  );
});

test('quote analytics aggregate a request cohort without double-counting revisions or ineligible orders', () => {
  const analytics = aggregateQuoteAnalyticsRows({
    rows: cohortRows,
    range: 'max',
    from: '2026-08-01',
    to: '2026-08-07'
  });

  assert.equal(analytics.timezone, 'UTC');
  assert.equal(analytics.from, '2026-08-01');
  assert.equal(analytics.to, '2026-08-07');
  assert.equal(analytics.days.length, 7);
  assert.deepEqual(analytics.summary, {
    requests: 7,
    offersIssued: 5,
    acceptedOrConverted: 3,
    declined: 1,
    withdrawn: 0,
    expired: 0,
    conversionRate: 42.86,
    averageRequestToIssueHours: 24,
    averageIssueToAcceptHours: 36,
    quotedValue: 1550,
    convertedOrderValue: 160
  });

  const revisedAndAccepted = analytics.days.find((day) => day.date === '2026-08-01');
  assert.deepEqual(revisedAndAccepted, {
    date: '2026-08-01',
    requests: 1,
    offersIssued: 1,
    acceptedOrConverted: 1,
    declined: 0,
    withdrawn: 0,
    expired: 0,
    quotedValue: 150,
    convertedOrderValue: 160
  });
  assert.equal(
    analytics.days.reduce((sum, day) => sum + day.quotedValue, 0),
    1550,
    'the superseded A/V1 value must not be added to its latest A/V2 value'
  );
});

test('quote analytics return a stable zero summary for an empty cohort', () => {
  const analytics = aggregateQuoteAnalyticsRows({
    rows: [],
    range: '7d',
    from: '2026-08-03',
    to: '2026-08-03'
  });

  assert.equal(analytics.days.length, 1);
  assert.deepEqual(analytics.summary, {
    requests: 0,
    offersIssued: 0,
    acceptedOrConverted: 0,
    declined: 0,
    withdrawn: 0,
    expired: 0,
    conversionRate: 0,
    averageRequestToIssueHours: null,
    averageIssueToAcceptHours: null,
    quotedValue: 0,
    convertedOrderValue: 0
  });
});

test('quote analytics normalize a reversed UTC date range', () => {
  const forward = aggregateQuoteAnalyticsRows({
    rows: cohortRows,
    range: 'max',
    from: '2026-08-01',
    to: '2026-08-07'
  });
  const reversed = aggregateQuoteAnalyticsRows({
    rows: cohortRows,
    range: 'max',
    from: '2026-08-07',
    to: '2026-08-01'
  });

  assert.deepEqual(reversed, forward);
});

test('negative lifecycle durations never pollute quote response-time averages', () => {
  const analytics = aggregateQuoteAnalyticsRows({
    rows: [{
      id: 20,
      createdAt: '2026-08-03T00:00:00.000Z',
      status: 'accepted',
      firstIssuedAt: '2026-08-02T00:00:00.000Z',
      acceptedAt: '2026-08-01T00:00:00.000Z',
      quotedValue: 50,
      convertedOrderValue: 0
    }],
    range: '7d',
    from: '2026-08-01',
    to: '2026-08-07'
  });

  assert.equal(analytics.summary.requests, 1);
  assert.equal(analytics.summary.offersIssued, 1);
  assert.equal(analytics.summary.acceptedOrConverted, 1);
  assert.equal(analytics.summary.averageRequestToIssueHours, null);
  assert.equal(analytics.summary.averageIssueToAcceptHours, null);
});
