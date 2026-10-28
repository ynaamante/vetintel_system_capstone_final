import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icons } from '../icons';

const pad = value => String(value).padStart(2, '0');
const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const currentYear = new Date().getFullYear();
const yearOptions = Array.from({ length: 121 }, (_, index) => currentYear - 100 + index);
const weekdayNames = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const appointmentTimePeriods = [
  { id: 'morning', label: 'Morning', hours: '8–12', start: 8, end: 12 },
  { id: 'afternoon', label: 'Afternoon', hours: '12–5', start: 12, end: 17 },
  { id: 'evening', label: 'Evening', hours: '5–8', start: 17, end: 20 },
];
const appointmentTimeSlots = appointmentTimePeriods.flatMap(period =>
  Array.from({ length: (period.end - period.start) * 2 }, (_, index) => {
    const minutes = period.start * 60 + index * 30;
    return {
      value: `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`,
      period: period.id,
    };
  })
);

export function getUnavailableAppointmentTimes(appointments, date, excludeAppointmentId) {
  if (!date || !Array.isArray(appointments)) return [];
  const unavailable = new Set();
  const inactiveStatuses = new Set(['cancelled', 'canceled', 'no_show', 'no-show', 'completed', 'complete', 'archived']);
  appointments.forEach(appointment => {
    if (!appointment || appointment.archived
      || (excludeAppointmentId != null && String(appointment.id) === String(excludeAppointmentId))
      || inactiveStatuses.has(String(appointment.status || '').toLowerCase().replace(/[\s-]+/g, '_'))) return;
    const start = new Date(appointment.start_time || appointment.datetime || appointment.date);
    if (Number.isNaN(start.getTime())) return;
    const localDate = `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`;
    if (localDate !== date) return;
    const startMinute = start.getHours() * 60 + start.getMinutes();
    const duration = Number(appointment.duration_minutes || appointment.duration);
    const explicitEnd = appointment.end_time ? new Date(appointment.end_time) : null;
    const endMinute = explicitEnd && !Number.isNaN(explicitEnd.getTime())
      ? explicitEnd.getHours() * 60 + explicitEnd.getMinutes()
      : startMinute + (Number.isFinite(duration) && duration > 0 ? duration : 30);
    for (const slot of appointmentTimeSlots) {
      const [hour, minute] = slot.value.split(':').map(Number);
      const slotStart = hour * 60 + minute;
      const slotEnd = slotStart + 30;
      if (slotStart < endMinute && slotEnd > startMinute) unavailable.add(slot.value);
    }
  });
  return [...unavailable];
}

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

function formatValue(date, hour, minute, period, mode) {
  if (mode === 'date') return date ? formatDate(date) : '';
  if (hour === '' || minute === '') return '';
  const hour24 = Number(hour) % 12 + (period === 'pm' ? 12 : 0);
  const time = `${pad(hour24)}:${pad(minute)}`;
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
  displayFormat = 'long',
  unavailableTimes = [],
  unavailableLabel = 'another appointment',
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(null);
  const [timePickerTab, setTimePickerTab] = useState('slots');
  const [timePeriod, setTimePeriod] = useState('morning');
  const [internalValue, setInternalValue] = useState(value ?? defaultValue);
  const currentValue = value === undefined ? internalValue : value;
  const [visibleMonth, setVisibleMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [position, setPosition] = useState(null);
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const popoverRef = useRef(null);

  const updatePosition = () => {
    if (mode === 'time') {
      const width = Math.min(488, window.innerWidth - 24);
      const height = popoverRef.current?.getBoundingClientRect().height || 440;
      setPosition({
        top: Math.max(12, (window.innerHeight - height) / 2),
        left: Math.max(12, (window.innerWidth - width) / 2),
        width,
      });
      return;
    }
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
    setDraft(parsed || { date: null, hour: '', minute: '', period: 'am' });
    if (mode === 'time') {
      setTimePickerTab('slots');
      const selectedSlot = appointmentTimeSlots.find(slot => slot.value === currentValue);
      setTimePeriod(selectedSlot?.period || 'morning');
    }
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
  const selectedValue = formatValue(draft?.date, draft?.hour, draft?.minute, draft?.period, mode);
  const selectedTime = draft?.hour24 && draft?.minute ? `${draft.hour24}:${draft.minute}` : '';
  const selectedTimeText = selectedTime
    ? `${Number(draft.hour)}:${draft.minute} ${draft.period.toUpperCase()}`
    : 'Select time';
  const unavailableTimeSet = new Set(unavailableTimes);
  const selectedTimeUnavailable = unavailableTimeSet.has(selectedTime);
  const selectTimeSlot = time => {
    const [hour24, minute] = time.split(':');
    setDraft(previous => ({
      ...previous,
      hour: String((Number(hour24) + 11) % 12 + 1),
      hour24,
      minute,
      period: Number(hour24) >= 12 ? 'pm' : 'am',
    }));
  };
  const updateCustomTime = (field, value) => {
    setDraft(previous => {
      const next = { ...previous, [field]: value };
      if (field === 'hour' || field === 'period') {
        const hour = Number(field === 'hour' ? value : next.hour || 0);
        next.hour24 = pad((hour % 12) + (next.period === 'pm' ? 12 : 0));
      }
      if (field === 'minute' && next.hour) {
        const hour = Number(next.hour);
        next.hour24 = pad((hour % 12) + (next.period === 'pm' ? 12 : 0));
      }
      return next;
    });
  };
  const displayValue = parseValue(currentValue, mode);
  const displayText = displayValue
    ? mode === 'date'
      ? displayFormat === 'input'
        ? `${displayValue.date.getMonth() + 1}/${displayValue.date.getDate()}/${displayValue.date.getFullYear()}`
        : `${monthNames[displayValue.date.getMonth()].slice(0, 3)} ${displayValue.date.getDate()}, ${displayValue.date.getFullYear()}`
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
      {open && createPortal(<>
        <div className="lab-date-time-backdrop" aria-hidden="true" onClick={() => setOpen(false)} />
        <div
          className={`lab-date-time-popover${mode === 'time' ? ' time-only' : ''}`}
          role="dialog"
          aria-label={label}
          ref={popoverRef}
          style={position ? { position: 'fixed', ...position, zIndex: 2100 } : { position: 'fixed', visibility: 'hidden', zIndex: 2100, width: `min(${mode === 'time' ? '488px' : '340px'}, calc(100vw - 16px))`, top: 8, left: 8 }}
        >
        {mode === 'time' && <>
          <div className="lab-date-time-time-header">
            <span>Select time</span>
            <strong>{selectedTimeText}</strong>
          </div>
          <div className="lab-date-time-time-tabs" role="tablist" aria-label="Time selection method">
            <button type="button" role="tab" aria-selected={timePickerTab === 'slots'} onClick={() => setTimePickerTab('slots')}>Quick slots</button>
            <button type="button" role="tab" aria-selected={timePickerTab === 'custom'} onClick={() => setTimePickerTab('custom')}>Custom time</button>
          </div>
          {timePickerTab === 'slots' ? <>
            <div className="lab-date-time-period-tabs" role="tablist" aria-label="Time of day">
              {appointmentTimePeriods.map(period => <button
                type="button"
                role="tab"
                aria-selected={timePeriod === period.id}
                key={period.id}
                onClick={() => setTimePeriod(period.id)}
              ><strong>{period.label}</strong><span>{period.hours}</span></button>)}
            </div>
            <div className="lab-date-time-slot-grid">
              {appointmentTimeSlots.filter(slot => slot.period === timePeriod).map(slot => {
                const unavailable = unavailableTimeSet.has(slot.value);
                const selected = selectedTime === slot.value;
                const hour = Number(slot.value.slice(0, 2));
                const display = `${hour % 12 || 12}:${slot.value.slice(3)} ${hour >= 12 ? 'PM' : 'AM'}`;
                return <button
                  type="button"
                  key={slot.value}
                  disabled={unavailable}
                  aria-pressed={selected}
                  className={selected ? 'selected' : ''}
                  onClick={() => selectTimeSlot(slot.value)}
                >{display}</button>;
              })}
            </div>
          </> : <div className="lab-date-time-custom">
            <div className="lab-date-time-custom-row">
              <span className="lab-date-time-custom-label">Hour</span>
              <div className="lab-date-time-period-toggle" role="group" aria-label="AM or PM">
                {['am', 'pm'].map(period => <button
                  type="button"
                  key={period}
                  aria-pressed={(draft?.period || 'am') === period}
                  onClick={() => updateCustomTime('period', period)}
                >{period.toUpperCase()}</button>)}
              </div>
            </div>
            <div className="lab-date-time-custom-number-grid" role="group" aria-label="Choose hour">
              {Array.from({ length: 12 }, (_, index) => String(index + 1)).map(hour => <button
                type="button"
                key={hour}
                aria-pressed={draft?.hour === hour}
                className={draft?.hour === hour ? 'selected' : ''}
                onClick={() => updateCustomTime('hour', hour)}
              >{hour}</button>)}
            </div>
            <div className="lab-date-time-custom-row lab-date-time-minute-label">
              <span className="lab-date-time-custom-label">Minute <small>to the nearest 5</small></span>
            </div>
            <div className="lab-date-time-custom-number-grid" role="group" aria-label="Choose minute">
              {Array.from({ length: 12 }, (_, index) => pad(index * 5)).map(minute => <button
                type="button"
                key={minute}
                aria-pressed={draft?.minute === minute}
                className={draft?.minute === minute ? 'selected' : ''}
                onClick={() => updateCustomTime('minute', minute)}
              >{minute}</button>)}
            </div>
          </div>}
          {(unavailableTimes.length > 0 || selectedTimeUnavailable) && <div className="lab-date-time-booked-note">
            <span aria-hidden="true" />
            <span>{selectedTimeUnavailable ? `This time is unavailable (${unavailableLabel})` : `Already booked for ${unavailableLabel}`}</span>
          </div>}
        </>}
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
        {mode !== 'date' && mode !== 'time' && <div className="lab-date-time-time">
          <span>Time</span>
          <div className="lab-date-time-time-controls">
            <input
              aria-label="Time"
              type="time"
              value={draft?.hour24 && draft?.minute ? `${draft.hour24}:${draft.minute}` : ''}
              onChange={event => {
                const [hour24 = '', minute = ''] = event.target.value.split(':');
                const hour = hour24 ? String((Number(hour24) + 11) % 12 + 1) : '';
                setDraft(previous => ({
                  ...previous,
                  hour,
                  hour24,
                  minute,
                  period: Number(hour24) >= 12 ? 'pm' : 'am',
                }));
              }}
            />
          </div>
        </div>}
        <div className="lab-date-time-actions">
          {mode !== 'time' && <button type="button" className="clear" onClick={() => { commit(''); setOpen(false); }}>Clear</button>}
          <button type="button" className="cancel" onClick={() => setOpen(false)}>Cancel</button>
          <button type="button" className="apply" disabled={!selectedValue || selectedTimeUnavailable} onClick={() => { commit(selectedValue); setOpen(false); }}>Apply</button>
        </div>
        </div>
      </>, document.body)}
    </div>
  );
}
