'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, Check, Search, X } from 'lucide-react';

export interface CustomSelectOption {
  value: string;
  label: string;
  disabled?: boolean;
  group?: string;
  badge?: string;
  description?: string;
}

export interface CustomSelectGroup {
  group: string;
  options: CustomSelectOption[];
}

export interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: (CustomSelectOption | string)[] | CustomSelectGroup[];
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  triggerClassName?: string;
  menuClassName?: string;
  variant?: 'default' | 'amber';
  searchable?: boolean;
  searchPlaceholder?: string;
  name?: string;
  id?: string;
  placement?: 'auto' | 'bottom' | 'top';
}

export function CustomSelect({
  value,
  onChange,
  options,
  placeholder = '-- Select an option --',
  disabled = false,
  required = false,
  className = '',
  triggerClassName = '',
  menuClassName = '',
  variant = 'default',
  searchable,
  searchPlaceholder = 'Type to search...',
  name,
  id,
  placement = 'auto',
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [menuPlacement, setMenuPlacement] = useState<'bottom' | 'top'>(
    placement === 'top' ? 'top' : 'bottom'
  );
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Normalize options into groups or flat list
  const { normalizedGroups, allFlatOptions } = useMemo(() => {
    if (!options || options.length === 0) {
      return { normalizedGroups: [], allFlatOptions: [] };
    }

    // Check if input is CustomSelectGroup[]
    const isGrouped = typeof options[0] === 'object' && options[0] !== null && 'group' in options[0] && 'options' in options[0];

    if (isGrouped) {
      const groups = options as CustomSelectGroup[];
      const flat: CustomSelectOption[] = [];
      groups.forEach((g) => {
        g.options.forEach((opt) => flat.push({ ...opt, group: g.group }));
      });
      return { normalizedGroups: groups, allFlatOptions: flat };
    }

    // Check if flat options have .group property
    const flatList: CustomSelectOption[] = (options as (CustomSelectOption | string)[]).map((item) => {
      if (typeof item === 'string') {
        return { value: item, label: item };
      }
      return item;
    });

    const groupsMap = new Map<string, CustomSelectOption[]>();
    const ungrouped: CustomSelectOption[] = [];

    flatList.forEach((opt) => {
      if (opt.group) {
        const existing = groupsMap.get(opt.group) || [];
        existing.push(opt);
        groupsMap.set(opt.group, existing);
      } else {
        ungrouped.push(opt);
      }
    });

    if (groupsMap.size > 0) {
      const resultGroups: CustomSelectGroup[] = [];
      if (ungrouped.length > 0) {
        resultGroups.push({ group: '', options: ungrouped });
      }
      groupsMap.forEach((opts, groupName) => {
        resultGroups.push({ group: groupName, options: opts });
      });
      return { normalizedGroups: resultGroups, allFlatOptions: flatList };
    }

    return {
      normalizedGroups: [{ group: '', options: flatList }],
      allFlatOptions: flatList,
    };
  }, [options]);

  // Selected option resolution
  const selectedOption = useMemo(() => {
    return allFlatOptions.find((opt) => opt.value === value);
  }, [allFlatOptions, value]);

  // Auto-enable search if more than 7 options unless explicitly disabled
  const shouldEnableSearch = searchable !== undefined ? searchable : allFlatOptions.length > 7;

  // Filtered options based on search query
  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) return normalizedGroups;

    const q = searchQuery.toLowerCase();
    const result: CustomSelectGroup[] = [];

    normalizedGroups.forEach((g) => {
      const matched = g.options.filter(
        (opt) =>
          opt.label.toLowerCase().includes(q) ||
          opt.value.toLowerCase().includes(q) ||
          (opt.description && opt.description.toLowerCase().includes(q))
      );
      if (matched.length > 0) {
        result.push({ group: g.group, options: matched });
      }
    });

    return result;
  }, [normalizedGroups, searchQuery]);

  // Total filtered options count
  const totalFilteredCount = useMemo(() => {
    return filteredGroups.reduce((acc, g) => acc + g.options.length, 0);
  }, [filteredGroups]);

  // Click outside listener
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Focus search input on open
  useEffect(() => {
    if (isOpen && shouldEnableSearch) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    } else if (!isOpen) {
      setSearchQuery('');
    }
  }, [isOpen, shouldEnableSearch]);

  const computePlacement = (): 'bottom' | 'top' => {
    if (placement === 'top') return 'top';
    if (placement === 'bottom') return 'bottom';
    if (!containerRef.current) return 'bottom';

    const rect = containerRef.current.getBoundingClientRect();
    const estimatedMenuHeight = 240;
    const viewportHeight = window.innerHeight;
    const spaceBelow = viewportHeight - rect.bottom;
    const spaceAbove = rect.top;

    // Find closest scroll parent or modal container
    const parentContainer = containerRef.current.closest<HTMLElement>(
      '.overflow-y-auto, [role="dialog"], .rounded-3xl, .rounded-2xl, form'
    );

    let spaceInContainerBelow = spaceBelow;
    if (parentContainer) {
      const parentRect = parentContainer.getBoundingClientRect();
      spaceInContainerBelow = parentRect.bottom - rect.bottom;
    }

    // If space below in container or viewport is less than estimated menu height, and space above has room
    if (
      (spaceInContainerBelow < estimatedMenuHeight || spaceBelow < estimatedMenuHeight) &&
      spaceAbove > 140
    ) {
      return 'top';
    }
    return 'bottom';
  };

  // Placement calculation (auto flip up if tight below on resize/scroll)
  useEffect(() => {
    if (!isOpen) return;

    if (placement === 'top') {
      setMenuPlacement('top');
      return;
    }
    if (placement === 'bottom') {
      setMenuPlacement('bottom');
      return;
    }

    const updatePlacement = () => {
      setMenuPlacement(computePlacement());
    };

    updatePlacement();
    window.addEventListener('resize', updatePlacement);
    window.addEventListener('scroll', updatePlacement, true);
    return () => {
      window.removeEventListener('resize', updatePlacement);
      window.removeEventListener('scroll', updatePlacement, true);
    };
  }, [isOpen, placement]);

  const handleSelect = (option: CustomSelectOption) => {
    if (option.disabled) return;
    onChange(option.value);
    setIsOpen(false);
  };

  const handleToggle = () => {
    if (disabled) return;
    if (!isOpen) {
      setMenuPlacement(computePlacement());
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  };

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
      if (!isOpen) {
        e.preventDefault();
        setMenuPlacement(computePlacement());
        setIsOpen(true);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  const isAmber = variant === 'amber';
  const isTop = menuPlacement === 'top';

  return (
    <div className={`relative w-full ${isOpen ? 'z-50' : 'z-0'} ${className}`} ref={containerRef}>
      {/* Hidden input for HTML form submission compatibility */}
      {name && (
        <input
          type="hidden"
          name={name}
          value={value}
          required={required && !value}
        />
      )}

      {/* Trigger Button */}
      <button
        type="button"
        id={id}
        onClick={handleToggle}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={`w-full min-h-[44px] h-11 px-3.5 rounded-xl border text-xs font-semibold transition-all flex items-center justify-between gap-2 text-left cursor-pointer select-none outline-none ${
          disabled
            ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
            : isAmber
            ? `bg-white border-amber-300 text-slate-800 hover:border-amber-400 ${
                isOpen ? 'ring-2 ring-amber-500 border-amber-500 shadow-xs' : ''
              }`
            : `bg-slate-50 border-slate-200 text-slate-800 hover:border-slate-300 hover:bg-white ${
                isOpen ? 'ring-2 ring-[#721c3b]/30 border-[#721c3b] bg-white shadow-xs' : ''
              }`
        } ${triggerClassName}`}
      >
        <span className="truncate flex-1">
          {selectedOption ? (
            <span className="text-slate-900 font-semibold">{selectedOption.label}</span>
          ) : (
            <span className="text-slate-400 font-normal">{placeholder}</span>
          )}
        </span>

        <ChevronDown
          className={`w-4 h-4 shrink-0 transition-transform duration-200 ${
            disabled ? 'text-slate-300' : isAmber ? 'text-amber-800' : 'text-slate-400'
          } ${isOpen ? 'rotate-180 text-slate-700' : ''}`}
        />
      </button>

      {/* Dropdown Menu Container */}
      {isOpen && (
        <div
          className={`absolute left-0 right-0 ${
            isTop
              ? 'bottom-full mb-1.5 animate-in fade-in slide-in-from-bottom-2'
              : 'top-full mt-1.5 animate-in fade-in slide-in-from-top-2'
          } bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 overflow-hidden flex flex-col duration-150 ${menuClassName}`}
          role="listbox"
        >
          {/* Optional Search Bar */}
          {shouldEnableSearch && (
            <div className="p-2 border-b border-slate-100 bg-slate-50/70 flex items-center gap-2 shrink-0">
              <Search className="w-3.5 h-3.5 text-slate-400 shrink-0 ml-1" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full text-xs bg-transparent border-none outline-none text-slate-800 placeholder-slate-400 py-1"
                onClick={(e) => e.stopPropagation()}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-200/60"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          )}

          {/* Options List */}
          <div className="max-h-60 overflow-y-auto divide-y divide-slate-50 p-1.5 space-y-0.5">
            {totalFilteredCount === 0 ? (
              <div className="p-4 text-center text-xs text-slate-400">
                No matching options found.
              </div>
            ) : (
              filteredGroups.map((group, gIdx) => (
                <div key={group.group || gIdx} className="space-y-0.5">
                  {group.group && (
                    <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-50/50 rounded-lg mt-1 first:mt-0 select-none">
                      {group.group}
                    </div>
                  )}
                  {group.options.map((opt) => {
                    const isSelected = opt.value === value;
                    const isDisabled = opt.disabled;

                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => handleSelect(opt)}
                        disabled={isDisabled}
                        role="option"
                        aria-selected={isSelected}
                        className={`w-full px-3 py-2.5 rounded-xl text-xs text-left flex items-center justify-between gap-2 transition-all cursor-pointer select-none ${
                          isDisabled
                            ? 'opacity-40 cursor-not-allowed bg-slate-50 text-slate-400'
                            : isSelected
                            ? isAmber
                              ? 'bg-amber-100/90 text-amber-950 font-bold border border-amber-300/80 shadow-2xs'
                              : 'bg-[#540225]/10 text-[#540225] font-bold border border-[#540225]/20 shadow-2xs'
                            : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                        }`}
                      >
                        <div className="flex flex-col min-w-0 flex-1">
                          <span className="truncate">{opt.label}</span>
                          {opt.description && (
                            <span className="text-[10px] text-slate-400 font-normal truncate mt-0.5">
                              {opt.description}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {opt.badge && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-md font-semibold bg-slate-100 text-slate-600">
                              {opt.badge}
                            </span>
                          )}
                          {isSelected && (
                            <Check
                              className={`w-4 h-4 ${
                                isAmber ? 'text-amber-900' : 'text-[#540225]'
                              }`}
                            />
                          )}
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

export { CustomMultiSelect } from './CustomMultiSelect';
export type { CustomMultiSelectProps } from './CustomMultiSelect';
