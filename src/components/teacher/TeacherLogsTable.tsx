'use client';

import React, { useState, useMemo } from 'react';
import { Search, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { TeacherLog } from '@/types/database';

interface TeacherLogsTableProps {
  logs: TeacherLog[];
}

export function TeacherLogsTable({ logs }: TeacherLogsTableProps) {
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'ALL' | 'APPROVED' | 'PENDING'>('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 6;

  // Counts
  const counts = useMemo(() => {
    return {
      all: logs.length,
      approved: logs.filter((l) => l.status === 'APPROVED').length,
      pending: logs.filter((l) => l.status === 'PENDING' || l.status === 'PENDING_HOD_APPROVAL').length,
    };
  }, [logs]);

  // Filtered
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      // Tab filter
      if (activeTab === 'APPROVED' && log.status !== 'APPROVED') return false;
      if (activeTab === 'PENDING' && log.status !== 'PENDING' && log.status !== 'PENDING_HOD_APPROVAL') return false;

      // Search
      if (!search.trim()) return true;
      const s = search.toLowerCase();
      return (
        log.deliverable.toLowerCase().includes(s) ||
        log.courseCode.toLowerCase().includes(s) ||
        log.submissionRef.toLowerCase().includes(s) ||
        log.date.toLowerCase().includes(s) ||
        log.loggedByName.toLowerCase().includes(s)
      );
    });
  }, [logs, activeTab, search]);

  const totalPages = Math.ceil(filteredLogs.length / pageSize) || 1;
  const paginatedLogs = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredLogs.slice(start, start + pageSize);
  }, [filteredLogs, currentPage, pageSize]);

  const getCourseBadge = (code: string, color: string) => {
    switch (color) {
      case 'red':
        return (
          <span className="px-2 py-0.5 rounded-md text-[11px] font-bold font-mono bg-rose-50 text-rose-700 border border-rose-200 shrink-0">
            {code}
          </span>
        );
      case 'amber':
        return (
          <span className="px-2 py-0.5 rounded-md text-[11px] font-bold font-mono bg-amber-50 text-amber-800 border border-amber-200 shrink-0">
            {code}
          </span>
        );
      case 'blue':
        return (
          <span className="px-2 py-0.5 rounded-md text-[11px] font-bold font-mono bg-blue-50 text-blue-700 border border-blue-200 shrink-0">
            {code}
          </span>
        );
      case 'purple':
      default:
        return (
          <span className="px-2 py-0.5 rounded-md text-[11px] font-bold font-mono bg-indigo-50 text-indigo-700 border border-indigo-200 shrink-0">
            {code}
          </span>
        );
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-xs border border-slate-100 overflow-hidden space-y-0">
      {/* Table Header Controls */}
      <div className="p-6 pb-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Search Input */}
        <div className="relative w-full md:w-auto">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Filter activity or ref..."
            className="w-full md:w-72 h-9 pl-8 pr-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#721c3b]/30 focus:bg-white transition-all"
          />
        </div>

        {/* Toggle Tabs */}
        <div className="inline-flex items-center p-1 rounded-full bg-slate-100 text-xs font-semibold shrink-0">
          <button
            type="button"
            onClick={() => {
              setActiveTab('ALL');
              setCurrentPage(1);
            }}
            className={`px-3 py-1 rounded-full transition-all cursor-pointer ${
              activeTab === 'ALL'
                ? 'bg-[#0b1c30] text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All ({counts.all})
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('APPROVED');
              setCurrentPage(1);
            }}
            className={`px-3 py-1 rounded-full transition-all cursor-pointer ${
              activeTab === 'APPROVED'
                ? 'bg-[#0b1c30] text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Approved ({counts.approved})
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('PENDING');
              setCurrentPage(1);
            }}
            className={`px-3 py-1 rounded-full transition-all cursor-pointer ${
              activeTab === 'PENDING'
                ? 'bg-[#0b1c30] text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Pending ({counts.pending})
          </button>
        </div>
      </div>

      {/* Table Content */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-100 bg-[#eff4ff]/40 text-[11px] uppercase tracking-wider text-slate-400 font-bold">
              <th className="py-3 px-6">DATE</th>
              <th className="py-3 px-6">COURSE / DELIVERABLE</th>
              <th className="py-3 px-6">DURATION</th>
              <th className="py-3 px-6">LOGGED BY</th>
              <th className="py-3 px-6">STATUS &amp; SUBMISSION REF</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs">
            {paginatedLogs.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-12 text-center text-slate-400">
                  No activity logs found matching the filter criteria.
                </td>
              </tr>
            ) : (
              paginatedLogs.map((log) => (
                <tr key={log.id} className="hover:bg-[#f8f9ff] transition-colors">
                  {/* Date */}
                  <td className="py-4 px-6 whitespace-nowrap">
                    <div className="flex flex-col">
                      <span className="font-bold text-[#0b1c30]">{log.date}</span>
                      <span className="text-[11px] text-slate-500">{log.dayAndTime}</span>
                    </div>
                  </td>

                  {/* Course / Deliverable */}
                  <td className="py-4 px-6 max-w-[150px] sm:max-w-[300px]">
                    <div className="flex items-center gap-2.5">
                      {getCourseBadge(log.courseCode, log.courseColor)}
                      <span className="font-bold text-[#0b1c30] truncate">
                        {log.deliverable}
                      </span>
                    </div>
                  </td>

                  {/* Duration */}
                  <td className="py-4 px-6 whitespace-nowrap">
                    <span className="font-bold text-[#721c3b] text-sm">
                      {log.durationFormatted}
                    </span>
                  </td>

                  {/* Logged by HoD / Faculty */}
                  <td className="py-4 px-6 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <div className={`w-7 h-7 rounded-full text-[10px] font-bold flex items-center justify-center border ${
                        log.loggedByName === 'Self-Submitted' 
                          ? 'bg-blue-50 text-blue-700 border-blue-200' 
                          : 'bg-amber-50 text-amber-800 border-amber-200'
                      }`}>
                        {log.loggedByName === 'Self-Submitted' ? 'ME' : log.loggedByName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                      </div>
                      <span className="font-medium text-slate-700">
                        {log.loggedByName}
                      </span>
                    </div>
                  </td>

                  {/* Status & Submission Ref */}
                  <td className="py-4 px-6 whitespace-nowrap">
                    <div className="flex flex-col gap-1 items-start">
                      {log.status === 'APPROVED' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 text-[10px] font-bold border border-emerald-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          Approved &amp; Signed
                        </span>
                      ) : log.status === 'REJECTED' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-50 text-rose-800 text-[10px] font-bold border border-rose-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                          Rejected by HoD
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-900 text-[10px] font-bold border border-amber-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                          Pending HoD Endorsement
                        </span>
                      )}
                      <span className="font-mono text-[11px] text-slate-400 font-medium">
                        {log.submissionRef}
                      </span>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Bar */}
      <div className="p-4 px-6 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
        <div>
          Showing <span className="font-semibold text-slate-800">{filteredLogs.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}</span> to{' '}
          <span className="font-semibold text-slate-800">
            {Math.min(currentPage * pageSize, filteredLogs.length)}
          </span>{' '}
          of <span className="font-semibold text-slate-800">{filteredLogs.length}</span> recorded entries
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-900 disabled:opacity-40 transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            Previous
          </button>

          <span className="font-semibold text-slate-800 bg-slate-50 px-3 py-1 rounded-lg border border-slate-200 text-xs">
            Page {currentPage} of {totalPages}
          </span>

          <button
            type="button"
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-900 disabled:opacity-40 transition-colors cursor-pointer"
          >
            Next
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
