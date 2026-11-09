import { dateFilterValue } from './dateFilters.js';
export const DATE_RANGE_PRESETS = ['All Dates', 'Today', 'Yesterday', 'Tomorrow', 'This Week', 'This Month'];

const dateValue = date => date.toISOString().slice(0, 10);

export function getDateRangePreset(label, now = new Date()) {
  if (label === 'All Dates') return ['', ''];
  const start = new Date(`${dateFilterValue(now)}T00:00:00Z`);
  const end = new Date(start);
  if (label === 'Yesterday' || label === 'Tomorrow') {
    start.setUTCDate(start.getUTCDate() + (label === 'Yesterday' ? -1 : 1));
    end.setTime(start.getTime());
  } else if (label === 'This Week') {
    start.setUTCDate(start.getUTCDate() - (start.getUTCDay() + 6) % 7);
    end.setTime(start.getTime());
    end.setUTCDate(end.getUTCDate() + 6);
  } else if (label === 'This Month') {
    start.setUTCDate(1);
    end.setUTCMonth(end.getUTCMonth() + 1, 0);
  }
  return [dateValue(start), dateValue(end)];
}

export function getDateRangeLabel(from, to) {
  return DATE_RANGE_PRESETS.find(label => {
    const [start, end] = getDateRangePreset(label);
    return start === (from || '') && end === (to || '');
  }) || 'Custom Range';
}
