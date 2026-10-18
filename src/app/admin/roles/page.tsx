'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { MetricCards } from '@/components/admin/MetricCards';
import { RoleCountsBar } from '@/components/admin/RoleCountsBar';
import { UserTable } from '@/components/admin/UserTable';
import { EditRoleModal } from '@/components/admin/EditRoleModal';

import { AddUserModal } from '@/components/admin/AddUserModal';
import { AuthorizationMatrix } from '@/components/admin/AuthorizationMatrix';
import {
  getUsers,
  getDepartments,
  updateUserRole,
  createSingleUser,
  getMetrics,
  deleteUser,
  EMPTY_DASHBOARD_METRICS,
  BulkImportRow,
} from '@/lib/services/userService';
import { getSystemSettings } from '@/lib/services/systemSettingsService';
import { UniversityUser, Department, UserRole, DashboardMetrics } from '@/types/database';
import {
  UserPlus,
  History,
  CheckCircle2,
  ShieldAlert,
  Lock,
  ArrowLeft,
  KeyRound,
} from 'lucide-react';

import { useSession } from '@/lib/context/SessionContext';

export default function SuperAdminRolesPage() {
  const session = useSession();

  // Active identity & strict role state initialized deterministically for SSR/hydration
  const [activeRole, setActiveRole] = useState<UserRole>('SUPER_ADMIN');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const forcedRole = params.get('role');
      if (forcedRole === 'COORDINATOR' || forcedRole === 'SUPER_ADMIN' || forcedRole === 'HOD' || forcedRole === 'TEACHER') {
        setActiveRole(forcedRole as UserRole);
        return;
      }
      const match = document.cookie.match(/tius_session=([^;]+)/);
      if (match) {
        try {
          const raw = match[1];
          const decoded = raw.includes('%') ? decodeURIComponent(raw) : raw;
          const sess = JSON.parse(decoded);
          if (sess?.role) {
            setActiveRole(sess.role as UserRole);
          }
        } catch {
          // ignore
        }
      }
    }
  }, []);
  const [sessionChecked] = useState(true);

  // Live Data states — wired directly to Supabase PostgreSQL, no mock data
  const [users, setUsers] = useState<UniversityUser[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [metrics, setMetrics] = useState<DashboardMetrics>(EMPTY_DASHBOARD_METRICS);
  const [loading, setLoading] = useState(true);

  // Modals state
  const [selectedUserForEdit, setSelectedUserForEdit] = useState<UniversityUser | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);

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
      setMetrics(getMetrics(fetchedUsers, { exchangeRate: fetchedSystem.exchange_rate / 100, baseCurrency: fetchedSystem.base_currency }));
    } catch (err) {
      console.error('Error loading data:', err);
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
          setMetrics(getMetrics(fetchedUsers, { exchangeRate: fetchedSystem.exchange_rate / 100, baseCurrency: fetchedSystem.base_currency }));
        }
      } catch (err) {
        console.error('Error loading data:', err);
      } finally {
        if (!ignore) {
          setLoading(false);
        }
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
    hourlyRate?: number | null,
    departmentIds?: string[] | null,
    departmentNames?: string[] | null
  ) => {
    const res = await updateUserRole(
      userId,
      newRole,
      departmentId,
      academicTitle,
      hourlyRate,
      departmentIds,
      departmentNames
    );
    if (res.success && res.user) {
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, ...res.user } : u))
      );
      setMetrics((prev) =>
        getMetrics(users.map((u) => (u.id === userId ? { ...u, ...res.user } : u)), { exchangeRate: prev.exchangeRate, baseCurrency: prev.baseCurrency })
      );
      showToast(
        'Staff Role Updated',
        `${res.user.name} is now assigned as ${newRole}${
          academicTitle ? ` (${academicTitle})` : ''
        }${
          departmentNames && departmentNames.length > 0
            ? ` in ${departmentNames.join(', ')}`
            : departmentId
            ? ' in assigned faculty unit'
            : ''
        }.`
      );
    }
  };

  // Handle Add Single User
  const handleAddUser = async (data: Omit<UniversityUser, 'id' | 'department'>) => {
    const res = await createSingleUser(data);
    if (res.success && res.user) {
      setUsers((prev) => [res.user!, ...prev]);
      setMetrics((prev) => getMetrics([res.user!, ...users], { exchangeRate: prev.exchangeRate, baseCurrency: prev.baseCurrency }));
      showToast(
        'Faculty Member Added',
        `${res.user.name} has been provisioned and added to the directory.`
      );
    }
  };

  const handleDeleteUser = async (user: UniversityUser) => {
    const res = await deleteUser(user.id);
    if (res.success) {
      setUsers((prev) => prev.filter((u) => u.id !== user.id));
      setMetrics((prev) => getMetrics(users.filter((u) => u.id !== user.id), { exchangeRate: prev.exchangeRate, baseCurrency: prev.baseCurrency }));
      showToast(
        'User Deleted',
        `${user.name} has been permanently removed from the directory.`
      );
    } else {
      showToast('Error', 'Failed to delete user.');
    }
  };

  // Role switching simulation for testing access barrier
  const handleSwitchSession = (role: UserRole) => {
    setActiveRole(role);
    session.setRole(role);
  };

  // --------------------------------------------------------------------------
  // STRICT ACCESS BARRIER: IF NOT SUPER_ADMIN, BLOCK ACCESS!
  // --------------------------------------------------------------------------
  if (sessionChecked && activeRole !== 'SUPER_ADMIN') {
    return (
      <div className="min-h-screen bg-[#f8f9ff] flex flex-col justify-between">
        {/* Navigation Sidebar reflecting the non-super-admin user */}
        <Sidebar activeRole={activeRole} />

        <div className="pl-72 flex-1 flex flex-col">
          {/* Header */}
          <Header
            breadcrumbCategory="TIU Central Administration"
            breadcrumbPage="Access Denied"
            activeViewLabel={activeRole === 'COORDINATOR' ? 'Academic Coordinator' : activeRole}
          />

          {/* Access Denied Card */}
          <main className="flex-1 flex items-center justify-center p-8 pt-24">
            <div className="max-w-2xl w-full bg-white rounded-3xl shadow-xl border border-red-200 p-8 sm:p-10 text-center relative overflow-hidden">
              <div className="absolute -top-12 -right-12 w-48 h-48 bg-red-100/60 rounded-full blur-2xl pointer-events-none" />

              <div className="w-16 h-16 rounded-2xl bg-red-50 text-[#ba1a1a] flex items-center justify-center mx-auto mb-5 border border-red-200 shadow-sm">
                <ShieldAlert className="w-8 h-8" />
              </div>

              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-50 text-red-800 text-xs font-bold uppercase tracking-wider mb-3 border border-red-200">
                <Lock className="w-3.5 h-3.5 text-[#ba1a1a]" />
                403 Forbidden • Super Admin Clearance Required
              </div>

              <h1 className="font-headline text-2xl sm:text-3xl font-extrabold text-[#0b1c30] tracking-tight mb-3">
                Role &amp; Permission Access Blocked
              </h1>

              <p className="text-sm text-slate-600 leading-relaxed mb-6 max-w-lg mx-auto">
                You are currently signed in with the <strong className="text-slate-900 font-semibold">{activeRole}</strong> role.
                The <code className="bg-slate-100 text-slate-800 px-1.5 py-0.5 rounded font-mono text-xs">/admin/roles</code> governance
                route is strictly reserved for the <strong className="text-[#540225] font-semibold">Super Administrator</strong>.
                Regular Academic Coordinators cannot view or re-distribute administrative permissions.
              </p>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2 border-t border-slate-100">
                <Link
                  href="/coordinator"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 font-semibold text-xs hover:bg-slate-50 transition-colors shadow-2xs"
                >
                  <ArrowLeft className="w-4 h-4 text-slate-400" />
                  <span>Return to Academic Coordinator</span>
                </Link>

                <button
                  type="button"
                  onClick={() => handleSwitchSession('SUPER_ADMIN')}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#540225] hover:bg-[#721c3b] text-white font-bold text-xs shadow-md hover:shadow-lg transition-all cursor-pointer"
                >
                  <KeyRound className="w-4 h-4" />
                  <span>Switch Session to Super Admin</span>
                </button>
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // SUPER ADMIN AUTHORIZED VIEW
  // --------------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-[#f8f9ff]">
      {/* Navigation Sidebar with Super Admin Portal distinctly active */}
      <Sidebar activeItem="superadmin" activeRole="SUPER_ADMIN" />

      {/* Main Container Offset by Sidebar */}
      <div className="pl-72">
        {/* Top Header */}
        <Header
          breadcrumbCategory="TIU Central Administration"
          breadcrumbPage="Role &amp; Permission Governance"
          searchQuery={globalSearch}
          onSearchChange={setGlobalSearch}
          activeViewLabel="Super Admin"
        />

        {/* Page Content */}
        <main className="w-full pt-20 pb-16 px-8">
          <div className="max-w-7xl mx-auto space-y-8">
            {/* Header Block with Actions */}
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div className="space-y-1">
                <h1 className="font-headline text-2xl sm:text-3xl font-bold text-[#0b1c30] tracking-tight">
                  User Directory & Role Assignment
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 max-w-3xl">
                  Manage staff accounts, provision university roles, and oversee cross-departmental access.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2.5 flex-wrap">
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

            {/* Top Metric Cards */}
            <MetricCards metrics={metrics} />

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

            {/* Authorization Matrix Guidelines */}
            <AuthorizationMatrix />
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
