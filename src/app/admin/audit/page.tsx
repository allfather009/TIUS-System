'use client';

import React from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { useSession } from '@/lib/context/SessionContext';

export default function AuditLogsPage() {
  const { user, activeViewLabel } = useSession();

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
                This module is currently under development. It will soon provide a chronological, immutable record of all administrative system changes and actions.
              </p>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
