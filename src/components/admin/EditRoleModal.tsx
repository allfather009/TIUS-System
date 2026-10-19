'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { UniversityUser, Department, UserRole, AcademicRate, SystemSettings } from '@/types/database';
import { X, ShieldAlert, Check, Building2 } from 'lucide-react';
import { getAcademicRates, getRateForTitle } from '@/lib/services/rateService';
import { getSystemSettings } from '@/lib/services/systemSettingsService';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import {
  CustomSelect,
  CustomMultiSelect,
  CustomSelectOption,
  CustomSelectGroup,
} from '@/components/ui/CustomSelect';

interface EditRoleModalProps {
  user: UniversityUser | null;
  departments: Department[];
  allUsers: UniversityUser[];
  isOpen: boolean;
  onClose: () => void;
  onSave: (
    userId: string,
    newRole: UserRole,
    departmentId?: string | null,
    academicTitle?: string | null,
    hourlyRate?: number | null,
    departmentIds?: string[] | null,
    departmentNames?: string[] | null
  ) => Promise<void>;
}

export function EditRoleModal({
  user,
  departments,
  allUsers,
  isOpen,
  onClose,
  onSave,
}: EditRoleModalProps) {
  const [selectedRole, setSelectedRole] = useState<UserRole>('TEACHER');
  const [selectedDeptIds, setSelectedDeptIds] = useState<string[]>([]);
  const [academicTitle, setAcademicTitle] = useState<string>('Lecturer');
  const [rates, setRates] = useState<AcademicRate[]>([]);
  const [saving, setSaving] = useState(false);
  const [sysSettings, setSysSettings] = useState<SystemSettings | null>(null);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    setImageError(false);
  }, [user?.id, user?.avatar_url]);

  const getInitials = (nameStr?: string) => {
    if (!nameStr) return 'U';
    const parts = nameStr.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return 'U';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return parts.map((n) => n[0]).join('').slice(0, 2).toUpperCase();
  };

  useEffect(() => {
    async function loadData() {
      try {
        const [fetchedRates, settings] = await Promise.all([
          getAcademicRates(),
          getSystemSettings(),
        ]);
        if (fetchedRates && fetchedRates.length > 0) {
          setRates(fetchedRates);
        }
        setSysSettings(settings);
      } catch (err) {
        console.error('Error fetching data in EditRoleModal:', err);
      }
    }
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  const fmtRate = (usdRate: number) => {
    if (!sysSettings) return `$${usdRate.toFixed(2)}`;
    if (sysSettings.base_currency === 'IQD') {
      return `IQD ${(usdRate * (sysSettings.exchange_rate / 100)).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
    }
    return `$${usdRate.toFixed(2)}`;
  };

  const [prevUserId, setPrevUserId] = useState<string | null>(null);
  if (user && user.id !== prevUserId) {
    setPrevUserId(user.id);
    setSelectedRole(user.role);
    const initialDeptIds =
      user.department_ids && user.department_ids.length > 0
        ? user.department_ids
        : user.department_id
        ? [user.department_id]
        : departments[0]?.id
        ? [departments[0].id]
        : [];
    setSelectedDeptIds(initialDeptIds);
    setAcademicTitle(user.academic_title || 'Lecturer');
    setImageError(false);
  }

  // Filter & group departments for multi-select
  const departmentGroups: CustomSelectGroup[] = useMemo(() => {
    const groupsMap: Record<string, CustomSelectOption[]> = {};
    departments.forEach((d) => {
      const faculty = d.faculty || 'Other Departments';
      if (!groupsMap[faculty]) groupsMap[faculty] = [];
      groupsMap[faculty].push({
        value: d.id,
        label: d.name + (d.code ? ` (${d.code})` : ''),
        badge: d.code || undefined,
      });
    });
    return Object.entries(groupsMap).map(([faculty, options]) => ({
      group: faculty,
      options,
    }));
  }, [departments]);

  const roleOptions: CustomSelectOption[] = [
    { value: 'TEACHER', label: 'Teacher (Lecturer / Lab)', description: 'Self-Service Overtime Logging' },
    { value: 'HOD', label: 'Head of Department (HoD)', description: 'Departmental Approval Lead' },
    { value: 'COORDINATOR', label: 'Academic Coordinator', description: 'Cross-Faculty Audits & Quotas' },
    { value: 'ACCOUNTANT', label: 'Payroll & Finance Officer', description: 'Cash Disbursal & Auditing' },
  ];

  const academicTitleOptions: CustomSelectOption[] = useMemo(() => {
    return rates
      .filter((r) => r.is_active !== false || r.title === academicTitle)
      .map((r) => ({
        value: r.title,
        label: `${r.title} — ${fmtRate(Number(r.hourly_rate))}/hr${r.is_active === false ? ' (Deactivated)' : ''}`,
        badge: fmtRate(Number(r.hourly_rate)),
      }));
  }, [rates, academicTitle, sysSettings]);

  if (!isOpen || !user) return null;

  // Find existing HoDs in any of the selected departments
  const existingHodsInSelectedDepts = allUsers.filter(
    (u) =>
      u.role === 'HOD' &&
      u.id !== user.id &&
      selectedDeptIds.some(
        (deptId) =>
          u.department_id === deptId ||
          (u.department_ids && u.department_ids.includes(deptId))
      )
  );

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedRole === 'HOD' && selectedDeptIds.length === 0) {
      return;
    }
    setSaving(true);
    try {
      const calculatedRate =
        selectedRole === 'TEACHER'
          ? getRateForTitle(academicTitle, rates)
          : undefined;

      const primaryDeptId = selectedDeptIds[0] || null;
      const deptNames = selectedDeptIds.map(
        (id) => departments.find((d) => d.id === id)?.name || id
      );

      await onSave(
        user.id,
        selectedRole,
        ['TEACHER', 'HOD'].includes(selectedRole) ? primaryDeptId : null,
        selectedRole === 'TEACHER' ? academicTitle : user.academic_title,
        calculatedRate,
        ['TEACHER', 'HOD'].includes(selectedRole) ? selectedDeptIds : null,
        ['TEACHER', 'HOD'].includes(selectedRole) ? deptNames : null
      );
      onClose();
    } catch (err) {
      console.error('Failed to update role:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden text-left flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-6 pb-4 border-b border-slate-100 flex items-start justify-between">
          <div className="space-y-1">
            <h2 className="font-headline text-xl font-bold text-[#0b1c30]">
              Edit User Role &amp; Permissions
            </h2>
            <p className="text-xs text-slate-500">
              Update institutional authorization for{' '}
              <strong className="text-slate-800 font-semibold">{user.name}</strong> ({user.email})
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleFormSubmit} className="p-6 space-y-5 overflow-y-auto flex-1">
          {/* Current Access Card */}
          <div className="p-3.5 rounded-2xl bg-[#eff4ff] border border-blue-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {user.avatar_url && !imageError ? (
                <img
                  src={user.avatar_url}
                  alt={user.name}
                  className="w-10 h-10 rounded-full object-cover ring-2 ring-white shadow-2xs shrink-0"
                  onError={() => setImageError(true)}
                />
              ) : (
                <div
                  className="w-10 h-10 rounded-full bg-[#dbeafe] text-[#0b1c30] border border-blue-200 flex items-center justify-center font-bold text-xs shadow-2xs tracking-tight shrink-0 select-none ring-2 ring-white"
                  title={user.name}
                >
                  {getInitials(user.name)}
                </div>
              )}
              <div className="flex flex-col">
                <span className="text-xs font-bold text-[#0b1c30]">{user.name}</span>
                <span className="text-[11px] text-slate-600">
                  Current: {user.role} •{' '}
                  {user.departments && user.departments.length > 1
                    ? user.departments.join(', ')
                    : user.department?.name || (user.departments && user.departments[0]) || 'Central Administration'}
                </span>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-[#ffdea8] text-[#271900] text-[11px] font-mono font-bold">
              {user.staff_id || 'UID #TIU-4119'}
            </span>
          </div>

          {/* Role Selection */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
              Select New System Role <span className="text-red-500">*</span>
            </label>
            <Select value={selectedRole} onValueChange={(val) => setSelectedRole(val as UserRole)}>
              <SelectTrigger className="w-full min-h-[44px] h-11 px-3.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-800 hover:border-slate-300 hover:bg-white focus:ring-2 focus:ring-[#721c3b]/30 focus:border-[#721c3b] focus:bg-white transition-all shadow-xs cursor-pointer">
                <SelectValue placeholder="Select a role...">
                  {roleOptions.find((r) => r.value === selectedRole)?.label || selectedRole}
                </SelectValue>
              </SelectTrigger>
              <SelectContent
                position="popper"
                side="bottom"
                sideOffset={4}
                className="z-[100] max-h-72 w-[var(--radix-select-trigger-width)] rounded-2xl border border-slate-200 bg-white p-1.5 shadow-2xl"
              >
                {roleOptions.map((opt) => (
                  <SelectItem
                    key={opt.value}
                    value={opt.value}
                    className="rounded-xl px-3 py-2.5 text-xs cursor-pointer focus:bg-[#540225]/10 data-[state=checked]:bg-[#540225]/10 my-0.5"
                  >
                    <div className="flex flex-col text-left">
                      <span className="font-semibold text-slate-900">{opt.label}</span>
                      {opt.description && (
                        <span className="text-[10px] text-slate-500 font-normal mt-0.5">
                          {opt.description}
                        </span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-slate-500">
              {selectedRole === 'HOD'
                ? 'Assigning HoD grants approval rights for submitted lecture, lab, and exam supervisory hours.'
                : selectedRole === 'COORDINATOR'
                ? 'Coordinators have university-wide oversight and configure cross-faculty teaching quotas.'
                : selectedRole === 'ACCOUNTANT'
                ? 'Accountants verify timesheets and execute central cash payouts.'
                : 'Teachers can submit weekly overtime claims, makeup logs, and view approval status.'}
            </p>
          </div>

          {/* Mandatory Academic Title Dropdown for TEACHER */}
          {selectedRole === 'TEACHER' && (
            <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-300 space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <span>Academic Title &amp; Hourly Rate Tier</span>
                  <span className="text-red-500">*</span>
                </label>
                <span className="text-xs font-bold text-amber-950 font-mono bg-amber-100/90 px-2.5 py-0.5 rounded-md border border-amber-300">
                  {fmtRate(getRateForTitle(academicTitle, rates))} / hr
                </span>
              </div>
              <p className="text-[11px] text-amber-900 leading-snug">
                Select the official faculty title from the university rate schedule to govern overtime reimbursement.
              </p>
              <CustomSelect
                value={academicTitle}
                onChange={setAcademicTitle}
                options={academicTitleOptions}
                placeholder="Select Title..."
                variant="amber"
                placement="bottom"
              />
            </div>
          )}

          {/* Department Affiliation / Multi-Department Jurisdiction (Available for TEACHER and HOD) */}
          {['TEACHER', 'HOD'].includes(selectedRole) && (
            <div
              className={`p-4 rounded-2xl border space-y-3 transition-all ${
                selectedRole === 'HOD'
                  ? 'bg-amber-50/80 border-amber-300'
                  : 'bg-slate-50 border-slate-200'
              }`}
            >
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Building2
                      className={`w-4 h-4 ${
                        selectedRole === 'HOD' ? 'text-[#7c5800]' : 'text-slate-600'
                      }`}
                    />
                    <label
                      className={`text-xs font-bold ${
                        selectedRole === 'HOD' ? 'text-[#271900]' : 'text-slate-800'
                      }`}
                    >
                      Linked Department Affiliation {selectedRole === 'HOD' && <span className="text-red-500">*</span>}
                    </label>
                  </div>
                  {selectedDeptIds.length > 0 && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-200/80 text-amber-900 border border-amber-300">
                      {selectedDeptIds.length} {selectedDeptIds.length === 1 ? 'Department' : 'Departments'}
                    </span>
                  )}
                </div>
                <p
                  className={`text-[11px] leading-snug ${
                    selectedRole === 'HOD' ? 'text-amber-900 font-medium' : 'text-slate-500'
                  }`}
                >
                  {selectedRole === 'HOD'
                    ? 'An acting HoD can be affiliated with multiple departments simultaneously to govern faculty hours, audit logs, and approve timesheets across all assigned units.'
                    : 'Assign academic department jurisdictions for timesheet tracking and departmental rollup.'}
                </p>
              </div>

              {/* Multi-Select Component with Removable Tags/Pills */}
              <CustomMultiSelect
                values={selectedDeptIds}
                onChange={setSelectedDeptIds}
                options={departmentGroups}
                variant={selectedRole === 'HOD' ? 'amber' : 'default'}
                placeholder="Select one or more departments..."
                searchPlaceholder="Filter departments..."
              />

              {selectedRole === 'HOD' && selectedDeptIds.length === 0 && (
                <p className="text-[11px] text-red-600 font-semibold">
                  * At least one department affiliation must be selected for an HoD.
                </p>
              )}

              {selectedRole === 'HOD' && existingHodsInSelectedDepts.length > 0 && (
                <div className="flex items-start gap-2 text-[11px] text-amber-900 bg-white/90 p-2.5 rounded-xl border border-amber-200">
                  <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    Active HoD in selected jurisdiction:{' '}
                    <strong className="font-semibold text-slate-900">
                      {existingHodsInSelectedDepts.map((u) => u.name).join(', ')}
                    </strong>.
                    Assigning <strong className="font-semibold text-slate-900">{user.name}</strong> will
                    configure acting / multi-department HoD sign-off capability across these units.
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || (selectedRole === 'HOD' && selectedDeptIds.length === 0)}
              className="px-6 py-2.5 rounded-xl bg-[#540225] hover:bg-[#721c3b] text-white text-xs font-semibold shadow-md transition-all cursor-pointer disabled:opacity-70 flex items-center gap-2"
            >
              {saving ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Save Changes</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
