import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icons } from '../icons';

const pad = value => String(value).padStart(2, '0');
const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const currentYear = new Date().getFullYear();
const yearOptions = Array.from({ length: 121 }, (_, index) => currentYear - 100 + index);
const weekdayNames = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
function parseValue(value, mode) {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || '');
  if (mode === 'date') return dateMatch ? { date: new Date(Number(dateMatch[1]), Number(dateMatch[2]) - 1, Number(dateMatch[3])), hour: '', minute: '', period: '' } : null;
  const timeMatch = /^(\d{2}):(\d{2})$/.exec(value || '');
  if (mode === 'time') {
    if (!timeMatch) return null;
    const hour24 = Number(timeMatch[1]);
    return { date: null, hour: String((hour24 + 11) % 12 + 1), hour24: timeMatch[1], minute: timeMatch[2], period: hour24 >= 12 ? 'pm' : 'am' };
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value || '');
  if (!match) return null;
  const [, year, month, day, hour, minute] = match;
  return {
    date: new Date(Number(year), Number(month) - 1, Number(day)),
    hour: String((Number(hour) + 11) % 12 + 1),
    hour24: hour,
    minute,
    period: Number(hour) >= 12 ? 'pm' : 'am',
  };
}

function formatDate(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function formatValue(date, hour, minute, mode) {
  if (mode === 'date') return date ? formatDate(date) : '';
  if (hour === '' || minute === '') return '';
  const time = `${pad(hour)}:${pad(minute)}`;
  if (mode === 'time') return time;
  return date ? `${formatDate(date)}T${time}` : '';
}

export default function LabDateTimePicker({
  label,
  value,
  defaultValue = '',
  onChange,
  className = '',
  style,
  name,
  required = false,
  min,
  max,
  mode = 'datetime',
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(null);
  const [internalValue, setInternalValue] = useState(value ?? defaultValue);
  const currentValue = value === undefined ? internalValue : value;
  const [visibleMonth, setVisibleMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [position, setPosition] = useState(null);
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const popoverRef = useRef(null);

  const updatePosition = () => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const width = Math.min(340, window.innerWidth - 16);
    const height = popoverRef.current?.getBoundingClientRect().height || 380;
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
    const top = rect.bottom + height + 8 <= window.innerHeight ? rect.bottom + 6 : Math.max(8, rect.top - height - 6);
    setPosition({ top, left, width });
  };

  useEffect(() => {
    if (!open) return undefined;
    const closeOutside = event => {
      if (event.target.closest?.('.filter-select-menu')) return;
      if (!rootRef.current?.contains(event.target) && !popoverRef.current?.contains(event.target)) setOpen(false);
    };
    const closeEscape = event => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', closeOutside);
    document.addEventListener('touchstart', closeOutside, { passive: true });
    document.addEventListener('keydown', closeEscape);
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      document.removeEventListener('mousedown', closeOutside);
      document.removeEventListener('touchstart', closeOutside);
      document.removeEventListener('keydown', closeEscape);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [open]);

  useEffect(() => { if (open) updatePosition(); }, [open, visibleMonth]);

  const openPicker = () => {
    const parsed = parseValue(currentValue, mode);
    const date = parsed?.date || new Date();
    setDraft(parsed ? { ...parsed, hour: parsed.hour24 ?? parsed.hour } : { date: null, hour: '', minute: '' });
    if (mode !== 'time') setVisibleMonth(new Date(date.getFullYear(), date.getMonth(), 1));
    setPosition(null);
    setOpen(true);
  };

  const commit = nextValue => {
    setInternalValue(nextValue);
    onChange?.(nextValue);
  };
  const calendarStart = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1);
  const startOffset = calendarStart.getDay();
  const daysInMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 0).getDate();
  const calendarDays = Array.from({ length: Math.ceil((startOffset + daysInMonth) / 7) * 7 }, (_, index) => {
    const day = index - startOffset + 1;
    return day > 0 && day <= daysInMonth ? new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), day) : null;
  });
  const selectedValue = formatValue(draft?.date, draft?.hour, draft?.minute, mode);
  const displayValue = parseValue(currentValue, mode);
  const displayText = displayValue
    ? mode === 'date'
      ? `${monthNames[displayValue.date.getMonth()].slice(0, 3)} ${displayValue.date.getDate()}, ${displayValue.date.getFullYear()}`
      : mode === 'time'
        ? `${Number(displayValue.hour)}:${displayValue.minute} ${displayValue.period.toUpperCase()}`
        : `${monthNames[displayValue.date.getMonth()].slice(0, 3)} ${displayValue.date.getDate()}, ${displayValue.date.getFullYear()} · ${Number(displayValue.hour)}:${displayValue.minute} ${displayValue.period.toUpperCase()}`
    : '';
  const dateAllowed = date => {
    const dateValue = formatDate(date);
    return (!min || dateValue >= min) && (!max || dateValue <= max);
  };

  return (
    <div className={`lab-date-time-picker ${className}`} ref={rootRef}>
      <button
        className="lab-date-time-trigger"
        type="button"
        style={style}
        ref={triggerRef}
        aria-label={label}
        aria-required={required || undefined}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => open ? setOpen(false) : openPicker()}
      >
        {Icons.calendar}
        <span className={displayText ? '' : 'placeholder'}>{displayText || (mode === 'date' ? 'Select date' : mode === 'time' ? 'Select time' : 'Select date & time')}</span>
      </button>
      {name && <input type="hidden" name={name} value={currentValue || ''} />}
      {open && createPortal(<div
        className={`lab-date-time-popover${mode === 'time' ? ' time-only' : ''}`}
        role="dialog"
        aria-label={label}
        ref={popoverRef}
        style={position ? { position: 'fixed', ...position, zIndex: 2100 } : { position: 'fixed', visibility: 'hidden', zIndex: 2100, width: 'min(340px, calc(100vw - 16px))', top: 8, left: 8 }}
      >
        {mode !== 'time' && <>
          <div className="lab-date-time-calendar-header">
            <button type="button" aria-label="Previous month" onClick={() => setVisibleMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1))}>‹</button>
            <div className="lab-date-time-month-year">
              <select aria-label="Choose month" value={visibleMonth.getMonth()} onChange={event => setVisibleMonth(new Date(visibleMonth.getFullYear(), Number(event.target.value), 1))}>
                {monthNames.map((month, index) => <option key={month} value={index}>{month}</option>)}
              </select>
              <select aria-label="Choose year" value={visibleMonth.getFullYear()} onChange={event => setVisibleMonth(new Date(Number(event.target.value), visibleMonth.getMonth(), 1))}>
                {yearOptions.map(year => <option key={year} value={year}>{year}</option>)}
              </select>
            </div>
            <button type="button" aria-label="Next month" onClick={() => setVisibleMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1))}>›</button>
          </div>
          <div className="lab-date-time-calendar-grid" role="grid" aria-label={monthNames[visibleMonth.getMonth()]}>
            {weekdayNames.map(day => <span className="weekday" key={day} role="columnheader">{day}</span>)}
            {calendarDays.map((day, index) => {
              if (!day) return <span className="empty-day" key={`empty-${index}`} role="gridcell" />;
              const isSelected = draft?.date && day.toDateString() === draft.date.toDateString();
              const isToday = day.toDateString() === new Date().toDateString();
              return <button
                key={day.toISOString()}
                type="button"
                role="gridcell"
                aria-label={day.toLocaleDateString('en-US', { dateStyle: 'full' })}
                aria-pressed={Boolean(isSelected)}
                className={`${isSelected ? 'selected' : ''}${isToday ? ' today' : ''}`}
                disabled={!dateAllowed(day)}
                onClick={() => setDraft(previous => ({ ...previous, date: day }))}
              >{day.getDate()}</button>;
            })}
          </div>
        </>}
        {mode !== 'date' && <div className="lab-date-time-time">
          <span>Time</span>
          <div>
            <input
              className="lab-date-time-time-input"
              aria-label="Time"
              type="time"
              step="60"
              value={draft?.hour !== '' && draft?.minute !== '' ? `${pad(draft.hour)}:${pad(draft.minute)}` : ''}
              onChange={event => {
                const [hour = '', minute = ''] = event.target.value.split(':');
                setDraft(previous => ({ ...previous, hour, minute }));
              }}
            />
          </div>
        </div>}
        <div className="lab-date-time-actions">
          <button type="button" className="clear" onClick={() => { commit(''); setOpen(false); }}>Clear</button>
          <button type="button" className="cancel" onClick={() => setOpen(false)}>Cancel</button>
          <button type="button" className="apply" disabled={!selectedValue} onClick={() => { commit(selectedValue); setOpen(false); }}>Apply</button>
        </div>
      </div>, document.body)}
    </div>
  );
}
