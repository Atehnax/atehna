import assert from 'node:assert/strict';
import test from 'node:test';
import { formatSlDate, parseOrderDateInput, toDateInputValue } from '@/shared/domain/order/dateTime';
import { localInstant } from '@/shared/domain/analytics/period';
import { toDateInputValue as tableDateInput } from '@/admin/features/orders/components/adminOrdersTableUtils';

test('historical local midnight and existing UTC timestamps show the same Ljubljana order day in detail and quick edit', () => {
  const cases = [
    ['2024-07-14T22:00:00.000Z', '2024-07-15', '15.07.2024'],
    ['2024-01-14T23:00:00.000Z', '2024-01-15', '15.01.2024'],
    ['2024-07-15T00:00:00.000Z', '2024-07-15', '15.07.2024'],
    ['2024-07-15T22:30:00.000Z', '2024-07-16', '16.07.2024'],
    ['2024-03-30T23:00:00.000Z', '2024-03-31', '31.03.2024'],
    ['2024-10-26T22:00:00.000Z', '2024-10-27', '27.10.2024']
  ];
  const priorTimezone = process.env.TZ;
  try {
    for (const timezone of ['UTC', 'America/Los_Angeles', 'Europe/Ljubljana']) {
      process.env.TZ = timezone;
      for (const [instant, calendar, label] of cases) {
        assert.equal(toDateInputValue(instant), calendar, timezone + ' detail ' + instant);
        assert.equal(tableDateInput(new Date(instant)), calendar, timezone + ' quick edit ' + instant);
        assert.equal(formatSlDate(instant), label);
      }
    }
  } finally {
    if (priorTimezone === undefined) delete process.env.TZ;
    else process.env.TZ = priorTimezone;
  }
});

test('calendar edit roundtrips preserve the displayed day across summer, winter and DST changes', () => {
  for (const day of ['2024-01-15', '2024-07-15', '2024-03-31', '2024-10-27', '2024-02-29']) {
    const [year, month, date] = day.split('-');
    const input = `${date}/${month}/${year}`;
    assert.equal(parseOrderDateInput(input), day);
    assert.equal(parseOrderDateInput(' ' + day + ' '), day);
    const persisted = localInstant(parseOrderDateInput(input)).toISOString();
    assert.equal(toDateInputValue(persisted), day);
    assert.equal(tableDateInput(new Date(persisted)), day);
  }
});

test('invalid calendar input stays invalid instead of becoming another day or today', () => {
  for (const input of ['', '31/02/2024', '2024-02-31', '29/02/2023', '2024-13-01', '2024-00-01', 'not a date']) {
    assert.equal(parseOrderDateInput(input), '');
  }
  assert.equal(toDateInputValue('2024-02-31'), '');
  assert.equal(toDateInputValue('not a date'), '');
  assert.equal(toDateInputValue(new Date(Number.NaN)), '');
  assert.equal(toDateInputValue('2024-07-15'), '2024-07-15');
});
