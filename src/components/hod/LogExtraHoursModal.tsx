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
  AlertTriangle,
} from 'lucide-react';
import { UniversityUser } from '@/types/database';
import { createClient } from '@/lib/supabase/client';
import { CustomSelect, CustomSelectOption } from '@/components/ui/CustomSelect';
import { getWeekRange } from '@/lib/utils/weekRange';

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
    is_special_condition?: boolean;
    special_condition_reason?: string;
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

  // Dynamic Weekly Hours Tally & Cumulative Cap State
  const chosenTeacherId = targetMode === 'self' ? targetHodId : selectedTeacherId;
  const selectedTeacherObj = targetMode === 'self' ? currentHod : teachers.find((t) => t.id === chosenTeacherId);
  const teacherWeeklyCap = selectedTeacherObj?.max_weekly_hours != null ? Number(selectedTeacherObj.max_weekly_hours) : 8.0;

  const [currentWeekLogged, setCurrentWeekLogged] = useState<number>(0);
  const [isLoadingWeekHours, setIsLoadingWeekHours] = useState<boolean>(false);
  const [requestSpecialException, setRequestSpecialException] = useState<boolean>(false);
  const [specialConditionReason, setSpecialConditionReason] = useState<string>('');

  const weekRange = useMemo(() => getWeekRange(date), [date]);
  const newHours = totalExtraHours;
  const projectedTotal = Number((currentWeekLogged + Number(newHours || 0)).toFixed(1));
  const exceedsCap = projectedTotal > teacherWeeklyCap;

  // Live Weekly Calculation: Fetch existing logged hours for selected teacher & calendar week
  useEffect(() => {
    if (!chosenTeacherId || !date) return;
    let isCancelled = false;
    setIsLoadingWeekHours(true);

    async function fetchWeeklyHours() {
      try {
        const { startDate, endDate } = getWeekRange(date);
        const supabase = createClient();
        const { data: existingWeekRecords, error } = await supabase
          .from('timesheets')
          .select('hours, status')
          .eq('teacher_id', chosenTeacherId)
          .gte('date', startDate)
          .lte('date', endDate)
          .neq('status', 'REJECTED');

        if (!isCancelled && !error && existingWeekRecords) {
          const logged = existingWeekRecords.reduce(
            (sum, item) => sum + Number(item.hours || 0),
            0
          );
          setCurrentWeekLogged(logged);
        }
      } catch (err) {
        console.error('[SubmitModal] Error loading weekly tally:', err);
      } finally {
        if (!isCancelled) setIsLoadingWeekHours(false);
      }
    }

    fetchWeeklyHours();
    return () => {
      isCancelled = true;
    };
  }, [chosenTeacherId, date]);

  // Sync active department on open & reset exception state
  useEffect(() => {
    if (isOpen) {
      if (departmentName && userDepartments.includes(departmentName)) {
        setTargetDepartment(departmentName);
      } else if (userDepartments.length > 0) {
        setTargetDepartment(userDepartments[0]);
      }
      setSelectedTeacherId(targetHodId);
      setTargetMode('self');
      setRequestSpecialException(false);
      setSpecialConditionReason('');
    }
  }, [isOpen, departmentName, userDepartments, targetHodId]);

  // Reset exception fields whenever teacher changes
  useEffect(() => {
    setRequestSpecialException(false);
    setSpecialConditionReason('');
  }, [chosenTeacherId]);

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
        is_special_condition: exceedsCap && requestSpecialException,
        special_condition_reason:
          exceedsCap && requestSpecialException ? specialConditionReason.trim() : undefined,
      });

      // Reset fields
      setActivityDescription('');
      setCourseCode('');
      setCourseName('');
      setTheoreticalHours('2.0');
      setPracticalHours('1.0');
      setRequestSpecialException(false);
      setSpecialConditionReason('');
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
                {newHours.toFixed(1)} hrs
              </div>
            </div>

            {/* Clean Weekly Breakdown under the hours input */}
            <div
              className={`p-3 rounded-xl border text-xs transition-all ${
                exceedsCap
                  ? 'bg-amber-50/90 border-amber-300 text-amber-950'
                  : 'bg-white border-slate-200 text-slate-700'
              }`}
            >
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <Clock className={`w-3.5 h-3.5 ${exceedsCap ? 'text-amber-700' : 'text-[#540225]'}`} />
                  <span className="font-semibold text-slate-800">
                    Already logged this week: <span className="font-mono text-slate-900">{currentWeekLogged} hrs</span> | This request: <span className="font-mono text-slate-900">{newHours} hrs</span> | Total: <span className={`font-mono ${exceedsCap ? 'text-amber-800 font-extrabold' : 'text-slate-900'}`}>{projectedTotal} / {teacherWeeklyCap} hrs cap</span>
                  </span>
                </div>
                {isLoadingWeekHours ? (
                  <span className="text-[10px] text-slate-400 font-medium animate-pulse">Calculating...</span>
                ) : (
                  <span className="text-[10px] text-slate-500 font-medium">({weekRange.label})</span>
                )}
              </div>
            </div>
          </div>

          {/* Live Weekly Hours Tally & Dynamic Cap Progress Indicator */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-50 to-blue-50/20 border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#540225]" />
                <span className="text-xs font-bold text-slate-800">Weekly Hours Tally</span>
                <span className="text-[11px] font-semibold text-slate-500">
                  ({weekRange.label})
                </span>
              </div>
              {isLoadingWeekHours ? (
                <span className="text-[10px] text-slate-400 font-medium animate-pulse">
                  Querying calendar week...
                </span>
              ) : (
                <span className="text-xs font-mono font-bold text-slate-700">
                  Logged: {currentWeekLogged.toFixed(1)}h / Max: {teacherWeeklyCap.toFixed(1)}h
                </span>
              )}
            </div>

            {/* Clean Progress Indicator Bar */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-600 font-medium">
                  {weekRange.label}: <strong className="text-slate-900">Currently logged {currentWeekLogged.toFixed(1)}h</strong> / Max allowed: <strong className="text-slate-900">{teacherWeeklyCap.toFixed(1)}h</strong>
                </span>
                <span className={`font-mono font-bold text-xs ${exceedsCap ? 'text-amber-700' : 'text-slate-700'}`}>
                  + {newHours.toFixed(1)}h new = {projectedTotal.toFixed(1)}h
                </span>
              </div>

              {/* Visual Progress Bar */}
              <div className="w-full h-3 bg-slate-200/90 rounded-full overflow-hidden flex relative">
                {/* Existing Logged Hours */}
                <div
                  className="h-full bg-slate-600 transition-all duration-300"
                  style={{
                    width: `${Math.min(100, (currentWeekLogged / Math.max(teacherWeeklyCap, projectedTotal, 1)) * 100)}%`,
                  }}
                  title={`Currently logged: ${currentWeekLogged.toFixed(1)}h`}
                />
                {/* New Requested Hours */}
                <div
                  className={`h-full transition-all duration-300 ${
                    exceedsCap ? 'bg-amber-500' : 'bg-[#540225]'
                  }`}
                  style={{
                    width: `${Math.min(
                      100 - (currentWeekLogged / Math.max(teacherWeeklyCap, projectedTotal, 1)) * 100,
                      (newHours / Math.max(teacherWeeklyCap, projectedTotal, 1)) * 100
                    )}%`,
                  }}
                  title={`This request: ${newHours.toFixed(1)}h`}
                />
              </div>

              <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                <span>0.0h</span>
                <span className="font-semibold text-slate-600">Authorized Cap: {teacherWeeklyCap.toFixed(1)}h/wk</span>
                <span>{Math.max(teacherWeeklyCap, projectedTotal).toFixed(1)}h</span>
              </div>
            </div>

            {/* Cap Exceeded Warning Banner & Special Condition Authorization */}
            {exceedsCap && (
              <div className="mt-3 p-4 rounded-xl bg-amber-50 border border-amber-300 space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold text-amber-950">
                      This request will bring the weekly total to {projectedTotal} hrs, exceeding the {teacherWeeklyCap} hrs weekly limit.
                    </p>
                    <p className="text-[11px] text-amber-800 leading-snug">
                      Already logged this week: {currentWeekLogged} hrs | This request: {newHours} hrs | Total: {projectedTotal} / {teacherWeeklyCap} hrs cap. Standard submission is blocked unless an authorized special condition override is provided.
                    </p>
                  </div>
                </div>

                {/* Checkbox: Request Special Exception */}
                <div className="pt-2 border-t border-amber-200/80">
                  <label className="flex items-start gap-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={requestSpecialException}
                      onChange={(e) => setRequestSpecialException(e.target.checked)}
                      className="w-4 h-4 mt-0.5 rounded border-amber-400 text-[#540225] focus:ring-[#721c3b]/30 cursor-pointer"
                    />
                    <div className="space-y-0.5">
                      <span className="text-xs font-bold text-amber-950">
                        Request Special Exception / Over-Cap Authorization
                      </span>
                      <p className="text-[11px] text-amber-800">
                        Check this box to submit this request under institutional special condition authorization for Academic Coordinator review.
                      </p>
                    </div>
                  </label>
                </div>

                {/* Mandatory Justification Textarea when Checkbox is ticked */}
                {requestSpecialException && (
                  <div className="pt-2 space-y-1.5 animate-in fade-in duration-150">
                    <label className="text-xs font-bold text-amber-950 flex items-center justify-between">
                      <span>Special Condition Justification (e.g., Coordinator/Dean in-person authorization)</span>
                      <span className="text-red-600 font-bold text-[10px]">Mandatory *</span>
                    </label>
                    <textarea
                      rows={2}
                      required
                      value={specialConditionReason}
                      onChange={(e) => setSpecialConditionReason(e.target.value)}
                      placeholder="Specify reason for over-cap exception (e.g., Authorized in-person by Dean / Coordinator for urgent lab preparation)..."
                      className="w-full p-2.5 rounded-xl bg-white border border-amber-300 text-xs text-slate-800 placeholder:text-amber-700/60 focus:outline-none focus:ring-2 focus:ring-[#721c3b]/30 focus:border-[#540225] transition-all resize-none shadow-2xs font-medium"
                    />
                    {specialConditionReason.trim().length === 0 && (
                      <p className="text-[10px] text-red-600 font-semibold">
                        * Please type the justification reason above to unlock request submission.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
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
              disabled={
                isSubmitting ||
                newHours <= 0 ||
                !courseCode ||
                (exceedsCap && (!requestSpecialException || specialConditionReason.trim().length === 0))
              }
              className="px-6 py-2.5 rounded-xl bg-[#540225] hover:bg-[#721c3b] text-white text-xs font-bold transition-all shadow-md cursor-pointer flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Submitting to Coordinator...</span>
                </>
              ) : exceedsCap && requestSpecialException ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>Submit Special Exception Request</span>
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
