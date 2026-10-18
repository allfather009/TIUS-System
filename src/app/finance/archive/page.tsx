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
  checkCanManageCycles,
} from '@/lib/services/systemSettingsService';
import { useSession } from '@/lib/context/SessionContext';
import { printCashSlipsWindow } from '@/lib/utils/printCashSlips';
import { PayrollDisbursalSummary, EMPTY_PAYROLL_DATA } from '@/types/payroll';
import { PayrollSettings } from '@/types/database';
import { CheckCircle2, ArchiveRestore } from 'lucide-react';

export default function PaymentArchivePage() {
  const session = useSession();
  const [summary, setSummary] = useState<PayrollDisbursalSummary>(EMPTY_PAYROLL_DATA);
  const [settings, setSettings] = useState<PayrollSettings>(getDefaultPayrollSettings());
  const [availableCycles, setAvailableCycles] = useState<HistoricalCycleOption[]>([]);
  const [selectedMonth, setSelectedMonth] = useState('all');
  const [viewMode, setViewMode] = useState<'by-department' | 'flat-list'>('by-department');
  const [statusFilter, setStatusFilter] = useState<'all' | 'finalized' | 'pending'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Row selection state for re-printing archive slips
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());
  const [isProcessingPrint, setIsProcessingPrint] = useState(false);

  // Currency State
  const [currency, setCurrency] = useState<'USD' | 'IQD'>('IQD');
  const [exchangeRate, setExchangeRate] = useState<number>(150000);

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
        status: 'PAID' as const,
        month: monthVal !== 'all' ? monthVal : undefined,
      };

      const [loadedSummary, loadedSettings, loadedCycles, loadedSystemSettings] = await Promise.all([
        getPayrollDisbursalSummary(opts),
        getPayrollSettings(),
        getHistoricalPayrollCycles('PAID'),
        getSystemSettings(),
      ]);
      setSummary(loadedSummary);
      setSettings(loadedSettings);
      setAvailableCycles(loadedCycles);
      
      // Update currency states from DB settings
      setCurrency(loadedSystemSettings.base_currency);
      setExchangeRate(loadedSystemSettings.exchange_rate);
    } catch (err) {
      console.error('Error loading payment archive data:', err);
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
    exportPayrollToCSV(summary.departments, `TIU_Payment_Archive_${selectedMonth}.csv`);
    showToast(
      'Payment Archive Export Downloaded',
      `TIU_Payment_Archive_${selectedMonth}.csv generated with settled payment audit records.`
    );
  };

  // Handle Save Cycle Settings from Modal
  const handleSaveCycleSettings = async (updated: Partial<PayrollSettings>) => {
    const res = await updatePayrollSettings(updated);
    if (res.data) {
      setSettings(res.data);
    }
    const refreshedSummary = await getPayrollDisbursalSummary({
      status: 'PAID',
      month: selectedMonth !== 'all' ? selectedMonth : undefined,
    });
    setSummary(refreshedSummary);
    showToast(
      'Cycle Settings Saved',
      `Active cycle settings updated: ${refreshedSummary.activeCycleLabel}`
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

  // Re-print cash slips from archive
  const handleReprintCashSlips = () => {
    if (selectedRows.length === 0) return;

    setIsProcessingPrint(true);
    try {
      printCashSlipsWindow(
        selectedRows,
        selectedMonth === 'all' ? 'Historical Payment Archive' : selectedMonth,
        summary.batchReferenceId,
        currency,
        exchangeRate
      );
      setIsCashSlipsModalOpen(true);
      showToast(
        'Archive Cash Slips Opened',
        `Re-printing postcard vouchers for ${selectedRows.length} archived faculty records.`
      );
    } catch (err) {
      console.error('Error reprinting slips from archive:', err);
      showToast('Print Error', 'Could not open print window.');
    } finally {
      setIsProcessingPrint(false);
    }
  };

  // Active label for header
  const cycleHeaderLabel = useMemo(() => {
    if (selectedMonth === 'all') return 'All Historical Cycles';
    const found = availableCycles.find((c) => c.value === selectedMonth);
    return found ? found.label : selectedMonth;
  }, [selectedMonth, availableCycles]);

  return (
    <div className="min-h-screen bg-[#f8f9ff]">
      {/* Navigation Sidebar with active Payroll & Finance and Payment Archive link highlighted */}
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
          breadcrumbPage="Payment Archive &amp; Historical Disbursals"
        />

        {/* Page Content */}
        <main className="w-full pt-20 pb-28 px-8">
          <div className="max-w-7xl mx-auto space-y-7">
            {/* Header: Title and Archive Cycle pill */}
            <PayrollHeader
              title="Payment Archive"
              subtitle="Historical Disbursed Remuneration Records (Paid Cash Slips)"
              activeCycleLabel={`Archive: ${cycleHeaderLabel}`}
              isLocked={false}
              onOpenCycleSettings={canManageCycles ? () => setIsCycleSettingsModalOpen(true) : undefined}
            />

            {/* Summary Metric Cards (4 Columns) */}
            <PayrollMetricCards 
              summary={summary} 
              currency={currency}
              exchangeRate={exchangeRate}
            />

            {/* View Controls & Filter Bar: Month Selector dropdown filters historical cycles */}
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

        {/* Dynamic Sticky Bottom Bar Adapted for Historical Archive */}
        {selectedRows.length > 0 && (
          <StickyDisbursalBar
            summary={summary}
            selectedRows={selectedRows}
            onPrintCashSlipsAndPay={handleReprintCashSlips}
            isProcessing={isProcessingPrint}
            barTitle="Payment Archive"
            actionButtonLabel="Re-Print Selected Slips"
            statusBadgeLabel="Archived & Settled as Paid"
            grossLabel="TOTAL ARCHIVED PAYOUT"
            emptyHint="Select faculty rows using the checkboxes above to re-print archived cash voucher slips."
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

      {/* Cycle Configuration Modal */}
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
        activeCycleLabel={`Payment Archive: ${cycleHeaderLabel}`}
        batchReferenceId={summary.batchReferenceId}
        currency={currency}
        exchangeRate={exchangeRate}
        onPrintWindow={() =>
          printCashSlipsWindow(
            selectedRows,
            `Payment Archive: ${cycleHeaderLabel}`,
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
