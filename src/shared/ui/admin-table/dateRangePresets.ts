export const DATE_RANGE_PRESETS = [
  { key: '7d', label: 'Zadnjih 7d', days: 7 },
  { key: '30d', label: 'Zadnjih 30d', days: 30 },
  { key: '90d', label: 'Zadnjih 90d', days: 90 },
  { key: '180d', label: 'Zadnjih 180d', days: 180 },
  { key: '365d', label: 'Zadnjih 365d', days: 365 },
  { key: 'ytd', label: 'Letos', days: null }
] as const;

type DateRangePresetKey = (typeof DATE_RANGE_PRESETS)[number]['key'];

const toDateInputValue = (date: Date) => date.toISOString().slice(0, 10);

const shiftDateByDays = (baseDate: Date, days: number) => {
  const nextDate = new Date(baseDate);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
};

export const getQuickDateRange = (presetKey: DateRangePresetKey) => {
  const now = new Date();
  if (presetKey === 'ytd') {
    return { from: `${now.getFullYear()}-01-01`, to: toDateInputValue(now) };
  }

  const preset = DATE_RANGE_PRESETS.find((entry) => entry.key === presetKey);
  const days = preset?.days ?? 30;
  return { from: toDateInputValue(shiftDateByDays(now, -days + 1)), to: toDateInputValue(now) };
};
