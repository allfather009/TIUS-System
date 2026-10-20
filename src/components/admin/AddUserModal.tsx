'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Department, UniversityUser, UserRole, EmploymentType, AcademicRate, SystemSettings } from '@/types/database';
import { X, Check } from 'lucide-react';
import { getAcademicRates, getRateForTitle } from '@/lib/services/rateService';
import { getSystemSettings } from '@/lib/services/systemSettingsService';
import { CustomSelect, CustomSelectGroup, CustomSelectOption } from '@/components/ui/CustomSelect';

interface AddUserModalProps {
  departments: Department[];
  isOpen: boolean;
  onClose: () => void;
  onAddUser: (data: Omit<UniversityUser, 'id' | 'department'>) => Promise<void>;
}

export function AddUserModal({
  departments,
  isOpen,
  onClose,
  onAddUser,
}: AddUserModalProps) {
  const [name, setName] = useState('');
  const [staffId, setStaffId] = useState('');
  const [email, setEmail] = useState('');
  const [departmentId, setDepartmentId] = useState(departments[0]?.id || '');
  const [role, setRole] = useState<UserRole>('TEACHER');
  const [academicTitle, setAcademicTitle] = useState('Lecturer');
  const [employmentType, setEmploymentType] = useState<EmploymentType>('FULL_TIME');
  const [rates, setRates] = useState<AcademicRate[]>([]);
  const [saving, setSaving] = useState(false);
  const [sysSettings, setSysSettings] = useState<SystemSettings | null>(null);

  useEffect(() => {
    if (departments.length > 0 && !departmentId) {
      setDepartmentId(departments[0].id);
    }
  }, [departments, departmentId]);

  useEffect(() => {
    async function loadData() {
      try {
        const [fetchedRates, settings] = await Promise.all([
          getAcademicRates(),
          getSystemSettings(),
        ]);
        if (fetchedRates && fetchedRates.length > 0) {
          setRates(fetchedRates);
          const activeRates = fetchedRates.filter((r) => r.is_active !== false);
          if (!academicTitle && activeRates.length > 0) {
            setAcademicTitle(activeRates[0].title);
          }
        }
        setSysSettings(settings);
      } catch (err) {
        console.error('Error fetching data in AddUserModal:', err);
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

  const departmentGroups: CustomSelectGroup[] = useMemo(() => {
    const groupsMap: Record<string, CustomSelectOption[]> = {};
    departments.forEach((d) => {
      const faculty = d.faculty || 'Other Departments';
      if (!groupsMap[faculty]) groupsMap[faculty] = [];
      groupsMap[faculty].push({
        value: d.id,
        label: d.name,
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
    { value: 'DEAN', label: 'Dean', description: 'Faculty Level Leadership (Teacher Flow)' },
    { value: 'VICE_DEAN', label: 'Vice Dean', description: 'Faculty Level Vice Leadership (Teacher Flow)' },
    { value: 'HOD', label: 'Head of Dept (HoD)', description: 'Departmental Approval Lead' },
    { value: 'COORDINATOR', label: 'Academic Coordinator', description: 'Cross-Faculty Audits & Quotas' },
    { value: 'IT_ADMIN', label: 'IT Support Admin', description: 'Sub-Admin & Technical Support' },
    { value: 'ACCOUNTANT', label: 'Finance / Accountant', description: 'Payroll & Cash Disbursal' },
  ];

  const academicTitleOptions: CustomSelectOption[] = useMemo(() => {
    return rates
      .filter((r) => r.is_active !== false)
      .map((r) => ({
        value: r.title,
        label: `${r.title} — ${fmtRate(Number(r.hourly_rate))}/hr`,
        badge: fmtRate(Number(r.hourly_rate)),
      }));
  }, [rates, sysSettings]);

  const employmentTypeOptions: CustomSelectOption[] = [
    { value: 'FULL_TIME', label: 'Full Time' },
    { value: 'PART_TIME', label: 'Part Time' },
  ];

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email) return;

    setSaving(true);
    try {
      const isTeacherFlow = ['TEACHER', 'DEAN', 'VICE_DEAN'].includes(role);
      const calculatedRate =
        isTeacherFlow
          ? getRateForTitle(academicTitle, rates)
          : role === 'HOD'
          ? 65
          : role === 'COORDINATOR'
          ? 55
          : role === 'IT_ADMIN'
          ? 50
          : 45;

      await onAddUser({
        name,
        email: email.trim().toLowerCase(),
        staff_id: staffId || `TIU-${Math.floor(1000 + Math.random() * 9000)}`,
        department_id: departmentId,
        role,
        academic_title: academicTitle,
        employment_type: employmentType,
        hourly_rate: calculatedRate,
        is_active: true,
      });
      onClose();
      // Reset form
      setName('');
      setStaffId('');
      setEmail('');
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full border border-slate-200 text-left flex flex-col relative">
        {/* Header */}
        <div className="p-6 pb-4 border-b border-slate-100 flex items-start justify-between rounded-t-3xl bg-white">
          <div className="space-y-1">
            <h2 className="font-headline text-xl font-bold text-[#0b1c30]">
              Add New University Faculty / Staff
            </h2>
            <p className="text-xs text-slate-500">
              Create an account and assign institutional roles and permissions.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">Full Name &amp; Title *</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Dr. Zana Ahmed"
                className="w-full h-10 px-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#721c3b]/30 focus:bg-white"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">Staff ID *</label>
              <input
                type="text"
                required
                value={staffId}
                onChange={(e) => setStaffId(e.target.value)}
                placeholder="TIU-5101"
                className="w-full h-10 px-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#721c3b]/30 focus:bg-white font-mono"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700">
              Institutional Email (@tiu.edu.iq) *
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="username@tiu.edu.iq"
              className="w-full h-10 px-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#721c3b]/30 focus:bg-white font-mono"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">Department *</label>
              <CustomSelect
                value={departmentId}
                onChange={setDepartmentId}
                options={departmentGroups}
                placeholder="Select Department..."
                searchPlaceholder="Search departments..."
                triggerClassName="h-10"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">Assigned Role *</label>
              <CustomSelect
                value={role}
                onChange={(val) => setRole(val as UserRole)}
                options={roleOptions}
                placeholder="Select Role..."
                searchable={false}
                triggerClassName="h-10"
                placement="top"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {['TEACHER', 'DEAN', 'VICE_DEAN'].includes(role) ? (
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                  <span>Academic Title *</span>
                  <span className="text-[10px] text-amber-700 font-semibold font-mono">
                    {fmtRate(getRateForTitle(academicTitle, rates))}/hr
                  </span>
                </label>
                <CustomSelect
                  value={academicTitle}
                  onChange={setAcademicTitle}
                  options={academicTitleOptions}
                  placeholder="Select Title..."
                  variant="amber"
                  triggerClassName="h-10"
                  placement="top"
                />
              </div>
            ) : (
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Academic / Staff Title</label>
                <input
                  type="text"
                  value={academicTitle}
                  onChange={(e) => setAcademicTitle(e.target.value)}
                  placeholder="e.g. Associate Professor"
                  className="w-full h-10 px-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#721c3b]/30 focus:bg-white"
                />
              </div>
            )}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">Employment Type</label>
              <CustomSelect
                value={employmentType}
                onChange={(val) => setEmploymentType(val as EmploymentType)}
                options={employmentTypeOptions}
                placeholder="Select Employment Type..."
                searchable={false}
                triggerClassName="h-10"
                placement="top"
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3 rounded-b-3xl bg-white">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
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
                  <span>Save &amp; Dispatch Credentials</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
