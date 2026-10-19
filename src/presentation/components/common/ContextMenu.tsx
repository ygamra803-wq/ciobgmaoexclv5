import { useEffect, useState, useRef } from 'react';
import { contextMenu } from '../../../services/ContextMenuService';

export default function ContextMenu() {
  const [menuState, setMenuState] = useState({
    isOpen: false,
    x: 0,
    y: 0,
    title: '',
    items: [],
  });

  const menuRef = useRef(null);

  useEffect(() => {
    const unsubscribe = contextMenu.subscribe((state) => {
      setMenuState(state || { isOpen: false, x: 0, y: 0, title: '', items: [] });
    });

    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        contextMenu.hide();
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        contextMenu.hide();
      }
    };

    const handleScroll = () => {
      contextMenu.hide();
    };

    window.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      unsubscribe();
      window.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  if (!menuState?.isOpen || !menuState?.items || menuState.items.length === 0) {
    return null;
  }

  return (
    <div
      ref={menuRef}
      role="menu"
      aria-orientation="vertical"
      style={{
        position: 'fixed',
        left: `${menuState.x}px`,
        top: `${menuState.y}px`,
        zIndex: 9999,
      }}
      className="w-56 bg-white/95 backdrop-blur-md rounded-xl shadow-xl border border-slate-200/90 py-1.5 text-xs text-slate-700 animate-in fade-in zoom-in-95 duration-100 font-sans select-none"
    >
      {menuState.title && (
        <div className="px-3 py-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 mb-1">
          {menuState.title}
        </div>
      )}

      {menuState.items.map((item, index) => {
        if (item.separator) {
          return <div key={item.id || index} className="my-1 border-t border-slate-100" />;
        }

        return (
          <button
            key={item.id || index}
            type="button"
            role="menuitem"
            disabled={item.disabled}
            onClick={() => {
              if (!item.disabled && item.onClick) {
                item.onClick();
              }
              contextMenu.hide();
            }}
            className={`w-full text-left px-3 py-1.5 flex items-center justify-between gap-2 transition cursor-pointer ${
              item.disabled
                ? 'opacity-40 cursor-not-allowed'
                : item.danger
                ? 'hover:bg-rose-50 text-rose-600 font-medium'
                : 'hover:bg-slate-100/80 text-slate-700 font-medium hover:text-slate-950'
            }`}
          >
            <span className="truncate">{item.label}</span>
            {item.shortcut && (
              <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200/60">
                {item.shortcut}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
