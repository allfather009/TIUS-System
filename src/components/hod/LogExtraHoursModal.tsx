'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Calendar,
  Clock,
  BookOpen,
  User,
  Users,
  Check,
  Building2,
  GraduationCap,
  Layers,
  Calculator,
  Info,
} from 'lucide-react';
import { UniversityUser } from '@/types/database';
import { createClient } from '@/lib/supabase/client';
import { CustomSelect, CustomSelectOption } from '@/components/ui/CustomSelect';

interface ScopedCourse {
  id: string;
  course_code: string;
  course_name: string;
  stage?: string | number;
}

interface LogExtraHoursModalProps {
  isOpen: boolean;
  onClose: () => void;
  teachers?: UniversityUser[];
  hodUser?: UniversityUser;
  hodId: string;
  departmentName: string;
  departments?: string[];
  activeDepartmentId?: string;
  onSubmit: (data: {
    teacher_id: string;
    submitted_by_id?: string;
    date: string;
    hours: number;
    course_code?: string;
    session_type?: string;
    notes?: string;
    hod_id: string;
    department?: string;
    department_id?: string;
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
  activeDepartmentId,
  onSubmit,
}: LogExtraHoursModalProps) {
  const currentHod = hodUser || teachers.find((t) => t.id === hodId || t.role === 'HOD');
  const targetHodId = currentHod?.id || hodId;

  // Beneficiary selection state
  // Can be 'self' (HoD ID) or any teacher ID
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>(targetHodId);
  const [targetMode, setTargetMode] = useState<'self' | 'teacher'>('self');

  // Filter department teachers (excluding HoD duplicate for teacher mode)
  const deptTeachers = useMemo(() => {
    return teachers.filter((t) => t.id !== targetHodId);
  }, [teachers, targetHodId]);

  // Department scoping
  const userDepartments: string[] = useMemo(() => {
    if (departments && departments.length > 0) return departments.filter(Boolean);
    if (hodUser?.departments && hodUser.departments.length > 0) return hodUser.departments.filter(Boolean);
    if (departmentName && departmentName.includes(' • ')) {
      return departmentName.split(' • ').map((s) => s.trim()).filter(Boolean);
    }
    return departmentName ? [departmentName] : ['Pharmacy'];
  }, [departments, hodUser?.departments, departmentName]);

  const [targetDepartment, setTargetDepartment] = useState<string>(userDepartments[0] || departmentName || '');

  // Form Fields
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [courseCode, setCourseCode] = useState<string>('');
  const [courseName, setCourseName] = useState<string>('');
  const [stage, setStage] = useState<string>('Stage 3');
  const [semester, setSemester] = useState<string>('Fall Semester 2026-2027');

  // Hour Types: Theoretical & Practical
  const [theoreticalHours, setTheoreticalHours] = useState<string>('2.0');
  const [practicalHours, setPracticalHours] = useState<string>('1.0');

  // Computed Total Extra Hours
  const totalExtraHours = useMemo(() => {
    const theo = parseFloat(theoreticalHours) || 0;
    const prac = parseFloat(practicalHours) || 0;
    return Number((theo + prac).toFixed(1));
  }, [theoreticalHours, practicalHours]);

  const [activityDescription, setActivityDescription] = useState<string>('');
  const [availableCourses, setAvailableCourses] = useState<ScopedCourse[]>([]);
  const [isLoadingCourses, setIsLoadingCourses] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Sync active department on open
  useEffect(() => {
    if (isOpen) {
      if (departmentName && userDepartments.includes(departmentName)) {
        setTargetDepartment(departmentName);
      } else if (userDepartments.length > 0) {
        setTargetDepartment(userDepartments[0]);
      }
      setSelectedTeacherId(targetHodId);
      setTargetMode('self');
    }
  }, [isOpen, departmentName, userDepartments, targetHodId]);

  const activeDept = targetDepartment || userDepartments[0] || departmentName;

  // Cascade Courses: Fetch courses for active department
  useEffect(() => {
    if (!activeDept) {
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
            activeDept,
            activeDept.replace(/\s*\(ELT\)/i, '').trim(),
            activeDept.replace(/Faculty of /i, '').trim(),
          ].filter(Boolean))
        );

        const { data, error } = await supabase
          .from('courses')
          .select('id, course_code, course_name, department, code, name')
          .in('department', normalizedDepts)
          .order('code', { ascending: true });

        if (error || !data || data.length === 0) {
          // Fallback via departments table -> stages -> courses
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
        console.error('[SubmitModal] Error loading courses:', err);
        if (!isCancelled) setAvailableCourses([]);
      } finally {
        if (!isCancelled) setIsLoadingCourses(false);
      }
    }

    fetchScopedCourses();
    return () => {
      isCancelled = true;
    };
  }, [activeDept]);

  // Options for Dropdowns
  const departmentOptions: CustomSelectOption[] = useMemo(() => {
    return userDepartments.map((dept) => ({
      value: dept,
      label: dept,
      badge: 'Assigned HoD Scope',
    }));
  }, [userDepartments]);

  // Prominent first option: Myself (Head of Department), followed by department faculty
  const facultyOptions: CustomSelectOption[] = useMemo(() => {
    const list: CustomSelectOption[] = [
      {
        value: targetHodId,
        label: `★ Myself (${currentHod?.name || 'Head of Department'}) — HoD Self Request`,
        badge: 'HoD (Self)',
        description: currentHod?.email || 'Drafting for own teaching hours',
      },
    ];

    deptTeachers.forEach((t) => {
      list.push({
        value: t.id,
        label: `${t.name} — ${t.academic_title || t.role || 'Lecturer'}`,
        badge: t.employment_type === 'FULL_TIME' ? 'Full-Time' : 'Part-Time',
        description: t.email || undefined,
      });
    });

    return list;
  }, [targetHodId, currentHod, deptTeachers]);

  const courseOptions: CustomSelectOption[] = useMemo(() => {
    return availableCourses.map((c) => ({
      value: c.course_code,
      label: `${c.course_code} - ${c.course_name}`,
      badge: c.course_code,
    }));
  }, [availableCourses]);

  const stageOptions: CustomSelectOption[] = [
    { value: 'Stage 1', label: 'Stage 1 (First Year)' },
    { value: 'Stage 2', label: 'Stage 2 (Second Year)' },
    { value: 'Stage 3', label: 'Stage 3 (Third Year)' },
    { value: 'Stage 4', label: 'Stage 4 (Fourth Year)' },
    { value: 'Stage 5', label: 'Stage 5 (Fifth Year / Graduation)' },
    { value: 'Postgraduate', label: 'Postgraduate / Master’s' },
  ];

  const semesterOptions: CustomSelectOption[] = [
    { value: 'Fall Semester 2026-2027', label: 'Fall Semester 2026-2027 (Active Cycle)' },
    { value: 'Spring Semester 2026-2027', label: 'Spring Semester 2026-2027' },
    { value: 'Summer Intensive 2026', label: 'Summer Intensive Term' },
  ];

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const chosenTeacherId = targetMode === 'self' ? targetHodId : selectedTeacherId;
    if (!chosenTeacherId) {
      alert('Please select a faculty member or choose Myself.');
      return;
    }

    if (totalExtraHours <= 0) {
      alert('Total extra hours must be greater than 0.');
      return;
    }

    if (!courseCode.trim()) {
      alert('Please select or specify a Course Code.');
      return;
    }

    const matchedCourse = availableCourses.find((c) => c.course_code === courseCode);
    const finalCourseName = courseName.trim() || matchedCourse?.course_name || 'Instructional Course';
    const theoVal = parseFloat(theoreticalHours) || 0;
    const pracVal = parseFloat(practicalHours) || 0;

    const sessionTypeString =
      theoVal > 0 && pracVal > 0
        ? `Theoretical (${theoVal}h) + Practical (${pracVal}h)`
        : theoVal > 0
        ? `Theoretical Session (${theoVal}h)`
        : `Practical / Lab Session (${pracVal}h)`;

    const courseActivityString = `${courseCode.trim().toUpperCase()}: ${finalCourseName} (${stage}) • ${semester}`;
    const justificationNotes = activityDescription.trim() || courseActivityString;

    setIsSubmitting(true);
    try {
      await onSubmit({
        teacher_id: chosenTeacherId,
        submitted_by_id: targetHodId,
        hod_id: targetHodId,
        date,
        hours: totalExtraHours,
        course_code: courseCode.trim().toUpperCase(),
        session_type: sessionTypeString,
        notes: justificationNotes,
        department: activeDept,
        department_id: activeDepartmentId || undefined,
      });

      // Reset fields
      setActivityDescription('');
      setCourseCode('');
      setCourseName('');
      setTheoreticalHours('2.0');
      setPracticalHours('1.0');
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
      <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden text-left flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-6 pb-4 border-b border-slate-100 flex items-start justify-between bg-gradient-to-r from-slate-50 via-white to-pink-50/20">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#540225]" />
              <h2 className="font-headline text-xl font-bold text-[#0b1c30]">
                Submit Extra Hours Request
              </h2>
            </div>
            <p className="text-xs text-slate-500">
              Draft and submit faculty extra hours directly to the Academic Coordinator for institutional sign-off.
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
        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto flex-1">
          {/* Multi-Department Switcher if HoD oversees multiple departments */}
          {userDepartments.length > 1 && (
            <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                  <Building2 className="w-4 h-4 text-amber-700" />
                  <span>Target Department Scope</span>
                  <span className="text-red-500">*</span>
                </label>
                <span className="text-[10px] font-bold text-amber-800 bg-amber-100/80 px-2 py-0.5 rounded-md">
                  HoD Dual Jurisdiction
                </span>
              </div>
              <CustomSelect
                value={targetDepartment}
                onChange={(val) => {
                  setTargetDepartment(val);
                  setCourseCode('');
                }}
                options={departmentOptions}
                placeholder="-- Select Department --"
                variant="amber"
              />
            </div>
          )}

          {/* Section 1: Beneficiary / Faculty Member */}
          <div className="space-y-2 bg-slate-50/60 p-4 rounded-2xl border border-slate-100">
            <div className="flex items-center justify-between gap-2">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-slate-600" />
                <span>Faculty Beneficiary (Performing Hours)</span>
                <span className="text-red-500">*</span>
              </label>

              {/* Segmented Switcher: Myself (HoD) vs Department Faculty */}
              <div className="inline-flex items-center p-0.5 rounded-lg bg-slate-200/80 border border-slate-300/60">
                <button
                  type="button"
                  onClick={() => {
                    setTargetMode('self');
                    setSelectedTeacherId(targetHodId);
                  }}
                  className={`px-3 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                    targetMode === 'self'
                      ? 'bg-white text-[#540225] shadow-xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <User className="w-3 h-3" />
                  <span>Myself (HoD)</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setTargetMode('teacher');
                    if (deptTeachers.length > 0 && selectedTeacherId === targetHodId) {
                      setSelectedTeacherId(deptTeachers[0].id);
                    }
                  }}
                  className={`px-3 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                    targetMode === 'teacher'
                      ? 'bg-white text-[#540225] shadow-xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Users className="w-3 h-3" />
                  <span>Department Faculty</span>
                </button>
              </div>
            </div>

            {targetMode === 'self' ? (
              <div className="relative">
                <input
                  type="text"
                  readOnly
                  disabled
                  value={`★ Myself (${currentHod?.name || 'Head of Department'}) — Head of Department (Self)`}
                  className="w-full h-11 px-3.5 pr-24 rounded-xl bg-white border border-pink-200 text-xs font-bold text-[#540225] shadow-2xs"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-extrabold text-[#540225] bg-pink-100/80 px-2.5 py-0.5 rounded-md border border-pink-200">
                  HoD Self
                </span>
              </div>
            ) : (
              <CustomSelect
                value={selectedTeacherId}
                onChange={setSelectedTeacherId}
                options={facultyOptions}
                placeholder="Select Faculty Member, Dean, or Vice Dean..."
                searchPlaceholder="Search faculty by name..."
                searchable={facultyOptions.length > 4}
              />
            )}
            <p className="text-[11px] text-slate-500">
              {targetMode === 'self'
                ? 'Requests for yourself will be logged under your HoD profile and forwarded directly to the Academic Coordinator.'
                : 'Select any active faculty member, Lecturer, Dean, or Vice Dean affiliated with this department.'}
            </p>
          </div>

          {/* Section 2: Course & Academic Cycle (2x2 Grid) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Course Code & Name Dropdown */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5 text-slate-500" />
                  <span>Course Code</span>
                  <span className="text-red-500">*</span>
                </div>
                {isLoadingCourses && (
                  <span className="text-[10px] text-slate-400 font-medium animate-pulse">
                    Loading...
                  </span>
                )}
              </label>

              <CustomSelect
                value={courseCode}
                onChange={(selected) => {
                  setCourseCode(selected);
                  const match = availableCourses.find((c) => c.course_code === selected);
                  if (match) {
                    setCourseName(match.course_name);
                  }
                }}
                options={courseOptions}
                disabled={isLoadingCourses}
                placeholder={isLoadingCourses ? 'Loading Courses...' : availableCourses.length === 0 ? 'Enter Course Code' : 'Select Registered Course'}
                searchPlaceholder="Search course code or title..."
                searchable={availableCourses.length > 4}
              />
            </div>

            {/* Stage / Year */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <GraduationCap className="w-3.5 h-3.5 text-slate-500" />
                <span>Stage / Year</span>
                <span className="text-red-500">*</span>
              </label>
              <CustomSelect
                value={stage}
                onChange={setStage}
                options={stageOptions}
                placeholder="Select Stage / Year..."
              />
            </div>

            {/* Academic Cycle / Semester */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-slate-500" />
                <span>Academic Semester / Cycle</span>
                <span className="text-red-500">*</span>
              </label>
              <CustomSelect
                value={semester}
                onChange={setSemester}
                options={semesterOptions}
                placeholder="Select Semester Cycle..."
              />
            </div>

            {/* Date Completed */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-500" />
                <span>Date Completed</span>
                <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="w-full h-11 px-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#721c3b]/30 focus:bg-white transition-all cursor-pointer"
              />
            </div>
          </div>

          {/* Section 3: Hour Types Breakdown & Total Calculator Card */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-50 to-pink-50/30 border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-[#540225]" />
                <span>Extra Hours Breakdown</span>
                <span className="text-red-500">*</span>
              </label>
              <span className="text-[10px] font-semibold text-slate-500">
                0.5 hour increments
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Theoretical Hours */}
              <div className="space-y-1">
                <span className="text-[11px] font-semibold text-slate-600">Theoretical Hours</span>
                <div className="relative">
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    max="12"
                    value={theoreticalHours}
                    onChange={(e) => setTheoreticalHours(e.target.value)}
                    placeholder="2.0"
                    className="w-full h-10 px-3 pr-10 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#721c3b]/30 font-mono"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-slate-400">
                    hrs
                  </span>
                </div>
              </div>

              {/* Practical / Lab Hours */}
              <div className="space-y-1">
                <span className="text-[11px] font-semibold text-slate-600">Practical / Lab Hours</span>
                <div className="relative">
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    max="12"
                    value={practicalHours}
                    onChange={(e) => setPracticalHours(e.target.value)}
                    placeholder="1.0"
                    className="w-full h-10 px-3 pr-10 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#721c3b]/30 font-mono"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-slate-400">
                    hrs
                  </span>
                </div>
              </div>
            </div>

            {/* Live Total Card */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-white border border-pink-100 shadow-2xs">
              <div className="flex items-center gap-2">
                <Calculator className="w-4 h-4 text-[#540225]" />
                <span className="text-xs font-bold text-slate-700">Total Extra Hours:</span>
                <span className="text-xs text-slate-400">
                  ({parseFloat(theoreticalHours) || 0} theo + {parseFloat(practicalHours) || 0} prac)
                </span>
              </div>
              <div className="text-sm font-extrabold text-[#540225] font-mono px-3 py-1 bg-pink-50 rounded-lg border border-pink-200">
                {totalExtraHours.toFixed(1)} hrs
              </div>
            </div>
          </div>

          {/* Section 4: Justification / Notes */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
              <span>Justification & Session Activity Notes</span>
              <span className="text-[10px] text-slate-400 font-normal">Optional</span>
            </label>
            <textarea
              rows={2}
              value={activityDescription}
              onChange={(e) => setActivityDescription(e.target.value)}
              placeholder="e.g., Extended laboratory practical supervision for Stage 3 students prior to midterm exams."
              className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#721c3b]/30 focus:bg-white transition-all resize-none"
            />
          </div>

          {/* Notice Box */}
          <div className="p-3 rounded-xl bg-blue-50/60 border border-blue-100 text-[11px] text-blue-900 flex items-start gap-2">
            <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              Once submitted, this request will be entered with status <strong>Pending Coordinator Review</strong>.
              The Academic Coordinator will perform institutional validation before it reaches Central Finance.
            </p>
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
              disabled={isSubmitting || totalExtraHours <= 0 || !courseCode}
              className="px-6 py-2.5 rounded-xl bg-[#540225] hover:bg-[#721c3b] text-white text-xs font-bold transition-all shadow-md cursor-pointer flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Submitting to Coordinator...</span>
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
