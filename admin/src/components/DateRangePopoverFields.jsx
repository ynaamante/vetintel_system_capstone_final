import LabDateTimePicker from './LabDateTimePicker';
import { useState } from 'react';
import { Icons } from '../icons';
import { DATE_RANGE_PRESETS, getDateRangeLabel, getDateRangePreset } from '../utils/dateRangePresets';

export default function DateRangePopoverFields({
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
  sortOrder,
  onSortOrderChange,
  onClear,
  onDone,
  sortLabel = 'Sort order',
  sortNewestLabel = 'Newest to Oldest',
  sortOldestLabel = 'Oldest to Newest',
}) {
  const [customOpen, setCustomOpen] = useState(false);
  const selected = getDateRangeLabel(dateFrom, dateTo);
  const invalidRange = Boolean(dateFrom && dateTo && dateFrom > dateTo);
  if (!customOpen) return <div className="system-date-presets" role="group" aria-label="Date range presets">
    {DATE_RANGE_PRESETS.map(label => <button
      key={label}
      type="button"
      className="system-date-preset"
      aria-pressed={selected === label}
      onClick={() => {
        const [from, to] = getDateRangePreset(label);
        onDateFromChange(from);
        onDateToChange(to);
        onDone?.();
      }}
    ><span>{label}</span>{selected === label && <span className="system-date-preset-check" aria-hidden="true">✓</span>}</button>)}
    <button type="button" className="system-date-preset system-date-custom" aria-pressed={selected === 'Custom Range'} onClick={() => setCustomOpen(true)}>
      <span>{Icons.calendar}Custom Range</span>{selected === 'Custom Range' && <span className="system-date-preset-check" aria-hidden="true">✓</span>}
    </button>
  </div>;
  return <>
    <button type="button" className="system-date-preset-back" onClick={() => setCustomOpen(false)}>‹ Date presets</button>
    <label className="system-date-range-field">From
      <LabDateTimePicker label="Start date" mode="date" value={dateFrom} max={dateTo || undefined} onChange={onDateFromChange} />
    </label>
    <label className="system-date-range-field">To
      <LabDateTimePicker label="End date" mode="date" value={dateTo} min={dateFrom || undefined} onChange={onDateToChange} />
    </label>
    {onSortOrderChange && <label className="system-date-range-field">{sortLabel}
      <select aria-label={sortLabel} value={sortOrder} onChange={event => onSortOrderChange(event.target.value)}>
        <option value="newest">{sortNewestLabel}</option>
        <option value="oldest">{sortOldestLabel}</option>
      </select>
    </label>}
    {invalidRange && <p role="alert">The start date must be on or before the end date.</p>}
    <div className="lab-date-range-actions system-date-range-actions">
      <button type="button" onClick={onClear}>Clear</button>
      <button type="button" onClick={onDone} disabled={invalidRange}>Done</button>
    </div>
  </>;
}
