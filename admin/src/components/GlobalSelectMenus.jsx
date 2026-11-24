import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const enhancedSelect = 'select:not([multiple]):not([size])';

// Keeps native select elements as the form controls, but presents their option
// list with the same accessible, branded menu used by FilterSelect.
export default function GlobalSelectMenus() {
  const [active, setActive] = useState(null);
  const [position, setPosition] = useState(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const menuRef = useRef(null);
  const triggerRef = useRef(null);
  const dialogHost = active?.closest('dialog[open]');
  const menuReady = Boolean(position && active);

  useLayoutEffect(() => {
    const menu = menuRef.current;
    if (!menuReady || !dialogHost || !menu?.showPopover) return undefined;
    menu.showPopover();
    return () => { if (menu.matches(':popover-open')) menu.hidePopover(); };
  }, [menuReady, dialogHost]);

  const options = active ? Array.from(active.options).map((option, index) => ({
    index,
    value: option.value,
    label: option.label || option.textContent || '',
    disabled: option.disabled || option.parentElement?.disabled,
    selected: active.selectedIndex === index,
  })) : [];

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    // The popover keeps its portal host's CSS zoom, while DOMRects use viewport pixels.
    const zoom = (dialogHost || document.body).currentCSSZoom || 1;
    const height = Math.min((options.length * 34 + 10) * zoom, 260 * zoom, window.innerHeight * .45);
    const below = window.innerHeight - rect.bottom - 5;
    const above = rect.top - 5;
    const opensAbove = below < height && above > below;
    const maxHeight = Math.max(0, Math.min(height, opensAbove ? above : below));
    const width = dialogHost ? rect.width : Math.max(rect.width, 140 * zoom);
    setPosition({
      top: (opensAbove ? rect.top - maxHeight - 5 : rect.bottom + 5) / zoom,
      left: (dialogHost ? rect.left : Math.max(8, Math.min(rect.left, window.innerWidth - width - 8))) / zoom,
      width: width / zoom,
      maxHeight: maxHeight / zoom,
    });
  }, [dialogHost, options.length]);

  const open = useCallback(select => {
    if (select.matches(':disabled') || select.multiple || select.size > 1 || !select.options.length) return;
    triggerRef.current = select;
    select.focus();
    setActiveIndex(Math.max(0, select.selectedIndex));
    setActive(select);
  }, []);

  useEffect(() => {
    if (!active) return undefined;
    updatePosition();
    const onScroll = () => updatePosition();
    window.addEventListener('resize', onScroll);
    window.addEventListener('scroll', onScroll, true);
    const onPointerDown = event => {
      if (event.target === triggerRef.current) return;
      if (menuRef.current?.contains(event.target)) return;
      setActive(null);
    };
    const onKeyDown = event => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); setActive(null); triggerRef.current?.focus(); }
      if (['Enter', ' '].includes(event.key) && event.target === triggerRef.current) {
        event.preventDefault(); event.stopImmediatePropagation();
        const option = options[activeIndex];
        if (option) choose(option);
      }
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        event.stopImmediatePropagation();
        setActiveIndex(index => (index + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length);
      }
      if (event.key === 'Home' || event.key === 'End') {
        event.preventDefault(); event.stopImmediatePropagation();
        setActiveIndex(event.key === 'Home' ? 0 : options.length - 1);
      }
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      window.removeEventListener('resize', onScroll);
      window.removeEventListener('scroll', onScroll, true);
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('keydown', onKeyDown, true);
    };
  }, [active, activeIndex, options.length, updatePosition]);

  useEffect(() => {
    const enhance = root => root.querySelectorAll?.(enhancedSelect).forEach(select => select.classList.add('global-native-select'));
    enhance(document);
    const observer = new MutationObserver(records => records.forEach(record => record.addedNodes.forEach(node => {
      if (node.nodeType !== 1) return;
      if (node.matches?.(enhancedSelect)) node.classList.add('global-native-select');
      enhance(node);
    })));
    observer.observe(document.body, { childList: true, subtree: true });
    const onPointerDown = event => {
      const select = event.target.closest?.(enhancedSelect);
      if (!select || select.matches(':disabled') || select.closest('[data-native-select-menu]')) return;
      event.preventDefault();
      event.stopPropagation();
      if (menuRef.current && select === triggerRef.current) {
        setActive(null);
        return;
      }
      open(select);
    };
    const onKeyDown = event => {
      const select = event.target.closest?.(enhancedSelect);
      if (!select || select.matches(':disabled') || (menuRef.current && select === triggerRef.current)) return;
      if (['Enter', ' ', 'ArrowDown', 'ArrowUp'].includes(event.key)) {
        event.preventDefault();
        event.stopPropagation();
        open(select);
      }
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      observer.disconnect();
      document.querySelectorAll('select.global-native-select').forEach(select => select.classList.remove('global-native-select'));
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('keydown', onKeyDown, true);
    };
  }, [open]);

  const choose = option => {
    const select = triggerRef.current;
    if (!select || option.disabled) return;
    select.selectedIndex = option.index;
    select.dispatchEvent(new Event('input', { bubbles: true }));
    select.dispatchEvent(new Event('change', { bubbles: true }));
    setActive(null);
    select.focus();
  };

  if (!active || !position) return null;
  return createPortal(<div
    ref={menuRef}
    className="filter-select-menu global-select-menu"
    popover={dialogHost && typeof HTMLElement.prototype.showPopover === 'function' ? 'manual' : undefined}
    role="listbox"
    aria-label={active.getAttribute('aria-label') || active.labels?.[0]?.textContent?.trim() || 'Options'}
    style={{ position: 'fixed', inset: 'auto', margin: 0, boxSizing: 'border-box', zIndex: 3000, ...position }}
  >{options.map((option, index) => <button
    key={`${option.value}-${option.index}`}
    type="button"
    role="option"
    aria-selected={option.selected}
    aria-disabled={option.disabled || undefined}
    className={`filter-select-option${index === activeIndex ? ' highlighted' : ''}`}
    disabled={option.disabled}
    onMouseEnter={() => setActiveIndex(index)}
    onClick={() => choose(option)}
  >{option.label}</button>)}</div>, dialogHost || document.body);
}
