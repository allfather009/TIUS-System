'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { X, Calendar, Clock, BookOpen, User, Users, Check, Building2 } from 'lucide-react';
import { UniversityUser } from '@/types/database';
import { createClient } from '@/lib/supabase/client';
import { CustomSelect, CustomSelectOption } from '@/components/ui/CustomSelect';

interface ScopedCourse {
  id: string;
  course_code: string;
  course_name: string;
}

interface LogExtraHoursModalProps {
  isOpen: boolean;
  onClose: () => void;
  teachers?: UniversityUser[];
  hodUser?: UniversityUser;
  hodId: string;
  departmentName: string;
  departments?: string[];
  onSubmit: (data: {
    teacher_id: string;
    date: string;
    hours: number;
    course_code?: string;
    session_type?: string;
    notes?: string;
    hod_id: string;
    department?: string;
  }) => Promise<void>;
}

export function LogExtraHoursModal({
  isOpen,
  onClose,
  teachers = [],
  hodUser,
  hodId,
  departmentName,
  departments,
  onSubmit,
}: LogExtraHoursModalProps) {
  // Mode toggle: 'self' (default) or 'teacher' (department faculty)
  const [targetMode, setTargetMode] = useState<'self' | 'teacher'>('self');

  const currentHod = hodUser || teachers.find((t) => t.id === hodId || t.role === 'HOD');
  const targetHodId = currentHod?.id || hodId;

  // Department teachers list (excluding HoD for clean separation)
  const deptTeachers = teachers.filter((t) => t.id !== targetHodId);
  const selectableTeachers = deptTeachers.length > 0 ? deptTeachers : teachers;

  const [selectedTeacherId, setSelectedTeacherId] = useState<string>(selectableTeachers[0]?.id || '');

  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [hours, setHours] = useState<string>('3.0');
  const [courseCode, setCourseCode] = useState<string>('');
  const [availableCourses, setAvailableCourses] = useState<ScopedCourse[]>([]);
  const [isLoadingCourses, setIsLoadingCourses] = useState<boolean>(false);
  const [activityDescription, setActivityDescription] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Resolve list of affiliated departments for the HoD
  const userDepartments: string[] = useMemo(() => {
    if (departments && departments.length > 0) return departments.filter(Boolean);
    if (hodUser?.departments && hodUser.departments.length > 0) return hodUser.departments.filter(Boolean);
    if (departmentName && departmentName.includes(' • ')) {
      return departmentName.split(' • ').map((s) => s.trim()).filter(Boolean);
    }
    return departmentName ? [departmentName] : ['Pharmacy'];
  }, [departments, hodUser?.departments, departmentName]);

  const [targetDepartment, setTargetDepartment] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      if (userDepartments.length === 1) {
        setTargetDepartment(userDepartments[0]);
      } else if (userDepartments.length > 1) {
        setTargetDepartment(userDepartments[0]);
      }
      setCourseCode('');
    }
  }, [isOpen, userDepartments]);

  const activeDepartment = targetDepartment || (userDepartments.length === 1 ? userDepartments[0] : userDepartments[0] || '');

  // Cascade Course Selection: Watch activeDepartment and fetch scoped courses
  useEffect(() => {
    // Automatically reset course code whenever target department changes
    setCourseCode('');

    if (!activeDepartment) {
      setAvailableCourses([]);
      return;
    }

    let isCancelled = false;
    setIsLoadingCourses(true);

    async function fetchScopedCourses() {
      try {
        const supabase = createClient();
        const normalizedDepts = Array.from(
          new Set([
            activeDepartment,
            activeDepartment.replace(/\s*\(ELT\)/i, '').trim(),
            activeDepartment.replace(/Faculty of /i, '').trim(),
          ].filter(Boolean))
        );

        // Query courses by department
        const { data, error } = await supabase
          .from('courses')
          .select('id, course_code, course_name, department, code, name')
          .in('department', normalizedDepts)
          .order('code', { ascending: true });

        if (error || !data || data.length === 0) {
          // Fallback: lookup department ID -> stages -> courses
          const { data: deptRow } = await supabase
            .from('departments')
            .select('id')
            .or(normalizedDepts.map((d) => `name.ilike.%${d}%`).join(','))
            .maybeSingle();

          if (deptRow?.id) {
            const { data: stages } = await supabase
              .from('stages')
              .select('id')
              .eq('department_id', deptRow.id);

            const stageIds = (stages || []).map((s: any) => s.id);
            if (stageIds.length > 0) {
              const { data: stageCourses } = await supabase
                .from('courses')
                .select('id, course_code, course_name, code, name')
                .in('stage_id', stageIds)
                .order('code', { ascending: true });

              if (!isCancelled && stageCourses && stageCourses.length > 0) {
                const formatted: ScopedCourse[] = stageCourses.map((c: any) => ({
                  id: c.id,
                  course_code: c.course_code || c.code || '',
                  course_name: c.course_name || c.name || '',
                }));
                setAvailableCourses(formatted);
                return;
              }
            }
          }
          if (!isCancelled) setAvailableCourses([]);
        } else if (!isCancelled && data) {
          const formatted: ScopedCourse[] = data.map((c: any) => ({
            id: c.id,
            course_code: c.course_code || c.code || '',
            course_name: c.course_name || c.name || '',
          }));
          setAvailableCourses(formatted);
        }
      } catch (err) {
        console.error('[LogExtraHoursModal] Exception fetching courses:', err);
        if (!isCancelled) setAvailableCourses([]);
      } finally {
        if (!isCancelled) setIsLoadingCourses(false);
      }
    }

    fetchScopedCourses();

    return () => {
      isCancelled = true;
    };
  }, [activeDepartment]);

  // Sync default teacher selection when list loads or changes
  useEffect(() => {
    if (!selectedTeacherId && selectableTeachers.length > 0) {
      setSelectedTeacherId(selectableTeachers[0].id);
    }
  }, [selectableTeachers, selectedTeacherId]);

  const departmentOptions: CustomSelectOption[] = useMemo(() => {
    return userDepartments.map((dept) => ({
      value: dept,
      label: dept,
    }));
  }, [userDepartments]);

  const teacherOptions: CustomSelectOption[] = useMemo(() => {
    return selectableTeachers.map((t) => ({
      value: t.id,
      label: `${t.name} — ${t.academic_title || 'Lecturer'}`,
      badge: t.employment_type === 'FULL_TIME' ? 'Full-Time' : 'Part-Time',
    }));
  }, [selectableTeachers]);

  const courseOptions: CustomSelectOption[] = useMemo(() => {
    return availableCourses.map((c) => ({
      value: c.course_code,
      label: `${c.course_code} - ${c.course_name}`,
      badge: c.course_code,
    }));
  }, [availableCourses]);

  const coursePlaceholder = !activeDepartment
    ? '-- Select Target Department First --'
    : isLoadingCourses
    ? '-- Loading Courses... --'
    : availableCourses.length === 0
    ? '-- No Courses Found for Department --'
    : '-- Select a Course --';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const chosenTeacherId = targetMode === 'self' ? targetHodId : selectedTeacherId || selectableTeachers[0]?.id;
    if (!chosenTeacherId) return;

    const numHours = parseFloat(hours);
    if (isNaN(numHours) || numHours <= 0) return;

    if (!courseCode.trim()) {
      alert('Please select a course.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({
        teacher_id: chosenTeacherId,
        date,
        hours: numHours,
        course_code: courseCode.trim().toUpperCase(),
        notes: activityDescription.trim() || courseCode.trim().toUpperCase() || 'Extra Teaching Hours',
        hod_id: hodId || targetHodId,
        department: activeDepartment,
      });

      // Reset fields
      setActivityDescription('');
      setHours('3.0');
      setCourseCode('');
      onClose();
    } catch (err) {
      console.error('Error logging extra hours:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl max-w-xl w-full border border-slate-200 overflow-hidden text-left flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-6 pb-4 border-b border-slate-100 flex items-start justify-between bg-slate-50/50">
          <div className="space-y-1">
            <h2 className="font-headline text-xl font-bold text-[#0b1c30]">
              Log Extra Teaching Hours
            </h2>
            <p className="text-xs text-slate-500">
              Department scope: <strong className="text-slate-800 font-semibold">{activeDepartment || departmentName}</strong>
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
          {/* Multi-Department Selector if HoD oversees multiple departments */}
          {userDepartments.length > 1 && (
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-[#7c5800]" />
                  <span className="text-slate-800">Target Department</span>
                  <span className="text-red-500">*</span>
                </div>
                <span className="text-[10px] font-bold text-[#7c5800] bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
                  Acting HoD Jurisdiction
                </span>
              </label>
              <CustomSelect
                value={targetDepartment}
                onChange={(val) => {
                  setTargetDepartment(val);
                  setCourseCode('');
                }}
                options={departmentOptions}
                placeholder="-- Select Target Department --"
                variant="amber"
                searchable={userDepartments.length > 5}
              />
            </div>
          )}

          {/* Field 1: Faculty Member with Clean Toggle */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-slate-500" />
                <span>Select Faculty Member</span>
                <span className="text-red-500">*</span>
              </label>

              {/* Clean Segmented Toggle */}
              <div className="inline-flex items-center p-0.5 rounded-lg bg-slate-100 border border-slate-200">
                <button
                  type="button"
                  onClick={() => setTargetMode('self')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                    targetMode === 'self'
                      ? 'bg-white text-[#540225] shadow-xs font-bold'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <User className="w-3 h-3" />
                  <span>Myself (HoD)</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setTargetMode('teacher');
                    if (!selectedTeacherId || selectedTeacherId === targetHodId) {
                      if (selectableTeachers.length > 0) {
                        setSelectedTeacherId(selectableTeachers[0].id);
                      }
                    }
                  }}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                    targetMode === 'teacher'
                      ? 'bg-white text-[#540225] shadow-xs font-bold'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Users className="w-3 h-3" />
                  <span>Department Teacher</span>
                </button>
              </div>
            </div>

            {/* Select Input */}
            {targetMode === 'self' ? (
              <div className="relative">
                <input
                  type="text"
                  readOnly
                  disabled
                  value={`${currentHod?.name || 'Head of Department'} — ${currentHod?.academic_title || 'Head of Department'} (Self)`}
                  className="w-full h-11 px-3.5 pr-20 rounded-xl bg-slate-50/90 border border-slate-200 text-xs font-semibold text-slate-800 cursor-default"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[10px] font-bold text-[#721c3b] bg-pink-50 px-2 py-0.5 rounded-md border border-pink-100">
                  HoD Self
                </div>
              </div>
            ) : (
              <CustomSelect
                value={selectedTeacherId || (selectableTeachers[0]?.id ?? '')}
                onChange={setSelectedTeacherId}
                options={teacherOptions}
                placeholder="Select Department Teacher..."
                searchPlaceholder="Search faculty by name..."
              />
            )}
          </div>

          {/* Field 2: Date Picker & Hours Input (Grid) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Date Picker */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-500" />
                Date Completed <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="w-full h-11 px-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#721c3b]/30 focus:bg-white transition-all cursor-pointer"
              />
            </div>

            {/* Hours Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-slate-500" />
                Duration (Hours) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                step="0.5"
                min="0.5"
                max="12.0"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                required
                placeholder="e.g. 3.0"
                className="w-full h-11 px-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#721c3b]/30 focus:bg-white transition-all font-mono"
              />
            </div>
          </div>

          {/* Field 3: Course Code (Cascading Dynamic Dropdown) */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-slate-500" />
                <span>Course Code</span>
                <span className="text-red-500">*</span>
              </div>
              {isLoadingCourses && (
                <span className="text-[10px] text-slate-400 font-medium animate-pulse">
                  Loading courses...
                </span>
              )}
            </label>

            <CustomSelect
              value={courseCode}
              onChange={(selected) => {
                setCourseCode(selected);
                const match = availableCourses.find((c) => c.course_code === selected);
                if (match && (!activityDescription || activityDescription.includes('Lecture') || activityDescription.includes(':') || activityDescription.includes('Extra Teaching'))) {
                  setActivityDescription(`${match.course_code}: ${match.course_name}`);
                }
              }}
              options={courseOptions}
              disabled={!activeDepartment || isLoadingCourses}
              placeholder={coursePlaceholder}
              searchPlaceholder="Search courses by code or title..."
            />

            {!activeDepartment ? (
              <p className="text-[11px] text-slate-400 leading-snug">
                Please select a target department first to view and select available courses.
              </p>
            ) : !isLoadingCourses && availableCourses.length === 0 ? (
              <p className="text-[11px] text-amber-700 leading-snug">
                No courses are currently registered under this department in the academic structure.
              </p>
            ) : null}
          </div>

          {/* Field 4: Course / Activity Description */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700">
              Course / Activity Description <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={3}
              value={activityDescription}
              onChange={(e) => setActivityDescription(e.target.value)}
              placeholder="e.g., PHAR301: Pharmacology & Toxicology I laboratory practical session"
              required
              className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#721c3b]/30 focus:bg-white transition-all resize-none"
            />
          </div>

          {/* Form Actions */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !courseCode || (userDepartments.length > 1 && !targetDepartment)}
              className="px-6 py-2.5 rounded-xl bg-[#540225] hover:bg-[#721c3b] text-white text-xs font-bold transition-all shadow-md cursor-pointer flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Logging...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Submit Extra Hours Log</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
