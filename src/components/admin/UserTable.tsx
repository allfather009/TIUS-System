'use client';

import React, { useState, useMemo } from 'react';
import { UniversityUser, Department, UserRole } from '@/types/database';
import {
  Search,
  FileSpreadsheet,
  Download,
  RotateCw,
  Edit2,
  ChevronDown,
  X,
  Eye,
  Shield,
  Trash2,
  AlertCircle,
  MoreVertical,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { useSession } from '@/lib/context/SessionContext';
import { CustomSelect, CustomSelectOption } from '@/components/ui/CustomSelect';

interface UserTableProps {
  users: UniversityUser[];
  departments: Department[];
  onEditUser?: (user: UniversityUser) => void;
  onDeleteUser?: (user: UniversityUser) => void;
  onRefresh?: () => void;
  isReadOnly?: boolean;
  title?: string;
}

export function UserTable({
  users,
  departments,
  onEditUser,
  onDeleteUser,
  onRefresh,
  isReadOnly = false,
  title,
}: UserTableProps) {
  const [search, setSearch] = useState('');
  const [selectedDept, setSelectedDept] = useState<string>('ALL');
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ACTIVE');
  const [userToDelete, setUserToDelete] = useState<UniversityUser | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 8;
  const session = useSession();

  // Filter out myself (logged in user) and Super Admins from the faculty & staff directory table
  const directoryUsers = useMemo(() => {
    return users.filter((u) => {
      // Do not show Super Admin in the faculty & staff directory table
      if (u.role === 'SUPER_ADMIN' || u.email?.toLowerCase() === 'barez.hassan@tiu.edu.iq') return false;
      if (!isReadOnly) {
        // In admin governance mode, don't show myself
        if (session.user?.id && u.id === session.user.id) return false;
        if (session.user?.email && u.email?.toLowerCase() === session.user.email.toLowerCase()) return false;
      }
      return true;
    });
  }, [users, session.user, isReadOnly]);

  // Filtered users
  const filteredUsers = useMemo(() => {
    return directoryUsers.filter((u) => {
      // Search
      const searchLower = search.toLowerCase();
      const matchesSearch =
        !search ||
        u.name.toLowerCase().includes(searchLower) ||
        u.email.toLowerCase().includes(searchLower) ||
        (u.staff_id && u.staff_id.toLowerCase().includes(searchLower)) ||
        (u.academic_title && u.academic_title.toLowerCase().includes(searchLower)) ||
        (u.department?.name && u.department.name.toLowerCase().includes(searchLower));

      // Department
      const matchesDept =
        selectedDept === 'ALL' ||
        u.department_id === selectedDept ||
        (Array.isArray(u.department_ids) && u.department_ids.includes(selectedDept));

      // Role
      const matchesRole =
        selectedRoleFilter === 'ALL' || u.role === selectedRoleFilter;

      // Status
      const matchesStatus =
        selectedStatus === 'ALL' || (selectedStatus === 'ACTIVE' && u.is_active !== false);

      return matchesSearch && matchesDept && matchesRole && matchesStatus;
    });
  }, [directoryUsers, search, selectedDept, selectedRoleFilter, selectedStatus]);

  // Counts for role quick filters
  const counts = useMemo(() => {
    return {
      all: directoryUsers.length,
      coordinators: directoryUsers.filter((u) => u.role === 'COORDINATOR').length,
      hods: directoryUsers.filter((u) => u.role === 'HOD').length,
      deans: directoryUsers.filter((u) => u.role === 'DEAN').length,
      viceDeans: directoryUsers.filter((u) => u.role === 'VICE_DEAN').length,
      teachers: directoryUsers.filter((u) => u.role === 'TEACHER').length,
      itAdmins: directoryUsers.filter((u) => u.role === 'IT_ADMIN').length,
      accountants: directoryUsers.filter((u) => u.role === 'ACCOUNTANT').length,
    };
  }, [directoryUsers]);

  // Pagination
  const totalPages = Math.ceil(filteredUsers.length / pageSize) || 1;

  // Reset currentPage to 1 whenever search or filter options change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [search, selectedDept, selectedRoleFilter, selectedStatus]);

  const paginatedUsers = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredUsers.slice(start, start + pageSize);
  }, [filteredUsers, currentPage, pageSize]);

  // Windowed pagination items with smart ellipsis
  const paginationItems = useMemo(() => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const items: (number | string)[] = [];

    if (currentPage <= 3) {
      // Near beginning: 1, 2, 3, 4, '...', totalPages
      for (let i = 1; i <= 4; i++) {
        items.push(i);
      }
      items.push('...');
      items.push(totalPages);
    } else if (currentPage >= totalPages - 2) {
      // Near end: 1, '...', totalPages - 3, totalPages - 2, totalPages - 1, totalPages
      items.push(1);
      items.push('...');
      for (let i = totalPages - 3; i <= totalPages; i++) {
        items.push(i);
      }
    } else {
      // In middle: 1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages
      items.push(1);
      items.push('...');
      items.push(currentPage - 1);
      items.push(currentPage);
      items.push(currentPage + 1);
      items.push('...');
      items.push(totalPages);
    }

    return items;
  }, [currentPage, totalPages]);

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'SUPER_ADMIN':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#540225]/10 text-[#540225] border border-[#540225]/20">
            <span className="w-1.5 h-1.5 rounded-full bg-[#540225]" />
            Super Admin
          </span>
        );
      case 'IT_ADMIN':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-cyan-50 text-cyan-800 border border-cyan-200">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-600" />
            IT Support Admin
          </span>
        );
      case 'COORDINATOR':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-600" />
            Coordinator
          </span>
        );
      case 'DEAN':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-50 text-purple-800 border border-purple-200">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-600" />
            Dean
          </span>
        );
      case 'VICE_DEAN':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-fuchsia-50 text-fuchsia-800 border border-fuchsia-200">
            <span className="w-1.5 h-1.5 rounded-full bg-fuchsia-600" />
            Vice Dean
          </span>
        );
      case 'HOD':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
            HoD
          </span>
        );
      case 'ACCOUNTANT':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-600" />
            Accountant
          </span>
        );
      case 'TEACHER':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
            Teacher
          </span>
        );
    }
  };



  const deptFilterOptions: CustomSelectOption[] = useMemo(() => {
    return [
      { value: 'ALL', label: 'All Faculties & Units' },
      ...departments.map((d) => ({
        value: d.id,
        label: d.name,
        badge: d.code || undefined,
      })),
    ];
  }, [departments]);

  const statusFilterOptions: CustomSelectOption[] = [
    { value: 'ACTIVE', label: 'Active Staff' },
    { value: 'ALL', label: 'All Records' },
  ];

  return (
    <div className="space-y-4">
      {/* Search & Filtration Bar */}
      <div className="p-4 rounded-2xl bg-white shadow-xs border border-slate-100 space-y-3">
        <div className="flex flex-col md:flex-row items-center gap-3">
          {/* Search Input */}
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search faculty name, staff ID, or academic email..."
              className="w-full h-10 pl-9 pr-9 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#721c3b]/30 focus:bg-white transition-all"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Department Filter */}
          <div className="w-full md:w-64">
            <CustomSelect
              value={selectedDept}
              onChange={(val) => {
                setSelectedDept(val);
                setCurrentPage(1);
              }}
              options={deptFilterOptions}
              placeholder="All Faculties & Units"
              searchPlaceholder="Filter departments..."
              triggerClassName="h-10"
            />
          </div>

          {/* Status Filter */}
          <div className="w-full md:w-40">
            <CustomSelect
              value={selectedStatus}
              onChange={(val) => {
                setSelectedStatus(val);
                setCurrentPage(1);
              }}
              options={statusFilterOptions}
              placeholder="Filter status..."
              searchable={false}
              triggerClassName="h-10"
            />
          </div>
        </div>

        {/* Quick Role Filter Pills */}
        <div className="flex items-center gap-2 pt-2 border-t border-slate-50 overflow-x-auto text-xs pb-1">
          <span className="text-slate-400 font-bold uppercase text-[10px] tracking-wider shrink-0 mr-1">
            Quick Filters:
          </span>
          <button
            onClick={() => {
              setSelectedRoleFilter('ALL');
              setCurrentPage(1);
            }}
            className={`px-3 py-1 rounded-full font-semibold transition-all shrink-0 cursor-pointer ${
              selectedRoleFilter === 'ALL'
                ? 'bg-[#540225] text-white shadow-2xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            All Roles ({counts.all})
          </button>
          {(counts.coordinators > 0 || !isReadOnly) && (
            <button
              onClick={() => {
                setSelectedRoleFilter('COORDINATOR');
                setCurrentPage(1);
              }}
              className={`px-3 py-1 rounded-full font-semibold transition-all shrink-0 cursor-pointer ${
                selectedRoleFilter === 'COORDINATOR'
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Coordinators ({counts.coordinators})
            </button>
          )}
          {(counts.deans > 0 || !isReadOnly) && (
            <button
              onClick={() => {
                setSelectedRoleFilter('DEAN');
                setCurrentPage(1);
              }}
              className={`px-3 py-1 rounded-full font-semibold transition-all shrink-0 cursor-pointer ${
                selectedRoleFilter === 'DEAN'
                  ? 'bg-purple-600 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Deans ({counts.deans})
            </button>
          )}
          {(counts.viceDeans > 0 || !isReadOnly) && (
            <button
              onClick={() => {
                setSelectedRoleFilter('VICE_DEAN');
                setCurrentPage(1);
              }}
              className={`px-3 py-1 rounded-full font-semibold transition-all shrink-0 cursor-pointer ${
                selectedRoleFilter === 'VICE_DEAN'
                  ? 'bg-fuchsia-600 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Vice Deans ({counts.viceDeans})
            </button>
          )}
          {(counts.hods > 0 || !isReadOnly) && (
            <button
              onClick={() => {
                setSelectedRoleFilter('HOD');
                setCurrentPage(1);
              }}
              className={`px-3 py-1 rounded-full font-semibold transition-all shrink-0 cursor-pointer ${
                selectedRoleFilter === 'HOD'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              HoDs ({counts.hods})
            </button>
          )}
          {(counts.teachers > 0 || !isReadOnly) && (
            <button
              onClick={() => {
                setSelectedRoleFilter('TEACHER');
                setCurrentPage(1);
              }}
              className={`px-3 py-1 rounded-full font-semibold transition-all shrink-0 cursor-pointer ${
                selectedRoleFilter === 'TEACHER'
                  ? 'bg-slate-700 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Teachers ({counts.teachers})
            </button>
          )}
          {(counts.itAdmins > 0 || !isReadOnly) && (
            <button
              onClick={() => {
                setSelectedRoleFilter('IT_ADMIN');
                setCurrentPage(1);
              }}
              className={`px-3 py-1 rounded-full font-semibold transition-all shrink-0 cursor-pointer ${
                selectedRoleFilter === 'IT_ADMIN'
                  ? 'bg-cyan-700 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              IT Support ({counts.itAdmins})
            </button>
          )}
          {(counts.accountants > 0 || !isReadOnly) && (
            <button
              onClick={() => {
                setSelectedRoleFilter('ACCOUNTANT');
                setCurrentPage(1);
              }}
              className={`px-3 py-1 rounded-full font-semibold transition-all shrink-0 cursor-pointer ${
                selectedRoleFilter === 'ACCOUNTANT'
                  ? 'bg-amber-600 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Accountants ({counts.accountants})
            </button>
          )}
        </div>
      </div>

      {/* Directory Table Container */}
      <div className="bg-white rounded-2xl shadow-xs border border-slate-100 overflow-hidden">
        {/* Table Top Bar */}
        <div className="p-4 px-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h3 className="font-headline font-bold text-base text-[#0b1c30]">
              {title || 'Faculty & Staff Directory'}
            </h3>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#eff4ff]/60 border-b border-slate-100 text-[11px] uppercase tracking-wider text-slate-400 font-bold">
                <th className="py-3.5 px-6">Name &amp; Academic Title</th>
                <th className="py-3.5 px-6">Institutional Email</th>
                <th className="py-3.5 px-6">Current Department</th>
                <th className="py-3.5 px-6">Assigned Role</th>
                <th className="py-3.5 px-6">Status</th>
                {!isReadOnly && <th className="py-3.5 px-6 text-right">Action</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {users.length === 0 ? (
                <tr>
                  <td colSpan={isReadOnly ? 5 : 6} className="py-16 text-center">
                    <div className="flex flex-col items-center justify-center max-w-sm mx-auto space-y-2">
                      <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-1">
                        <Search className="w-5 h-5 text-slate-400" />
                      </div>
                      <p className="font-semibold text-sm text-slate-800">0 Users Found</p>
                      <p className="text-xs text-slate-500 leading-relaxed">
                        No faculty or staff accounts have been loaded or registered yet. Connect to Supabase or import them via the sidebar to populate the directory.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : paginatedUsers.length === 0 ? (
                <tr>
                  <td colSpan={isReadOnly ? 5 : 6} className="py-12 text-center text-slate-400">
                    No faculty or staff members match your filter criteria.
                  </td>
                </tr>
              ) : (
                paginatedUsers.map((user) => {
                  const avatar =
                    user.avatar_url ||
                    `https://ui-avatars.com/api/?name=${encodeURIComponent(
                      user.name
                    )}&background=e5eeff&color=0b1c30&bold=true`;

                  return (
                    <tr
                      key={user.id}
                      className="hover:bg-[#f8f9ff] transition-colors group"
                    >
                      {/* Name & Title */}
                      <td className="py-3.5 px-6">
                        <div className="flex items-center gap-3">
                          <img
                            src={avatar}
                            alt={user.name}
                            className="w-10 h-10 rounded-full object-cover ring-2 ring-slate-100 shadow-2xs shrink-0"
                          />
                          <div className="flex flex-col min-w-0">
                            <span className="font-bold text-[#0b1c30] group-hover:text-[#540225] transition-colors truncate">
                              {user.name}
                            </span>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-[11px] text-slate-500 truncate">
                                {user.academic_title || 'Lecturer'}
                              </span>
                              {['TEACHER', 'DEAN', 'VICE_DEAN', 'HOD'].includes(user.role) && (
                                <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                                  Cap: {user.max_weekly_hours != null ? user.max_weekly_hours : 8}h/wk
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Institutional Email */}
                      <td className="py-3.5 px-6 font-mono text-[11px] text-slate-600">
                        {user.email}
                      </td>

                      {/* Department */}
                      <td className="py-3.5 px-6">
                        {user.role === 'HOD' ? (
                          (() => {
                            const managedIds =
                              user.managed_department_ids && user.managed_department_ids.length > 0
                                ? user.managed_department_ids
                                : user.department_ids && user.department_ids.length > 0
                                ? user.department_ids
                                : user.department_id
                                ? [user.department_id]
                                : [];

                            const deptMap = new Map(departments.map((d) => [d.id, d.name]));
                            const resolvedNames = managedIds
                              .map((id) => deptMap.get(id) || id)
                              .filter(Boolean);

                            const displayNames =
                              resolvedNames.length > 0
                                ? resolvedNames
                                : user.departments && user.departments.length > 0
                                ? user.departments
                                : [user.department?.name || 'General Academic Department'];

                            return (
                              <div className="flex flex-wrap gap-1.5 max-w-xs">
                                {displayNames.map((name, idx) => (
                                  <span
                                    key={idx}
                                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-900 border border-amber-200 shadow-2xs"
                                  >
                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-600 shrink-0" />
                                    <span>{name}</span>
                                  </span>
                                ))}
                              </div>
                            );
                          })()
                        ) : user.departments && user.departments.length > 1 ? (
                          <div className="flex flex-wrap gap-1 max-w-xs">
                            {user.departments.map((deptName, idx) => (
                              <span
                                key={idx}
                                className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-blue-50 text-blue-800 border border-blue-200"
                              >
                                {deptName}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="font-medium text-slate-700">
                            {user.department?.name || (user.departments && user.departments[0]) || 'Central Administration'}
                          </span>
                        )}
                      </td>

                      {/* Assigned Role */}
                      <td className="py-3.5 px-6">
                        <div className="flex items-center gap-2">
                          {getRoleBadge(user.role)}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-6">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 text-[11px] font-semibold border border-emerald-100">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          Active
                        </span>
                      </td>

                      {/* Action */}
                      {!isReadOnly && (
                        <td className="py-3.5 px-6 text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors cursor-pointer outline-none">
                                <MoreVertical className="w-4 h-4" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-40">
                              {session.realUser?.role === 'SUPER_ADMIN' && (
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    session.simulateUser(user);
                                  }}
                                  className="gap-2 cursor-pointer"
                                >
                                  <Eye className="w-4 h-4" /> Simulate User
                                </DropdownMenuItem>
                              )}
                              {onEditUser && (
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onEditUser(user);
                                  }}
                                  className="gap-2"
                                >
                                  <Edit2 className="w-4 h-4" /> Edit Role
                                </DropdownMenuItem>
                              )}
                              {onDeleteUser && (
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setUserToDelete(user);
                                  }}
                                  className="gap-2 text-red-600 focus:text-red-600 focus:bg-red-50"
                                >
                                  <Trash2 className="w-4 h-4" /> Delete User
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="p-4 px-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <div>
            Showing {filteredUsers.length === 0 ? 0 : (currentPage - 1) * pageSize + 1} to{' '}
            {Math.min(currentPage * pageSize, filteredUsers.length)} of {filteredUsers.length}{' '}
            records
          </div>

          <div className="flex items-center gap-1.5 flex-wrap justify-center">
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-medium cursor-pointer"
            >
              Previous
            </button>

            {paginationItems.map((item, idx) =>
              item === '...' ? (
                <span
                  key={`ellipsis-${idx}`}
                  className="w-8 h-8 flex items-center justify-center text-slate-400 font-bold select-none"
                >
                  …
                </span>
              ) : (
                <button
                  key={item}
                  type="button"
                  onClick={() => setCurrentPage(item as number)}
                  className={`w-8 h-8 rounded-xl font-bold transition-all cursor-pointer ${
                    currentPage === item
                      ? 'bg-[#540225] text-white shadow-2xs'
                      : 'text-slate-600 hover:bg-slate-100 border border-transparent'
                  }`}
                >
                  {item}
                </button>
              )
            )}

            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-medium cursor-pointer"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {userToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full border border-slate-200 overflow-hidden text-left flex flex-col p-6">
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mb-2 border border-red-100">
                <AlertCircle className="w-8 h-8 text-red-500" />
              </div>
              <h2 className="font-headline text-xl font-bold text-slate-900">
                Delete User?
              </h2>
              <p className="text-sm text-slate-500 leading-relaxed">
                Are you sure you want to permanently delete <strong>{userToDelete.name}</strong>? This action cannot be undone.
              </p>
            </div>
            <div className="flex gap-3 mt-8 w-full">
              <button
                onClick={() => setUserToDelete(null)}
                className="flex-1 px-5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onDeleteUser?.(userToDelete);
                  setUserToDelete(null);
                }}
                className="flex-1 px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
