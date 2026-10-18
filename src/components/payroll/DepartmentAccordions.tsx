'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Banknote, Search } from 'lucide-react';
import { DepartmentPayrollGroup, PayrollFacultyRow } from '@/types/payroll';
import { TeacherLogsModal } from './TeacherLogsModal';

interface DepartmentAccordionsProps {
  departments: DepartmentPayrollGroup[];
  viewMode: 'by-department' | 'flat-list';
  searchQuery: string;
  statusFilter: 'all' | 'finalized' | 'pending';
  selectedRowIds: Set<string>;
  onToggleRow: (id: string) => void;
  onToggleAllRows?: (allRowIds: string[]) => void;
  onViewLogs?: (row: PayrollFacultyRow) => void;
  currency?: 'USD' | 'IQD';
  exchangeRate?: number;
}

export function DepartmentAccordions({
  departments,
  viewMode,
  searchQuery,
  statusFilter,
  selectedRowIds,
  onToggleRow,
  onToggleAllRows,
  onViewLogs,
  currency = 'USD',
  exchangeRate = 150000,
}: DepartmentAccordionsProps) {
  // Track expanded state of each department accordion
  const [expandedDepts, setExpandedDepts] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    departments.forEach((d) => {
      initial[d.id] = d.isInitiallyExpanded ?? true;
    });
    return initial;
  });

  // Modal state for viewing itemized logs
  const [activeFacultyForLogs, setActiveFacultyForLogs] = useState<PayrollFacultyRow | null>(null);

  const handleOpenLogs = (row: PayrollFacultyRow) => {
    if (onViewLogs) {
      onViewLogs(row);
    }
    setActiveFacultyForLogs(row);
  };

  const toggleDept = (deptId: string) => {
    setExpandedDepts((prev) => ({
      ...prev,
      [deptId]: !prev[deptId],
    }));
  };

  const fmtRate = (rate: number, isGross = false) => {
    if (currency === 'IQD') {
      const converted = rate * (exchangeRate / 100);
      return `IQD ${converted.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
    }
    return `$${rate.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
  };

  // Helper for avatar colors
  const getAvatarClass = (color: string) => {
    switch (color) {
      case 'pink':
        return 'bg-pink-100 text-pink-700 ring-pink-200';
      case 'blue':
        return 'bg-blue-100 text-blue-700 ring-blue-200';
      case 'yellow':
        return 'bg-amber-100 text-amber-800 ring-amber-200';
      case 'purple':
        return 'bg-purple-100 text-purple-700 ring-purple-200';
      case 'emerald':
        return 'bg-emerald-100 text-emerald-800 ring-emerald-200';
      default:
        return 'bg-slate-100 text-slate-700 ring-slate-200';
    }
  };

  // Filter helper for rows
  const filterRow = (row: PayrollFacultyRow) => {
    // Search filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matches =
        row.name.toLowerCase().includes(q) ||
        row.email.toLowerCase().includes(q) ||
        (row.academicRank && row.academicRank.toLowerCase().includes(q)) ||
        (row.departmentName && row.departmentName.toLowerCase().includes(q));
      if (!matches) return false;
    }

    // Status filter
    if (statusFilter === 'finalized') {
      return row.status === 'Finalized' || row.status === 'Paid' || row.status === 'Approved';
    }
    if (statusFilter === 'pending') {
      return row.status === 'Pending Disbursal';
    }

    return true;
  };

  // Handle department-level select all
  const handleToggleDeptRows = (rows: PayrollFacultyRow[]) => {
    if (!onToggleAllRows) {
      rows.forEach((r) => onToggleRow(r.id));
      return;
    }
    const allSelected = rows.every((r) => selectedRowIds.has(r.id));
    if (allSelected) {
      // Unselect all in this department
      const remaining = Array.from(selectedRowIds).filter((id) => !rows.some((r) => r.id === id));
      onToggleAllRows(remaining);
    } else {
      // Select all in this department
      const merged = Array.from(new Set([...Array.from(selectedRowIds), ...rows.map((r) => r.id)]));
      onToggleAllRows(merged);
    }
  };

  // Flat staff list view
  if (viewMode === 'flat-list') {
    const allRows: Array<PayrollFacultyRow & { departmentTitle: string }> = [];
    departments.forEach((dept) => {
      dept.rows.forEach((row) => {
        if (filterRow(row)) {
          allRows.push({ ...row, departmentTitle: dept.name });
        }
      });
    });

    const isAllFlatSelected = allRows.length > 0 && allRows.every((r) => selectedRowIds.has(r.id));

    return (
      <>
        <div className="bg-white rounded-2xl shadow-xs border border-slate-100 overflow-hidden">
          <div className="p-4 px-6 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-headline font-bold text-sm text-[#0b1c30]">
              Flat Staff List Across All University Faculties
            </h3>
            <span className="text-xs text-slate-500 font-medium">
              Showing {allRows.length} teaching staff records
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#eff4ff]/60 border-b border-slate-100 text-[11px] uppercase tracking-wider text-slate-400 font-bold">
                  <th className="py-3 px-4 w-12 text-center">
                    <input
                      type="checkbox"
                      aria-label="Select all rows"
                      checked={isAllFlatSelected}
                      onChange={() => handleToggleDeptRows(allRows)}
                      className="w-4 h-4 rounded border-slate-300 text-[#540225] focus:ring-[#721c3b] cursor-pointer"
                    />
                  </th>
                  <th className="py-3 px-6">Faculty Member</th>
                  <th className="py-3 px-4">Department</th>
                  <th className="py-3 px-4">Contract Type</th>
                  <th className="py-3 px-4">Approved Rate</th>
                  <th className="py-3 px-4">Billed Hours</th>
                  <th className="py-3 px-4">Calculated Gross</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-6 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {allRows.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400">
                      No faculty records match your criteria.
                    </td>
                  </tr>
                ) : (
                  allRows.map((row) => (
                    <tr
                      key={row.id}
                      className={`hover:bg-slate-50/70 transition-colors ${
                        selectedRowIds.has(row.id) ? 'bg-[#540225]/5' : ''
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="py-3.5 px-4 text-center">
                        <input
                          type="checkbox"
                          aria-label={`Select ${row.name}`}
                          checked={selectedRowIds.has(row.id)}
                          onChange={() => onToggleRow(row.id)}
                          className="w-4 h-4 rounded border-slate-300 text-[#540225] focus:ring-[#721c3b] cursor-pointer"
                        />
                      </td>

                      {/* Faculty Member */}
                      <td className="py-3 px-6">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs ring-2 shrink-0 ${getAvatarClass(
                              row.avatarBgColor
                            )}`}
                          >
                            {row.avatarInitials}
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="font-bold text-[#0b1c30] truncate">{row.name}</span>
                            <span className="text-[11px] text-slate-500 truncate">{row.email}</span>
                          </div>
                        </div>
                      </td>

                      {/* Department */}
                      <td className="py-3 px-4 text-slate-700 font-medium truncate max-w-[200px]">
                        {row.departmentTitle}
                      </td>

                      {/* Contract Type */}
                      <td className="py-3 px-4">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-md text-[11px] font-semibold ${
                            row.contractType === 'Full-Time'
                              ? 'bg-[#eff4ff] text-blue-700 border border-blue-100'
                              : 'bg-amber-50 text-amber-800 border border-amber-200'
                          }`}
                        >
                          {row.contractType}
                        </span>
                      </td>

                      {/* Approved Rate */}
                      <td className="py-3 px-4 text-slate-600 font-medium">
                        {fmtRate(row.approvedRate)} / hr
                      </td>

                      {/* Billed Hours */}
                      <td className="py-3 px-4 font-semibold text-slate-800">
                        {row.billedHours.toFixed(1)} hrs
                      </td>

                      {/* Calculated Gross */}
                      <td className="py-3 px-4 font-bold text-[#540225] text-sm">
                        {fmtRate(row.calculatedGross, true)}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4">
                        {row.status === 'Paid' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 text-[11px] font-bold border border-emerald-200 shadow-2xs">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                            Paid
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#ffdea8] text-[#271900] text-[11px] font-bold border border-amber-200 shadow-2xs">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#7c5800]" />
                            Approved
                          </span>
                        )}
                      </td>

                      {/* Details: View Logs */}
                      <td className="py-3 px-6 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleOpenLogs(row)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 hover:text-[#540225] hover:border-[#540225]/30 text-xs font-semibold shadow-2xs transition-all cursor-pointer"
                          title="View individual timesheet session logs"
                        >
                          <Search className="w-3.5 h-3.5 text-slate-400" />
                          <span>View Logs</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Breakdown Modal */}
        <TeacherLogsModal
          isOpen={!!activeFacultyForLogs}
          onClose={() => setActiveFacultyForLogs(null)}
          facultyRow={activeFacultyForLogs}
          currency={currency}
          exchangeRate={exchangeRate}
        />
      </>
    );
  }

  // Grouped by Department View (Accordions)
  if (departments.length === 0) {
    return (
      <div className="bg-white rounded-3xl p-12 text-center border border-slate-200/80 shadow-xs space-y-3">
        <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center mx-auto mb-2">
          <Banknote className="w-6 h-6 text-[#721c3b]" />
        </div>
        <h4 className="font-headline font-bold text-base text-[#0b1c30]">
          No Timesheets Found for this Disbursal View
        </h4>
        <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
          There are currently no timesheets matching this filter. Approved timesheets waiting for cash payment appear in the Active view, while paid timesheets are recorded in the Payment Archive.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {departments.map((dept) => {
          const isExpanded = !!expandedDepts[dept.id];
          const visibleRows = dept.rows.filter(filterRow);
          const isDeptAllSelected =
            visibleRows.length > 0 && visibleRows.every((r) => selectedRowIds.has(r.id));

          // If filtering by search/status and no rows match, we hide the accordion or show empty
          if (searchQuery && visibleRows.length === 0) {
            return null;
          }

          return (
            <div
              key={dept.id}
              className="rounded-2xl bg-white shadow-xs border border-slate-100 overflow-hidden transition-all"
            >
              {/* Accordion Header Bar */}
              <div
                onClick={() => toggleDept(dept.id)}
                className="p-4 px-6 flex flex-col md:flex-row md:items-center justify-between gap-3 cursor-pointer hover:bg-slate-50/70 transition-colors select-none"
              >
                {/* Left: Chevron, Department Name, Faculty Badge */}
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    aria-label={isExpanded ? 'Collapse department' : 'Expand department'}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-700 bg-slate-50 border border-slate-200 transition-colors"
                  >
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-slate-700" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-700" />
                    )}
                  </button>

                  <h3 className="font-headline font-bold text-sm sm:text-base text-[#0b1c30]">
                    {dept.name}
                  </h3>

                  <span className="px-2.5 py-0.5 rounded-md bg-[#eff4ff] text-blue-900 text-[11px] font-semibold border border-blue-100">
                    {dept.facultyCount} Faculty
                  </span>
                </div>

                {/* Right: Dept Hours, Subtotal, Audit Status Badge */}
                <div className="flex items-center gap-3 text-xs flex-wrap md:flex-nowrap">
                  <span className="text-slate-500 font-medium">
                    Dept Hours:{' '}
                    <strong className="text-slate-800 font-semibold">{dept.totalDeptHours.toFixed(1)} hrs</strong>
                  </span>

                  <span className="text-slate-300">•</span>

                  <span className="text-slate-500 font-medium">
                    Subtotal:{' '}
                    <strong className="text-[#540225] font-bold text-sm">
                      {fmtRate(dept.subtotalGross, true)}
                    </strong>
                  </span>

                  <span className="text-slate-300">•</span>

                  {/* Audit Status Badge */}
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#ffdea8] text-[#271900] text-[11px] font-bold border border-amber-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#7c5800]" />
                    <span>{dept.hodSignedStatus}</span>
                  </div>
                </div>
              </div>

              {/* Accordion Content: Data Table */}
              {isExpanded && (
                <div className="border-t border-slate-100 overflow-x-auto animate-in fade-in duration-200">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-[#eff4ff]/60 border-b border-slate-100 text-[11px] uppercase tracking-wider text-slate-400 font-bold">
                        <th className="py-3 px-4 w-12 text-center">
                          <input
                            type="checkbox"
                            aria-label={`Select all in ${dept.name}`}
                            checked={isDeptAllSelected}
                            onChange={(e) => {
                              e.stopPropagation();
                              handleToggleDeptRows(visibleRows);
                            }}
                            className="w-4 h-4 rounded border-slate-300 text-[#540225] focus:ring-[#721c3b] cursor-pointer"
                          />
                        </th>
                        <th className="py-3 px-6">Faculty Member</th>
                        <th className="py-3 px-4">Contract Type</th>
                        <th className="py-3 px-4">Approved Rate</th>
                        <th className="py-3 px-4">Billed Hours</th>
                        <th className="py-3 px-4">Calculated Gross</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-6 text-right">Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {visibleRows.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="py-8 text-center text-slate-400">
                            No matching faculty members in this department.
                          </td>
                        </tr>
                      ) : (
                        visibleRows.map((row) => (
                          <tr
                            key={row.id}
                            className={`hover:bg-[#f8f9ff] transition-colors group ${
                              selectedRowIds.has(row.id) ? 'bg-[#540225]/5' : ''
                            }`}
                          >
                            {/* Checkbox */}
                            <td className="py-3.5 px-4 text-center">
                              <input
                                type="checkbox"
                                aria-label={`Select ${row.name}`}
                                checked={selectedRowIds.has(row.id)}
                                onChange={() => onToggleRow(row.id)}
                                className="w-4 h-4 rounded border-slate-300 text-[#540225] focus:ring-[#721c3b] cursor-pointer"
                              />
                            </td>

                            {/* Faculty Member */}
                            <td className="py-3.5 px-6">
                              <div className="flex items-center gap-3">
                                <div
                                  className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs ring-2 shrink-0 ${getAvatarClass(
                                    row.avatarBgColor
                                  )}`}
                                >
                                  {row.avatarInitials}
                                </div>
                                <div className="flex flex-col min-w-0">
                                  <span className="font-bold text-[#0b1c30] group-hover:text-[#540225] transition-colors truncate">
                                    {row.name}
                                  </span>
                                  <span className="text-[11px] text-slate-500 truncate">
                                    {row.email}
                                  </span>
                                </div>
                              </div>
                            </td>

                            {/* Contract Type */}
                            <td className="py-3.5 px-4">
                              <span
                                className={`inline-block px-2.5 py-1 rounded-md text-[11px] font-semibold ${
                                  row.contractType === 'Full-Time'
                                    ? 'bg-[#eff4ff] text-blue-700 border border-blue-100'
                                    : 'bg-amber-50 text-amber-800 border border-amber-200'
                                }`}
                              >
                                {row.contractType}
                              </span>
                            </td>

                            {/* Approved Rate */}
                            <td className="py-3.5 px-4 text-slate-600 font-medium">
                              {fmtRate(row.approvedRate)} / hr
                            </td>

                            {/* Billed Hours */}
                            <td className="py-3.5 px-4 font-semibold text-slate-800">
                              {row.billedHours.toFixed(1)} hrs
                            </td>

                            {/* Calculated Gross */}
                            <td className="py-3.5 px-4 font-bold text-[#0b1c30] group-hover:text-[#540225] text-sm">
                              {fmtRate(row.calculatedGross, true)}
                            </td>

                            {/* Status */}
                            <td className="py-3.5 px-4">
                              {row.status === 'Paid' ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 text-[11px] font-bold border border-emerald-200 shadow-2xs">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                                  Paid
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#ffdea8] text-[#271900] text-[11px] font-bold border border-amber-200 shadow-2xs">
                                  <span className="w-1.5 h-1.5 rounded-full bg-[#7c5800]" />
                                  Approved
                                </span>
                              )}
                            </td>

                            {/* Details: View Logs */}
                            <td className="py-3.5 px-6 text-right whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => handleOpenLogs(row)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 hover:text-[#540225] hover:border-[#540225]/30 text-xs font-semibold shadow-2xs transition-all cursor-pointer"
                                title="View individual timesheet session logs"
                              >
                                <Search className="w-3.5 h-3.5 text-slate-400 group-hover:text-[#540225]" />
                                <span>View Logs</span>
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Breakdown Modal */}
      <TeacherLogsModal
        isOpen={!!activeFacultyForLogs}
        onClose={() => setActiveFacultyForLogs(null)}
        facultyRow={activeFacultyForLogs}
        currency={currency}
        exchangeRate={exchangeRate}
      />
    </>
  );
}
