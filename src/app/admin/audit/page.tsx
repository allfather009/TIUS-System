'use client';

import React from 'react';
import Link from 'next/link';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { useSession } from '@/lib/context/SessionContext';
import { ShieldAlert, Lock } from 'lucide-react';

export default function AuditLogsPage() {
  const { user, role, isSuperAdmin, hasPermission, activeViewLabel } = useSession();
  const activeRole = role || 'TEACHER';

  const isAuthorized =
    isSuperAdmin ||
    activeRole === 'SUPER_ADMIN' ||
    hasPermission?.('can_audit_logs') ||
    user?.custom_permissions?.['can_audit_logs'] === true;

  if (role && !isAuthorized) {
    return (
      <div className="min-h-screen bg-[#f8f9ff] flex flex-col justify-between">
        <Sidebar activeRole={activeRole} />
        <div className="pl-72 flex-1 flex flex-col">
          <Header
            breadcrumbCategory="TIU Central Administration"
            breadcrumbPage="Access Denied"
            activeViewLabel={activeViewLabel}
          />
          <main className="flex-1 flex items-center justify-center p-8 pt-24">
            <div className="max-w-2xl w-full bg-white rounded-3xl shadow-xl border border-red-200 p-8 sm:p-10 text-center relative overflow-hidden">
              <div className="w-16 h-16 rounded-2xl bg-red-50 text-[#ba1a1a] flex items-center justify-center mx-auto mb-5 border border-red-200 shadow-sm">
                <ShieldAlert className="w-8 h-8" />
              </div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-50 text-red-800 text-xs font-bold uppercase tracking-wider mb-3 border border-red-200">
                <Lock className="w-3.5 h-3.5 text-[#ba1a1a]" />
                403 Forbidden • Clearance Required
              </div>
              <h1 className="font-headline text-2xl sm:text-3xl font-extrabold text-[#0b1c30] tracking-tight mb-3">
                Audit Logs Access Blocked
              </h1>
              <p className="text-sm text-slate-500 max-w-md mx-auto mb-6">
                You do not possess the required clearance (<code className="font-mono text-xs bg-slate-100 px-1 py-0.5 rounded">can_audit_logs</code>) to view administrative audit trails.
              </p>
              <Link
                href="/admin/roles"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#540225] hover:bg-[#721c3b] text-white text-xs font-bold transition-all"
              >
                Return to User Directory
              </Link>
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8f9ff]">
      <Sidebar activeItem="audit-logs" />
      <div className="pl-72">
        <Header
          breadcrumbCategory="Management &amp; System"
          breadcrumbPage="Audit Logs"
          activeViewLabel={activeViewLabel}
        />
        <main className="w-full pt-20 pb-16 px-8">
          <div className="max-w-7xl mx-auto space-y-8">
            <h1 className="font-headline text-2xl sm:text-3xl font-bold text-[#0b1c30] tracking-tight">
              Audit Logs
            </h1>
            <div className="p-6 bg-white rounded-2xl shadow-xs border border-slate-100">
              <p className="text-sm text-slate-500">
                This module provides a chronological, immutable record of all administrative system changes and actions.
              </p>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
