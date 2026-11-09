const DAY = /^\d{4}-\d{2}-\d{2}$/;
function validDay(value) {
  if (!DAY.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
function boundary(value, end = false) {
  if (!value) return null;
  if (typeof value !== 'string') throw new Error('Date filters must be valid dates.');
  if (DAY.test(value)) {
    if (!validDay(value)) throw new Error('Date filters must be valid calendar dates.');
    return `${value}T${end ? '23:59:59.999' : '00:00:00'}+08:00`;
  }
  if (!/^\d{4}-\d{2}-\d{2}T/.test(value) || !validDay(value.slice(0, 10)) || Number.isNaN(Date.parse(value))) throw new Error('Date filters must be valid dates.');
  return value;
}
function dateFilters(query = {}) {
  const from = boundary(query.from || query.date_from || query.dateFrom);
  const to = boundary(query.to || query.date_to || query.dateTo, true);
  if (from && to && Date.parse(from) > Date.parse(to)) throw new Error('The start date must be on or before the end date.');
  return { from, to };
}
module.exports = { dateFilters, validDay };
