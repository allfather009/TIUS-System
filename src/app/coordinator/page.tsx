'use client';

import React, { useState, useEffect } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { MetricCards } from '@/components/admin/MetricCards';
import { RoleCountsBar } from '@/components/admin/RoleCountsBar';
import { UserTable } from '@/components/admin/UserTable';
import { EditRoleModal } from '@/components/admin/EditRoleModal';
import { AddUserModal } from '@/components/admin/AddUserModal';
import {
  getUsers,
  getDepartments,
  updateUserRole,
  createSingleUser,
  deleteUser,
  getMetrics,
  EMPTY_DASHBOARD_METRICS,
} from '@/lib/services/userService';
import {
  getSystemSettings,
  updateSystemSettings,
  checkCanViewCurrency,
  checkCanEditCurrency,
} from '@/lib/services/systemSettingsService';
import { UniversityUser, Department, UserRole, DashboardMetrics, SystemSettings } from '@/types/database';
import { UserPlus, CheckCircle2, Coins } from 'lucide-react';
import { useSession } from '@/lib/context/SessionContext';
import { CurrencySettingsModal } from '@/components/payroll/CurrencySettingsModal';

export default function CoordinatorPortalPage() {
  const session = useSession();

  // Live Data states from Supabase
  const [users, setUsers] = useState<UniversityUser[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [metrics, setMetrics] = useState<DashboardMetrics>(EMPTY_DASHBOARD_METRICS);
  const [loading, setLoading] = useState(true);

  // Modals state
  const [selectedUserForEdit, setSelectedUserForEdit] = useState<UniversityUser | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [isCurrencyModalOpen, setIsCurrencyModalOpen] = useState(false);
  const [systemSettings, setSystemSettings] = useState<SystemSettings | null>(null);

  // Global search input state
  const [globalSearch, setGlobalSearch] = useState('');

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<{ title: string; desc: string } | null>(null);

  const showToast = (title: string, desc: string) => {
    setToastMessage({ title, desc });
    setTimeout(() => {
      setToastMessage(null);
    }, 4500);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [fetchedUsers, fetchedDepts, fetchedSystem] = await Promise.all([
        getUsers(),
        getDepartments(),
        getSystemSettings(),
      ]);
      setUsers(fetchedUsers);
      setDepartments(fetchedDepts);
      setSystemSettings(fetchedSystem);
      setMetrics(
        getMetrics(fetchedUsers, {
          exchangeRate: fetchedSystem?.exchange_rate ?? 1500,
          baseCurrency: (fetchedSystem?.base_currency as 'USD' | 'IQD') ?? 'IQD',
        })
      );
    } catch (err) {
      console.error('Error loading coordinator dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let ignore = false;
    async function initialFetch() {
      try {
        const [fetchedUsers, fetchedDepts, fetchedSystem] = await Promise.all([
          getUsers(),
          getDepartments(),
          getSystemSettings(),
        ]);
        if (!ignore) {
          setUsers(fetchedUsers);
          setDepartments(fetchedDepts);
          setSystemSettings(fetchedSystem);
          setMetrics(
            getMetrics(fetchedUsers, {
              exchangeRate: fetchedSystem?.exchange_rate ?? 1500,
              baseCurrency: (fetchedSystem?.base_currency as 'USD' | 'IQD') ?? 'IQD',
            })
          );
        }
      } catch (err) {
        console.error('Error loading data:', err);
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    initialFetch();

    return () => {
      ignore = true;
    };
  }, []);

  // Handle Edit Role
  const handleOpenEditUser = (user: UniversityUser) => {
    setSelectedUserForEdit(user);
    setIsEditModalOpen(true);
  };

  const handleSaveRole = async (
    userId: string,
    newRole: UserRole,
    departmentId?: string | null,
    academicTitle?: string | null,
    hourlyRate?: number | null
  ) => {
    const res = await updateUserRole(userId, newRole, departmentId, academicTitle, hourlyRate);
    if (res.success && res.user) {
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, ...res.user } : u))
      );
      setMetrics((prev) =>
        getMetrics(
          users.map((u) => (u.id === userId ? { ...u, ...res.user } : u)),
          { exchangeRate: prev.exchangeRate, baseCurrency: prev.baseCurrency }
        )
      );
      showToast(
        'Role Updated Successfully',
        `${res.user.name} is now updated to ${newRole}${
          academicTitle ? ` (${academicTitle})` : ''
        }${departmentId ? ' in assigned department' : ''}.`
      );
    }
  };

  // Handle Add Single User
  const handleAddUser = async (data: Omit<UniversityUser, 'id' | 'department'>) => {
    const res = await createSingleUser(data);
    if (res.success && res.user) {
      setUsers((prev) => [res.user!, ...prev]);
      setMetrics((prev) =>
        getMetrics([res.user!, ...users], {
          exchangeRate: prev.exchangeRate,
          baseCurrency: prev.baseCurrency,
        })
      );
      showToast(
        'Staff Member Created',
        `${res.user.name} has been provisioned and added to the directory.`
      );
    }
  };

  // Handle Delete User
  const handleDeleteUser = async (user: UniversityUser) => {
    if (!confirm(`Are you sure you want to delete ${user.name}? This action cannot be undone.`)) {
      return;
    }
    const res = await deleteUser(user.id);
    if (res.success) {
      const remainingUsers = users.filter((u) => u.id !== user.id);
      setUsers(remainingUsers);
      setMetrics((prev) =>
        getMetrics(remainingUsers, {
          exchangeRate: prev.exchangeRate,
          baseCurrency: prev.baseCurrency,
        })
      );
      showToast('User Deleted', `${user.name} has been removed.`);
    } else {
      showToast('Error', 'Failed to delete user.');
    }
  };

  const userPerms = (session.user?.custom_permissions || {}) as Record<string, boolean>;
  const canViewCurrency = checkCanViewCurrency('COORDINATOR', userPerms, session.isSuperAdmin);
  const canEditCurrency = checkCanEditCurrency('COORDINATOR', userPerms, session.isSuperAdmin);

  return (
    <div className="min-h-screen bg-[#f8f9ff]">
      {/* Navigation Sidebar */}
      <Sidebar
        activeItem="coordinator"
        activeRole="COORDINATOR"
        onOpenCurrencySettings={canViewCurrency ? () => setIsCurrencyModalOpen(true) : undefined}
      />

      {/* Main Container Offset by Sidebar */}
      <div className="pl-72">
        {/* Top Header */}
        <Header
          breadcrumbCategory="TIU Academic Affairs"
          breadcrumbPage="Faculty Coordination"
          searchQuery={globalSearch}
          onSearchChange={setGlobalSearch}
          activeViewLabel="Academic Coordinator"
          customPermissions={userPerms}
        />

        {/* Page Content */}
        <main className={`w-full ${session.isSimulating ? 'pt-28' : 'pt-20'} pb-16 px-8`}>
          <div className="max-w-7xl mx-auto space-y-8">
            {/* Header Block with Actions */}
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div className="space-y-1">
                <h1 className="font-headline text-2xl sm:text-3xl font-bold text-[#0b1c30] tracking-tight">
                  Faculty Directory &amp; Staff Coordination
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 max-w-3xl">
                  Oversee academic staff, monitor department hours, and manage cross-faculty coordination.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2.5 flex-wrap">
                {canViewCurrency && (
                  <button
                    type="button"
                    onClick={() => setIsCurrencyModalOpen(true)}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold border border-slate-200 transition-all shadow-2xs cursor-pointer group"
                  >
                    <Coins className="w-4 h-4 text-emerald-600 transition-transform group-hover:scale-110" />
                    <span>Currency: {systemSettings?.base_currency || 'IQD'}</span>
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-100 font-semibold">
                      {(systemSettings?.exchange_rate ? systemSettings.exchange_rate / 100 : 1500).toLocaleString()} IQD/$1
                    </span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setIsAddUserOpen(true)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#540225] hover:bg-[#721c3b] text-white text-xs font-bold transition-all shadow-md hover:shadow-lg cursor-pointer"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Add University User</span>
                </button>
              </div>
            </div>

            {/* Top Metric Cards (Payroll Cost Hidden for Coordinator) */}
            <MetricCards metrics={metrics} hidePayrollCost={true} />

            {/* Role Counts Row */}
            <RoleCountsBar metrics={metrics} />

            {/* Main Section: Searchable Faculty Table */}
            <UserTable
              users={users}
              departments={departments}
              onEditUser={handleOpenEditUser}
              onDeleteUser={handleDeleteUser}
              onRefresh={loadData}
            />
          </div>
        </main>
      </div>

      {/* Interactive Modals */}
      <EditRoleModal
        user={selectedUserForEdit}
        departments={departments}
        allUsers={users}
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setSelectedUserForEdit(null);
        }}
        onSave={handleSaveRole}
      />

      <AddUserModal
        departments={departments}
        isOpen={isAddUserOpen}
        onClose={() => setIsAddUserOpen(false)}
        onAddUser={handleAddUser}
      />

      {/* Currency Settings Modal */}
      {canViewCurrency && systemSettings && (
        <CurrencySettingsModal
          isOpen={isCurrencyModalOpen}
          onClose={() => setIsCurrencyModalOpen(false)}
          exchangeRate={systemSettings.exchange_rate || 150000}
          onSave={async (newRate) => {
            const ok = await updateSystemSettings({ exchange_rate: newRate });
            if (ok) {
              setSystemSettings((prev) => (prev ? { ...prev, exchange_rate: newRate } : null));
              showToast('Currency Updated', `System exchange rate updated to ${(newRate / 100).toLocaleString()} IQD / $1.`);
              loadData();
            }
          }}
          financeCanEditExchange={canEditCurrency}
        />
      )}

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
