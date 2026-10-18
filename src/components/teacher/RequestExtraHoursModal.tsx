'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { X, Calendar, Clock, BookOpen, User, Check, Building2 } from 'lucide-react';
import { UniversityUser } from '@/types/database';
import { useSession } from '@/lib/context/SessionContext';
import { createClient } from '@/lib/supabase/client';
import { CustomSelect, CustomSelectOption } from '@/components/ui/CustomSelect';

interface ScopedCourse {
  id: string;
  course_code: string;
  course_name: string;
}

interface RequestExtraHoursModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    date: string;
    hours: number;
    course_code: string;
    session_type?: string;
    notes: string;
    department: string;
  }) => Promise<void>;
  teacher?: UniversityUser | null;
  departmentName?: string;
  departments?: string[];
}

export function RequestExtraHoursModal({
  isOpen,
  onClose,
  onSubmit,
  teacher,
  departmentName,
  departments,
}: RequestExtraHoursModalProps) {
  const session = useSession();
  const today = new Date().toISOString().split('T')[0];

  const [date, setDate] = useState<string>(today);
  const [hours, setHours] = useState<string>('2.0');
  const [courseCode, setCourseCode] = useState<string>('');
  const [availableCourses, setAvailableCourses] = useState<ScopedCourse[]>([]);
  const [isLoadingCourses, setIsLoadingCourses] = useState<boolean>(false);
  const [activityDescription, setActivityDescription] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Resolve list of affiliated departments for the teacher
  const userDepartments: string[] = useMemo(() => {
    if (departments && departments.length > 0) return departments.filter(Boolean);
    if (teacher?.departments && teacher.departments.length > 0) return teacher.departments.filter(Boolean);
    if (session.user?.departments && session.user.departments.length > 0) return session.user.departments.filter(Boolean);
    const fallback = departmentName || teacher?.department?.name || session.user?.departmentName;
    return fallback ? [fallback] : ['Faculty of Computer Engineering & IT'];
  }, [departments, teacher?.departments, session.user?.departments, departmentName, teacher?.department?.name, session.user?.departmentName]);

  const [targetDepartment, setTargetDepartment] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      if (userDepartments.length === 1) {
        setTargetDepartment(userDepartments[0]);
      } else if (userDepartments.length > 1) {
        setTargetDepartment('');
      }
      setCourseCode('');
    }
  }, [isOpen, userDepartments]);

  const activeDepartment = targetDepartment || (userDepartments.length === 1 ? userDepartments[0] : '');

  // Cascade Course Selection: Watch targetDepartment and fetch scoped courses
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
        console.error('[RequestExtraHoursModal] Exception fetching courses:', err);
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

  const departmentOptions: CustomSelectOption[] = useMemo(() => {
    return userDepartments.map((dept) => ({
      value: dept,
      label: dept,
    }));
  }, [userDepartments]);

  const courseOptions: CustomSelectOption[] = useMemo(() => {
    return availableCourses.map((c) => ({
      value: c.course_code,
      label: `${c.course_code} - ${c.course_name}`,
      badge: c.course_code,
    }));
  }, [availableCourses]);

  const teacherName = teacher?.name || session.user?.name || 'Faculty Member';
  const teacherTitle = teacher?.academic_title || (session.user as any)?.academic_title || 'Teaching Assistant / Lab Lead';
  const displayDept =
    targetDepartment ||
    (userDepartments.length === 1 ? userDepartments[0] : 'Multiple Departments Assigned');

  const coursePlaceholder = !activeDepartment
    ? '-- Select Target Department First --'
    : isLoadingCourses
    ? '-- Loading Courses... --'
    : availableCourses.length === 0
    ? '-- No Courses Found for Department --'
    : '-- Select a Course --';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numHours = parseFloat(hours);
    if (isNaN(numHours) || numHours <= 0) return;

    const finalDepartment = targetDepartment || (userDepartments.length === 1 ? userDepartments[0] : '');
    if (!finalDepartment) {
      alert('Please select a target department for this submission.');
      return;
    }
    if (!courseCode.trim()) {
      alert('Please select a course.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({
        date,
        hours: numHours,
        course_code: courseCode.trim().toUpperCase(),
        session_type: 'Lecture',
        notes: activityDescription.trim() || courseCode.trim().toUpperCase() || 'Extra Teaching Hours',
        department: finalDepartment,
      });

      // Reset fields
      setActivityDescription('');
      setHours('2.0');
      setCourseCode('');
      if (userDepartments.length > 1) {
        setTargetDepartment('');
      }
      onClose();
    } catch (err) {
      console.error('Error submitting extra hours request:', err);
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
              Request Extra Teaching Hours
            </h2>
            <p className="text-xs text-slate-500">
              Department scope: <strong className="text-slate-800 font-semibold">{displayDept}</strong>
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
          {/* Field 1: Faculty Member */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-slate-500" />
              <span>Faculty Member</span>
              <span className="text-red-500">*</span>
            </label>

            <input
              type="text"
              readOnly
              value={`${teacherName} — ${teacherTitle}`}
              className="w-full h-11 px-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-800 cursor-default select-none focus:outline-none"
            />
          </div>

          {/* Field 2: Target Department Dropdown (Multi-Department Routing) */}
          {userDepartments.length === 1 ? (
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-slate-500" />
                  <span>Target Department</span>
                </div>
                <span className="text-[10px] font-medium text-slate-500">
                  Auto-assigned
                </span>
              </label>
              <input
                type="text"
                readOnly
                disabled
                value={targetDepartment || userDepartments[0]}
                className="w-full h-11 px-3.5 rounded-xl bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-700 cursor-not-allowed select-none focus:outline-none"
              />
            </div>
          ) : (
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-[#7c5800]" />
                  <span className="text-slate-800">Target Department</span>
                  <span className="text-red-500">*</span>
                </div>
                <span className="text-[10px] font-bold text-[#7c5800] bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
                  Multi-Department Affiliated
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
              <p className="text-[11px] text-amber-900 leading-snug">
                You are affiliated with multiple academic departments. Please select which department this teaching activity belongs to for proper HoD approval routing.
              </p>
            </div>
          )}

          {/* Field 3: Date Picker & Hours Input (Grid) */}
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
                max={today}
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
                placeholder="e.g. 2.0"
                className="w-full h-11 px-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#721c3b]/30 focus:bg-white transition-all font-mono"
              />
            </div>
          </div>

          {/* Field 4: Course Code (Cascading Dynamic Dropdown) */}
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
                if (match && (!activityDescription || activityDescription.includes('Lecture') || activityDescription.includes(':'))) {
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

          {/* Field 5: Course / Activity Description */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700">
              Course / Activity Description <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={3}
              value={activityDescription}
              onChange={(e) => setActivityDescription(e.target.value)}
              placeholder="e.g., CS301 Lab Session: Advanced Trees & Graph Traversals with practical exercises"
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
              disabled={isSubmitting || (userDepartments.length > 1 && !targetDepartment) || !courseCode}
              className="px-6 py-2.5 rounded-xl bg-[#540225] hover:bg-[#721c3b] text-white text-xs font-bold transition-all shadow-md cursor-pointer flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Submitting...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Submit Extra Hours Request</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
