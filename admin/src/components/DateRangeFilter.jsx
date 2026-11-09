import PropTypes from 'prop-types';
import { useEffect, useRef, useState } from 'react';
import DateRangePopoverFields from './DateRangePopoverFields';
import { Icons } from '../icons';
import { getDateRangeLabel } from '../utils/dateRangePresets';

export default function DateRangeFilter({ dateFrom, dateTo, onDateFromChange, onDateToChange, label = 'Filter by date', emptyLabel, className = '' }) {
  const [open, setOpen] = useState(false);
  const root = useRef(null);
  useEffect(() => {
    if (!open) return;
    const close = event => {
      if (!root.current?.contains(event.target) && !event.target.closest?.('.lab-date-time-popover')) setOpen(false);
    };
    const escape = event => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);
  return <div className={`lab-date-range system-date-filter ${className}`.trim()} ref={root}>
    <button type="button" className="lab-date-range-trigger" aria-label={label} aria-expanded={open} onClick={() => setOpen(value => !value)}>
      <span className="lab-date-range-calendar">{Icons.calendar}</span><span>{!dateFrom && !dateTo && emptyLabel ? emptyLabel : getDateRangeLabel(dateFrom, dateTo)}</span><span className={`lab-date-range-chevron${open ? ' open' : ''}`} aria-hidden="true" />
    </button>
    {open && <div className="lab-date-range-popover system-date-range-popover" role="group" aria-label={label}>
      <DateRangePopoverFields dateFrom={dateFrom} dateTo={dateTo} onDateFromChange={onDateFromChange} onDateToChange={onDateToChange}
        onClear={() => { onDateFromChange(''); onDateToChange(''); }} onDone={() => setOpen(false)} />
    </div>}
  </div>;
}

DateRangeFilter.propTypes = {
  dateFrom: PropTypes.string,
  dateTo: PropTypes.string,
  onDateFromChange: PropTypes.func.isRequired,
  onDateToChange: PropTypes.func.isRequired,
  label: PropTypes.string,
  emptyLabel: PropTypes.string,
  className: PropTypes.string,
};
