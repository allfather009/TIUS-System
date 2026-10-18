'use client';

import React, { useState } from 'react';
import { useSession } from '@/lib/context/SessionContext';

interface HeaderProps {
  breadcrumbCategory?: string;
  breadcrumbPage?: string;
  searchPlaceholder?: string;
  activeViewLabel?: string;
  customPermissions?: Record<string, boolean>;
  searchQuery?: string;
  onSearchChange?: (val: string) => void;
}

export function Header({
  breadcrumbCategory = 'TIU Academic Portal',
  breadcrumbPage = 'Extra Hours & Payroll',
}: HeaderProps) {
  const session = useSession();
  const [imageError, setImageError] = useState(false);

  // Extract active user dynamically from session state (powers both Header and Sidebar)
  const user = session?.user || session?.activeUser;

  // 1. Name: user?.name || 'Unknown User'
  const name = user?.name || 'Unknown User';

  // 2. Subtitle/Role: user?.academic_title or fallback to formatting user?.role (replacing underscores with spaces)
  const formatRole = (role?: string) => {
    if (!role) return 'Faculty';
    return role.replace(/_/g, ' ');
  };

  const subtitle =
    user?.academic_title ||
    user?.roleTitle ||
    formatRole(user?.role);

  // 3. Avatar: user?.avatar_url if exists, otherwise generate dynamic initials
  const avatarUrl = user?.avatar_url || user?.avatarUrl || null;

  // Reset image error if avatarUrl changes
  React.useEffect(() => {
    setImageError(false);
  }, [avatarUrl]);

  // Generate initials dynamically from user?.name (e.g. user?.name.split(' ').map(n => n[0]).join(''))
  const getInitials = (nameStr?: string) => {
    if (!nameStr) return 'U';
    const parts = nameStr.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return 'U';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  };

  const initials = getInitials(name);

  const isSimulating = session?.isSimulating || session?.user?.isSimulation;

  return (
    <header className={`fixed ${isSimulating ? 'top-10' : 'top-0'} left-72 right-0 h-16 bg-white/95 backdrop-blur-xl border-b border-slate-100 shadow-[0_1px_8px_rgba(0,0,0,0.03)] z-40 flex items-center justify-between px-8 transition-all`}>
      {/* Left: Breadcrumbs */}
      <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
        <span className="hover:text-slate-800 cursor-pointer transition-colors">{breadcrumbCategory}</span>
        <span className="text-slate-300">/</span>
        <span className="font-semibold text-[#540225]">{breadcrumbPage}</span>
      </div>

      {/* Right: Dynamic User Profile Badge */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3">
          {avatarUrl && !imageError ? (
            <img
              alt={name}
              className="w-9 h-9 rounded-full object-cover ring-2 ring-[#721c3b]/15 shadow-sm"
              src={avatarUrl}
              onError={() => setImageError(true)}
            />
          ) : (
            <div
              className="w-9 h-9 rounded-full bg-[#eff4ff] text-[#0b1c30] border border-blue-100 flex items-center justify-center font-bold text-xs shadow-2xs tracking-tight shrink-0 select-none ring-2 ring-[#721c3b]/10"
              title={name}
            >
              {initials}
            </div>
          )}
          <div className="hidden sm:flex flex-col text-left">
            <span className="text-xs font-bold text-slate-900 leading-tight">
              {name}
            </span>
            <span className="text-[11px] text-slate-500 leading-tight font-medium capitalize">
              {subtitle}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
