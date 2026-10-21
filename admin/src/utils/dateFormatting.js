function parseDisplayDate(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const rawValue = String(value);
  const localDateTime = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?\s*(AM|PM)?)?$/i.exec(rawValue);
  if (localDateTime) {
    const [, yearText, monthText, dayText, hourText, minuteText, secondText, millisecondText, meridiem] = localDateTime;
    const year = Number(yearText);
    const month = Number(monthText);
    const day = Number(dayText);
    let hour = hourText ? Number(hourText) : 0;
    const minute = minuteText ? Number(minuteText) : 0;
    const second = secondText ? Number(secondText) : 0;
    const millisecond = millisecondText ? Number(millisecondText.padEnd(3, '0')) : 0;
    if (meridiem) {
      if (hour < 1 || hour > 12) return null;
      hour = (hour % 12) + (meridiem.toUpperCase() === 'PM' ? 12 : 0);
    }
    if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59 || second > 59) return null;
    const localDate = new Date(year, month - 1, day, hour, minute, second, millisecond);
    return localDate.getFullYear() === year
      && localDate.getMonth() === month - 1
      && localDate.getDate() === day
      ? localDate
      : null;
  }
  const date = new Date(rawValue);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDateText(value, locale, fallback = '—') {
  const date = parseDisplayDate(value);
  return date
    ? date.toLocaleDateString(locale, { month: 'long', day: 'numeric', year: 'numeric' })
    : fallback;
}

export function formatDateTimeText(value, locale, fallback = '—') {
  const date = parseDisplayDate(value);
  return date
    ? date.toLocaleString(locale, { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
    : fallback;
}
