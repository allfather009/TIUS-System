'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { PayrollHeader } from '@/components/payroll/PayrollHeader';
import { PayrollMetricCards } from '@/components/payroll/PayrollMetricCards';
import { PayrollViewControls } from '@/components/payroll/PayrollViewControls';
import { DepartmentAccordions } from '@/components/payroll/DepartmentAccordions';
import { StickyDisbursalBar } from '@/components/payroll/StickyDisbursalBar';
import { PayrollReportModal } from '@/components/payroll/PayrollReportModal';
import { CycleSettingsModal } from '@/components/payroll/CycleSettingsModal';
import { CurrencySettingsModal } from '@/components/payroll/CurrencySettingsModal';
import { CashSlipsModal } from '@/components/payroll/CashSlipsModal';
import {
  exportPayrollToCSV,
  getPayrollDisbursalSummary,
  getHistoricalPayrollCycles,
  HistoricalCycleOption,
} from '@/lib/services/payrollService';
import {
  getPayrollSettings,
  updatePayrollSettings,
  getDefaultPayrollSettings,
} from '@/lib/services/payrollSettingsService';
import {
  getSystemSettings,
  updateSystemSettings,
  checkCanEditCurrency,
  checkCanViewCurrency,
  checkCanManageCycles,
} from '@/lib/services/systemSettingsService';
import { printCashSlipsWindow } from '@/lib/utils/printCashSlips';
import { createClient } from '@/lib/supabase/client';
import { useSession } from '@/lib/context/SessionContext';
import { PayrollDisbursalSummary, EMPTY_PAYROLL_DATA } from '@/types/payroll';
import { PayrollSettings } from '@/types/database';
import { CheckCircle2 } from 'lucide-react';

export default function PayrollPage() {
  const session = useSession();
  const [summary, setSummary] = useState<PayrollDisbursalSummary>(EMPTY_PAYROLL_DATA);
  const [settings, setSettings] = useState<PayrollSettings>(getDefaultPayrollSettings());
  const [availableCycles, setAvailableCycles] = useState<HistoricalCycleOption[]>([]);
  const [selectedMonth, setSelectedMonth] = useState('all');
  const [viewMode, setViewMode] = useState<'by-department' | 'flat-list'>('by-department');
  const [statusFilter, setStatusFilter] = useState<'all' | 'finalized' | 'pending'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Currency state
  const [currency, setCurrency] = useState<'USD' | 'IQD'>('IQD');
  const [exchangeRate, setExchangeRate] = useState<number>(150000);
  const [financeCanEditExchange, setFinanceCanEditExchange] = useState(true);

  // Row selection state for cash disbursal
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());
  const [isProcessingPayout, setIsProcessingPayout] = useState(false);

  // Modals state
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isCycleSettingsModalOpen, setIsCycleSettingsModalOpen] = useState(false);
  const [isCurrencySettingsModalOpen, setIsCurrencySettingsModalOpen] = useState(false);
  const [isCashSlipsModalOpen, setIsCashSlipsModalOpen] = useState(false);

  const userPerms = (session.user?.custom_permissions || {}) as Record<string, boolean>;
  const canManageCycles = checkCanManageCycles(
    session.user?.role || session.role || 'ACCOUNTANT',
    userPerms,
    session.isSuperAdmin
  );

  // Toast notifications
  const [toastMessage, setToastMessage] = useState<{ title: string; desc: string } | null>(null);

  const showToast = (title: string, desc: string) => {
    setToastMessage({ title, desc });
    setTimeout(() => {
      setToastMessage(null);
    }, 4500);
  };

  const loadData = async (monthVal = selectedMonth) => {
    try {
    const opts = {
        status: 'APPROVED' as const,
        month: monthVal !== 'all' ? monthVal : undefined,
      };

      const [loadedSummary, loadedSettings, loadedCycles, loadedSystemSettings] = await Promise.all([
        getPayrollDisbursalSummary(opts),
        getPayrollSettings(),
        getHistoricalPayrollCycles('APPROVED'),
        getSystemSettings(),
      ]);
      setSummary(loadedSummary);
      setSettings(loadedSettings);
      setCurrency(loadedSystemSettings.base_currency);
      setExchangeRate(loadedSystemSettings.exchange_rate);
      const canEdit = checkCanEditCurrency('ACCOUNTANT', userPerms, session.isSuperAdmin);
      setFinanceCanEditExchange(canEdit);
      setAvailableCycles(
        loadedCycles.map((c) =>
          c.value === 'all' ? { ...c, label: 'All Active Approved' } : c
        )
      );
    } catch (err) {
      console.error('Error loading payroll data and settings:', err);
    }
  };

  useEffect(() => {
    loadData(selectedMonth);
  }, [selectedMonth]);

  // Collect all faculty rows across departments
  const allRows = useMemo(() => {
    return summary.departments.flatMap((d) => d.rows);
  }, [summary]);

  // Removed auto-select all rows on load so checkboxes default to unchecked

  // Selected faculty rows
  const selectedRows = useMemo(() => {
    return allRows.filter((r) => selectedRowIds.has(r.id));
  }, [allRows, selectedRowIds]);

  // Toggle single row
  const handleToggleRow = (id: string) => {
    setSelectedRowIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Toggle multiple rows
  const handleToggleAllRows = (newIds: string[]) => {
    setSelectedRowIds(new Set(newIds));
  };

  // Filter counts
  const counts = useMemo(() => {
    return {
      all: summary.eligibleTeachersCount,
      finalized: summary.finalizedCount,
      pending: summary.pendingDisbursalCount,
    };
  }, [summary]);

  // Handle Export CSV
  const handleExportCSV = () => {
    exportPayrollToCSV(summary.departments);
    showToast(
      'Payroll Export Downloaded',
      'TIU_Payroll_Cash_Disbursal.csv generated with timestamp audit columns.'
    );
  };

  // Handle Save Cycle Settings from Modal
  const handleSaveCycleSettings = async (updated: Partial<PayrollSettings>) => {
    const res = await updatePayrollSettings(updated);
    if (res.data) {
      setSettings(res.data);
    }
    const refreshedSummary = await getPayrollDisbursalSummary({
      status: 'APPROVED',
      month: selectedMonth !== 'all' ? selectedMonth : undefined,
    });
    setSummary(refreshedSummary);
    showToast(
      'Cycle Settings Saved',
      `Active payroll cycle updated: ${refreshedSummary.activeCycleLabel}${
        updated.is_locked ? ' • SYSTEM LOCKED' : ''
      }`
    );
  };

  // Handle Save Currency Settings from Modal
  const handleSaveCurrencySettings = async (newExchangeRate: number) => {
    setExchangeRate(newExchangeRate);
    await updateSystemSettings({ exchange_rate: newExchangeRate });
    showToast(
      'Currency Settings Saved',
      `Exchange rate updated to ${newExchangeRate} IQD / $100`
    );
  };

  // Handle Print Cash Slips & Mark Paid in database
  const handlePrintCashSlipsAndPay = async () => {
    if (selectedRows.length === 0) return;

    setIsProcessingPayout(true);
    try {
      // 1. Collect all timesheet IDs for selected faculty members
      const selectedTimesheetIds = Array.from(new Set(selectedRows.flatMap((r) => r.timesheetIds)));

      // 2. Execute Supabase mutation: update timesheets from APPROVED to PAID
      if (selectedTimesheetIds.length > 0) {
        const supabase = createClient();
        const { error: updateError } = await supabase
          .from('timesheets')
          .update({
            status: 'PAID',
            updated_at: new Date().toISOString(),
          })
          .in('id', selectedTimesheetIds);

        if (updateError) {
          console.error('Error marking timesheets as PAID in Supabase:', updateError);
        }
      }

      // 3. Open styled printable HTML window for postcard vouchers
      printCashSlipsWindow(
        selectedRows,
        summary.activeCycleLabel || 'Active Cycle',
        summary.batchReferenceId,
        currency,
        exchangeRate
      );

      // 4. Open preview modal
      setIsCashSlipsModalOpen(true);

      const totalPaid = selectedRows.reduce((acc, r) => acc + r.calculatedGross, 0);
      const amountStr = currency === 'IQD' 
        ? `IQD ${(totalPaid * (exchangeRate / 100)).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
        : `$${totalPaid.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD`;

      showToast(
        'Cash Slips Generated & Marked Paid',
        `Disbursed ${amountStr} for ${selectedRows.length} faculty members. Status updated to PAID.`
      );

      // 5. Clear selection and reload fresh summary from Supabase
      setSelectedRowIds(new Set());
      await loadData(selectedMonth);
    } catch (err) {
      console.error('Failed to disburse cash and print slips:', err);
      showToast('Disbursal Error', 'An unexpected error occurred during cash disbursal.');
    } finally {
      setIsProcessingPayout(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8f9ff]">
      {/* Navigation Sidebar with Payroll & Finance highlighted in burgundy and relocated actions */}
      <Sidebar
        activeItem="payroll"
        onExportCSV={handleExportCSV}
        onOpenCycleSettings={() => setIsCycleSettingsModalOpen(true)}
        onGenerateReport={() => setIsReportModalOpen(true)}
        onOpenCurrencySettings={() => setIsCurrencySettingsModalOpen(true)}
      />

      {/* Main Content Container Offset by Sidebar */}
      <div className="pl-72">
        {/* Global Header */}
        <Header
          breadcrumbCategory="TIU Central Finance"
          breadcrumbPage="Payroll &amp; Remuneration Disbursal"
          activeViewLabel={session.activeViewLabel || 'Finance'}
          customPermissions={userPerms}
        />

        {/* Page Content */}
        <main className="w-full pt-20 pb-28 px-8">
          <div className="max-w-7xl mx-auto space-y-7">
            {/* Header: Title and Active Cycle pill */}
            <PayrollHeader
              title="Payroll & Finance Disbursal"
              subtitle="Monthly Extra Hours Remuneration Summary (Approved for Disbursal)"
              activeCycleLabel={summary.activeCycleLabel || settings.cycle_name || 'Active Cycle: Sep 25 - Oct 25'}
              isLocked={settings.is_locked}
              onOpenCycleSettings={canManageCycles ? () => setIsCycleSettingsModalOpen(true) : undefined}
            />

            {/* Summary Metric Cards (4 Columns) */}
            <PayrollMetricCards summary={summary} currency={currency} exchangeRate={exchangeRate} />

            {/* View Controls & Filter Bar with historical cycle support */}
            <PayrollViewControls
              selectedMonth={selectedMonth}
              onMonthChange={setSelectedMonth}
              availableMonths={availableCycles}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              statusFilter={statusFilter}
              onStatusFilterChange={setStatusFilter}
              searchQuery={searchQuery}
              onSearchQueryChange={setSearchQuery}
              counts={counts}
            />

            {/* Grouped Department Accordions & Data Table */}
            <DepartmentAccordions
              departments={summary.departments}
              viewMode={viewMode}
              searchQuery={searchQuery}
              statusFilter={statusFilter}
              selectedRowIds={selectedRowIds}
              onToggleRow={handleToggleRow}
              onToggleAllRows={handleToggleAllRows}
              currency={currency}
              exchangeRate={exchangeRate}
            />
          </div>
        </main>

        {/* Dynamic Sticky Bottom Disbursal Bar */}
        {selectedRows.length > 0 && (
          <StickyDisbursalBar
            summary={summary}
            selectedRows={selectedRows}
            onPrintCashSlipsAndPay={handlePrintCashSlipsAndPay}
            isProcessing={isProcessingPayout}
            currency={currency}
            exchangeRate={exchangeRate}
          />
        )}
      </div>

      {/* Report Modal */}
      <PayrollReportModal
        summary={summary}
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        onExportCSV={handleExportCSV}
        currency={currency}
        exchangeRate={exchangeRate}
      />

      {/* Cycle Configuration & System Lock Modal */}
      <CycleSettingsModal
        isOpen={isCycleSettingsModalOpen}
        onClose={() => setIsCycleSettingsModalOpen(false)}
        settings={settings}
        onSave={handleSaveCycleSettings}
      />

      {/* Cash Slips Postcard Preview & Print Modal */}
      <CashSlipsModal
        isOpen={isCashSlipsModalOpen}
        onClose={() => setIsCashSlipsModalOpen(false)}
        selectedRows={selectedRows}
        activeCycleLabel={summary.activeCycleLabel || 'Active Cycle'}
        batchReferenceId={summary.batchReferenceId}
        currency={currency}
        exchangeRate={exchangeRate}
        onPrintWindow={() =>
          printCashSlipsWindow(
            selectedRows,
            summary.activeCycleLabel || 'Active Cycle',
            summary.batchReferenceId,
            currency,
            exchangeRate
          )
        }
      />

      <CurrencySettingsModal
        isOpen={isCurrencySettingsModalOpen}
        onClose={() => setIsCurrencySettingsModalOpen(false)}
        exchangeRate={exchangeRate}
        onSave={handleSaveCurrencySettings}
        financeCanEditExchange={financeCanEditExchange}
      />

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 max-w-md bg-slate-900 text-white p-4 rounded-2xl shadow-2xl flex items-start gap-3 border border-slate-800 animate-in slide-in-from-bottom-5 duration-300">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          <div className="flex-1 text-xs">
            <h5 className="font-bold text-white">{toastMessage.title}</h5>
            <p className="text-slate-300 mt-0.5 leading-relaxed">{toastMessage.desc}</p>
          </div>
          <button
            onClick={() => setToastMessage(null)}
            className="text-slate-400 hover:text-white cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
