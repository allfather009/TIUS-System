'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Calendar, FolderKanban, List, Search, ChevronDown, Check } from 'lucide-react';

interface PayrollViewControlsProps {
  selectedMonth: string;
  onMonthChange: (month: string) => void;
  availableMonths?: Array<{ label: string; value: string; count?: number }>;
  viewMode: 'by-department' | 'flat-list';
  onViewModeChange: (mode: 'by-department' | 'flat-list') => void;
  statusFilter: 'all' | 'finalized' | 'pending';
  onStatusFilterChange: (status: 'all' | 'finalized' | 'pending') => void;
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  counts: {
    all: number;
    finalized: number;
    pending: number;
  };
}

export function PayrollViewControls({
  selectedMonth,
  onMonthChange,
  availableMonths = [],
  viewMode,
  onViewModeChange,
  statusFilter,
  onStatusFilterChange,
  searchQuery,
  onSearchQueryChange,
  counts,
}: PayrollViewControlsProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const currentMonthLabel =
    availableMonths.find((m) => m.value === selectedMonth || m.label === selectedMonth)?.label ||
    selectedMonth;

  return (
    <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
      {/* Left Controls: Search bar */}
      <div className="flex items-center gap-2 w-full xl:w-auto">
        <div className="relative flex-1 xl:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
            placeholder="Filter faculty name, rank..."
            className="w-full h-10 pl-9 pr-4 rounded-xl bg-slate-100 border border-transparent text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#721c3b]/30 focus:bg-white focus:border-slate-200 transition-all"
          />
        </div>
      </div>

      {/* Right Controls: Month selector, View Switcher */}
      <div className="flex items-center gap-3 flex-wrap xl:justify-end">
        {/* Month Selector Dropdown (Interactive Cycle History Selector) */}
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setIsDropdownOpen((prev) => !prev)}
            className="flex items-center gap-2 h-10 px-3.5 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-800 shadow-2xs hover:border-slate-300 transition-colors cursor-pointer select-none"
          >
            <Calendar className="w-4 h-4 text-slate-500" />
            <span>{currentMonthLabel}</span>
            <ChevronDown className={`w-3.5 h-3.5 text-slate-400 ml-1 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {/* Dropdown Menu */}
          {isDropdownOpen && (
            <div className="absolute right-0 top-12 z-40 w-56 bg-white rounded-2xl shadow-xl border border-slate-100 p-1.5 animate-in fade-in zoom-in-95 duration-150">
              <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider font-bold text-slate-400 border-b border-slate-50 mb-1">
                Select Disbursal Cycle
              </div>

              {availableMonths.length === 0 ? (
                <div className="px-3 py-2 text-xs text-slate-500">
                  Current: {selectedMonth}
                </div>
              ) : (
                availableMonths.map((m) => {
                  const isSelected =
                    selectedMonth.toLowerCase().includes(m.label.toLowerCase()) ||
                    selectedMonth === m.value;

                  return (
                    <button
                      key={m.value}
                      type="button"
                      onClick={() => {
                        onMonthChange(m.value);
                        setIsDropdownOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-colors cursor-pointer text-left ${
                        isSelected
                          ? 'bg-[#540225]/10 text-[#540225] font-bold'
                          : 'text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex flex-col">
                        <span>{m.label}</span>
                        {m.count !== undefined && m.count > 0 && (
                          <span className="text-[10px] text-slate-400 font-normal">
                            {m.count} archived {m.count === 1 ? 'record' : 'records'}
                          </span>
                        )}
                      </div>
                      {isSelected && <Check className="w-3.5 h-3.5 text-[#540225]" />}
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* View Switcher: By Department vs Flat Staff List */}
        <div className="flex items-center p-1 rounded-xl bg-slate-100 border border-slate-200/80 text-xs font-semibold">
          <button
            type="button"
            onClick={() => onViewModeChange('by-department')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              viewMode === 'by-department'
                ? 'bg-white text-[#0b1c30] shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FolderKanban className="w-3.5 h-3.5 text-amber-700" />
            <span>By Department</span>
          </button>

          <button
            type="button"
            onClick={() => onViewModeChange('flat-list')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              viewMode === 'flat-list'
                ? 'bg-white text-[#0b1c30] shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <List className="w-3.5 h-3.5 text-slate-500" />
            <span>Flat Staff List</span>
          </button>
        </div>
      </div>
    </div>
  );
}
