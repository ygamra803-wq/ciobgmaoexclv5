import { useState, useRef, useEffect, useMemo, useCallback, isValidElement } from 'react';
import { ChevronDown, Check, Search, X, Plus } from 'lucide-react';

const renderIconHelper = (Icon, className = '') => {
  if (!Icon) return null;
  if (isValidElement(Icon)) return Icon;
  const Component = Icon;
  return <Component className={className} />;
};

/**
 * CustomSelect - Reusable styled dropdown component for CIOB GMAO Light
 *
 * Supports:
 * - Flat options: [{ value, label, sublabel, icon, badge, badgeColor, disabled }]
 * - Grouped options: [{ group: 'Group Name', options: [...] }] or options with `group` property
 * - Primitives: ['Option 1', 'Option 2']
 * - Optional inline search filtering (always sticky on top)
 * - Optional sticky "+ Nouveau / Créer" button on top under search
 * - Click-outside & Keyboard navigation (Escape, Enter, Arrows)
 * - Custom trigger and dropdown styling
 */
export default function CustomSelect({
  value,
  onChange,
  options = [],
  placeholder = 'Sélectionner...',
  disabled = false,
  searchable = undefined, // auto-enabled if options.length > 5 or true
  className = '',
  dropdownClassName = '',
  id,
  name,
  required = false,
  prefixIcon: PrefixIcon = null,
  prefixIconClassName = '',
  compact = false,
  align = 'left', // 'left' | 'right'
  onAddNew = null, // Function to trigger when clicking "Ajouter / Créer"
  addNewLabel = 'Nouveau / Ajouter', // Label for the create button
  addNewIcon: AddNewIcon = Plus,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  const containerRef = useRef(null);
  const triggerRef = useRef(null);
  const searchInputRef = useRef(null);
  const listRef = useRef(null);

  // Normalize options into a uniform flat list with group metadata
  const normalizedOptions = useMemo(() => {
    const result = [];

    // Check if options is an array of groups: [{ group: 'Title', options: [...] }]
    if (options.length > 0 && options[0]?.group && Array.isArray(options[0]?.options)) {
      options.forEach((grp) => {
        grp.options.forEach((opt) => {
          if (typeof opt === 'object' && opt !== null) {
            result.push({
              ...opt,
              group: grp.group,
              value:
                opt.value !== undefined
                  ? opt.value
                  : opt.id ||
                    opt.id_zone ||
                    opt.id_type ||
                    opt.id_machine_registered ||
                    opt.id_technician ||
                    opt.id_operation ||
                    opt.nom ||
                    opt.ref ||
                    opt.libelle,
              label:
                opt.label ||
                opt.designation ||
                opt.nom ||
                opt.libelle ||
                (opt.ref ? `[${opt.ref}] ${opt.designation || ''}` : String(opt.value || '')),
            });
          } else {
            result.push({
              value: opt,
              label: String(opt),
              group: grp.group,
            });
          }
        });
      });
      return result;
    }

    // Otherwise standard array of objects or primitives
    options.forEach((opt) => {
      if (typeof opt === 'object' && opt !== null) {
        result.push({
          ...opt,
          value:
            opt.value !== undefined
              ? opt.value
              : opt.id ||
                opt.id_zone ||
                opt.id_type ||
                opt.id_machine_registered ||
                opt.id_technician ||
                opt.id_operation ||
                opt.nom ||
                opt.ref ||
                opt.libelle,
          label:
            opt.label ||
            opt.designation ||
            opt.nom ||
            opt.libelle ||
            (opt.ref ? `[${opt.ref}] ${opt.designation || ''}` : String(opt.value || '')),
        });
      } else {
        result.push({
          value: opt,
          label: String(opt),
        });
      }
    });

    return result;
  }, [options]);

  // Determine if search should be enabled
  const shouldEnableSearch =
    searchable !== undefined ? searchable : normalizedOptions.length > 5 || Boolean(onAddNew);

  // Filter options by search query
  const filteredOptions = useMemo(() => {
    if (!searchQuery.trim()) return normalizedOptions;
    const q = searchQuery.toLowerCase().trim();
    return normalizedOptions.filter((opt) => {
      const matchLabel = String(opt.label || '')
        .toLowerCase()
        .includes(q);
      const matchValue = String(opt.value || '')
        .toLowerCase()
        .includes(q);
      const matchSublabel = String(opt.sublabel || '')
        .toLowerCase()
        .includes(q);
      const matchGroup = String(opt.group || '')
        .toLowerCase()
        .includes(q);
      return matchLabel || matchValue || matchSublabel || matchGroup;
    });
  }, [normalizedOptions, searchQuery]);

  // Find currently selected option
  const selectedOption = useMemo(() => {
    return normalizedOptions.find((opt) => String(opt.value) === String(value));
  }, [normalizedOptions, value]);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
        setSearchQuery('');
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isOpen]);

  // Focus search input on open
  useEffect(() => {
    if (isOpen && shouldEnableSearch && searchInputRef.current) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen, shouldEnableSearch]);

  // Focus trigger on close
  const prevIsOpenRef = useRef(isOpen);
  useEffect(() => {
    if (!isOpen && prevIsOpenRef.current && !disabled) {
      triggerRef.current?.focus();
    }
    prevIsOpenRef.current = isOpen;
  }, [isOpen, disabled]);

  const handleSelect = useCallback((opt) => {
    if (opt.disabled) return;
    onChange(opt.value);
    setIsOpen(false);
    setSearchQuery('');
    setHighlightedIndex(-1);
  }, [onChange]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e) => {
    if (disabled) return;

    if (!isOpen) {
      if (e.key === 'Enter' || e.key === 'ArrowDown' || e.key === ' ' || e.key === 'ArrowUp') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    switch (e.key) {
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        setSearchQuery('');
        break;
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex((prev) => (prev < filteredOptions.length - 1 ? prev + 1 : 0));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : filteredOptions.length - 1));
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
          handleSelect(filteredOptions[highlightedIndex]);
        }
        break;
      default:
        break;
    }
  }, [disabled, isOpen, filteredOptions, highlightedIndex, handleSelect]);

  // Group filtered options by group name for rendering
  const groupedSections = useMemo(() => {
    const hasGroups = filteredOptions.some((opt) => opt.group);
    if (!hasGroups) {
      return [{ group: null, items: filteredOptions }];
    }

    const map = new Map();
    filteredOptions.forEach((opt) => {
      const g = opt.group || 'Général';
      if (!map.has(g)) {
        map.set(g, []);
      }
      map.get(g).push(opt);
    });

    return Array.from(map.entries()).map(([group, items]) => ({ group, items }));
  }, [filteredOptions]);

  return (
    <div
      ref={containerRef}
      className={`relative inline-block w-full text-xs text-left ${className}`}
      onKeyDown={handleKeyDown}
      id={id}
    >
      {/* Hidden native input for form compatibility */}
      {name && <input type="hidden" name={name} value={value ?? ''} required={required} />}

      {/* Trigger Button */}
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={`w-full flex items-center justify-between gap-2 px-3 rounded-xl border transition-all text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 ${
          compact ? 'h-8 py-1' : 'h-9 py-1.5'
        } ${
          disabled
            ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
            : isOpen
              ? 'bg-white border-indigo-400 ring-2 ring-indigo-500/10 shadow-xs text-slate-900'
              : 'bg-slate-50 hover:bg-slate-100/80 border-slate-200 hover:border-slate-300 text-slate-800'
        }`}
      >
        <div className="flex items-center gap-2 truncate text-left flex-1 min-w-0">
          {PrefixIcon && (
            <span className="shrink-0 flex items-center justify-center">
              {renderIconHelper(PrefixIcon, `w-3.5 h-3.5 ${prefixIconClassName || 'text-slate-400'}`)}
            </span>
          )}
          {selectedOption?.icon && (
            <span className="shrink-0 flex items-center justify-center">
              {renderIconHelper(selectedOption.icon, 'w-3.5 h-3.5')}
            </span>
          )}
          {selectedOption ? (
            <span className="truncate text-slate-900 font-semibold">{selectedOption.label}</span>
          ) : (
            <span className="text-slate-400 truncate">{placeholder}</span>
          )}
          {selectedOption?.badge !== undefined && selectedOption?.badge !== null && (
            <span
              className={`text-[10px] font-mono px-1.5 py-0.2 rounded shrink-0 font-bold ${
                selectedOption.badgeColor || 'bg-slate-200 text-slate-700'
              }`}
            >
              {selectedOption.badge}
            </span>
          )}
        </div>

        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-indigo-600' : ''
          }`}
        />
      </button>

      {/* Dropdown Menu Popup */}
      {isOpen && (
        <div
          className={`absolute z-[70] mt-1.5 w-full min-w-[220px] bg-white rounded-xl border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100 ${
            align === 'right' ? 'right-0' : 'left-0'
          } ${dropdownClassName}`}
        >
          {/* Sticky Header: Search Bar & Sticky Add Button */}
          <div className="p-2 border-b border-slate-100 bg-slate-50/90 space-y-1.5">
            {/* Search Input Bar */}
            {shouldEnableSearch && (
              <div className="relative flex items-center">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 pointer-events-none" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Rechercher..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setHighlightedIndex(0);
                  }}
                  className="w-full h-7 pl-8 pr-7 bg-white rounded-lg border border-slate-200 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 text-slate-400 hover:text-slate-600 p-0.5 rounded"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            )}

            {/* Sticky "+ Nouveau / Ajouter" Button attached directly inside the dropdown */}
            {onAddNew && (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsOpen(false);
                  onAddNew();
                }}
                className="w-full h-7 px-2.5 rounded-lg bg-indigo-50 hover:bg-indigo-100/90 border border-indigo-200 text-indigo-700 hover:text-indigo-900 font-bold text-[11px] flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
              >
                {renderIconHelper(AddNewIcon, "w-3.5 h-3.5 shrink-0")}
                <span className="truncate">{addNewLabel}</span>
              </button>
            )}
          </div>

          {/* Options List */}
          <div ref={listRef} className="max-h-56 overflow-y-auto p-1 space-y-0.5" role="listbox">
            {filteredOptions.length === 0 ? (
              <div className="py-4 px-3 text-center text-xs text-slate-400">
                <div>Aucun résultat trouvé pour "{searchQuery}"</div>
                {onAddNew && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setIsOpen(false);
                      onAddNew();
                    }}
                    className="mt-2 text-xs font-bold text-indigo-600 hover:text-indigo-800 underline cursor-pointer"
                  >
                    {addNewLabel}
                  </button>
                )}
              </div>
            ) : (
              groupedSections.map((section, sIdx) => (
                <div key={section.group || `sec-${sIdx}`} className="space-y-0.5">
                  {section.group && (
                    <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-50/50 rounded-md">
                      {section.group}
                    </div>
                  )}
                  {section.items.map((opt, oIdx) => {
                    const isSelected = String(opt.value) === String(value);
                    return (
                      <button
                        key={opt.key || `${String(opt.value)}_${oIdx}`}
                        type="button"
                        disabled={opt.disabled}
                        onClick={() => handleSelect(opt)}
                        className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-left transition-colors text-xs ${
                          opt.disabled
                            ? 'opacity-40 cursor-not-allowed text-slate-400'
                            : isSelected
                              ? 'bg-indigo-50 text-indigo-950 font-bold'
                              : 'hover:bg-slate-100/80 text-slate-700 font-medium'
                        }`}
                        role="option"
                        aria-selected={isSelected}
                      >
                        <div className="flex items-center gap-2 truncate flex-1 min-w-0">
                          {opt.icon && (
                            <span className="shrink-0 flex items-center justify-center">
                              {renderIconHelper(opt.icon, "w-3.5 h-3.5")}
                            </span>
                          )}
                          <div className="truncate flex-1">
                            <div className="truncate">{opt.label}</div>
                            {opt.sublabel && (
                              <div className="text-[10px] text-slate-400 truncate">
                                {opt.sublabel}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {opt.badge !== undefined && opt.badge !== null && (
                            <span
                              className={`text-[9.5px] font-mono px-1.5 py-0.2 rounded font-bold ${
                                opt.badgeColor || 'bg-slate-200/70 text-slate-700'
                              }`}
                            >
                              {opt.badge}
                            </span>
                          )}
                          {isSelected && <Check className="w-3.5 h-3.5 text-indigo-600 shrink-0" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
