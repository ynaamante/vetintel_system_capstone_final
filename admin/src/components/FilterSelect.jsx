import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export default function FilterSelect({ label, value, options, onChange, className = '' }) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [menuPosition, setMenuPosition] = useState(null);
  const rootRef = useRef(null);
  const menuRef = useRef(null);
  const triggerRef = useRef(null);

  // API-backed filters can briefly receive incomplete values while their
  // parent refreshes. Keep the control renderable instead of letting one bad
  // option unmount the page.
  const safeOptions = Array.isArray(options)
    ? options
      .filter(option => option && typeof option === 'object')
      .map(option => ({
        value: String(option.value ?? ''),
        label: String(option.label ?? option.value ?? ''),
      }))
      .filter(option => option.value)
    : [];
  const normalizedValue = String(value ?? '');
  const selectedIndex = Math.max(0, safeOptions.findIndex(option => option.value === normalizedValue));
  const selectedOption = safeOptions[selectedIndex];
  const menuZIndex = className.includes('lab-date-time-select') ? 2200 : 2000;

  useEffect(() => {
    const closeOnOutsideClick = event => {
      if (!rootRef.current?.contains(event.target) && !menuRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('mousedown', closeOnOutsideClick);
    return () => document.removeEventListener('mousedown', closeOnOutsideClick);
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const updatePosition = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const touchLayout = (className.includes('lab-wizard-filter-select') || className.includes('lab-date-time-select'))
        && window.matchMedia('(pointer: coarse), (max-width: 1024px)').matches;
      const rowHeight = touchLayout ? 50 : 34;
      const menuLimit = touchLayout ? Math.min(400, window.innerHeight * 0.45) : Math.min(260, window.innerHeight * 0.45);
      const menuHeight = Math.min(safeOptions.length * rowHeight + 14, menuLimit);
      const spaceBelow = window.innerHeight - rect.bottom - 12;
      const spaceAbove = rect.top - 12;
      const opensAbove = spaceBelow < Math.min(menuHeight, 180) && spaceAbove > spaceBelow;
      setMenuPosition({
        top: opensAbove ? Math.max(8, rect.top - menuHeight - 5) : rect.bottom + 5,
        left: Math.min(rect.left, window.innerWidth - Math.max(rect.width, 140) - 8),
        width: Math.max(rect.width, 140),
      });
    };
    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [open, safeOptions.length]);

  const openMenu = () => {
    setActiveIndex(selectedIndex);
    setOpen(true);
  };
  const chooseOption = index => {
    const option = safeOptions[index];
    if (!option) return;
    onChange?.(option.value);
    setOpen(false);
    triggerRef.current?.focus();
  };
  const handleKeyDown = event => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!open) {
        openMenu();
        return;
      }
      if (!safeOptions.length) return;
      setActiveIndex(index => (index + (event.key === 'ArrowDown' ? 1 : -1) + safeOptions.length) % safeOptions.length);
    } else if (event.key === 'Home' && open) {
      event.preventDefault();
      setActiveIndex(0);
    } else if (event.key === 'End' && open) {
      event.preventDefault();
      setActiveIndex(Math.max(0, safeOptions.length - 1));
    } else if (event.key === 'Enter' && open) {
      event.preventDefault();
      chooseOption(activeIndex);
    } else if (event.key === 'Escape' && open) {
      event.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
    }
  };

  return (
    <div ref={rootRef} className={`filter-select ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        className="filter-select-trigger"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => open ? setOpen(false) : openMenu()}
        onKeyDown={handleKeyDown}
      >
        <span>{selectedOption?.label || ''}</span>
        <span className="filter-select-chevron" aria-hidden="true" />
      </button>
      {open && menuPosition && safeOptions.length > 0 && createPortal(<div
        className={`filter-select-menu${className ? ` ${className}-menu` : ''}`}
        role="listbox"
        aria-label={label}
        onKeyDown={handleKeyDown}
        ref={menuRef}
        style={{ ...menuPosition, position: 'fixed', zIndex: menuZIndex }}
      >
        {safeOptions.map((option, index) => <button
          key={option.value}
          type="button"
          role="option"
          aria-selected={option.value === normalizedValue}
          className={`filter-select-option${className ? ` ${className}-option` : ''}${index === activeIndex ? ' highlighted' : ''}`}
          onFocus={() => setActiveIndex(index)}
          onMouseEnter={() => setActiveIndex(index)}
          onClick={() => chooseOption(index)}
        >
          {option.label}
        </button>)}
      </div>, document.body)}
    </div>
  );
}
