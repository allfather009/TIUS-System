'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { useSession } from '@/lib/context/SessionContext';
import { 
  getHierarchyData, 
  createFaculty, 
  createDepartment, 
  createStage, 
  createCourse,
  deleteFaculty,
  deleteDepartment,
  deleteStage,
  deleteCourse,
  updateFaculty,
  updateDepartment,
  updateStage,
  updateCourse
} from '@/lib/services/hierarchyService';
import { Faculty, Department, Stage, Course } from '@/types/database';
import { 
  Folder, FolderOpen, BookOpen, Layers, 
  Plus, ChevronRight, ChevronDown, Building2, Book, GraduationCap, Lock, ShieldAlert, KeyRound, ArrowLeft, Trash2, MoreVertical, Edit2, AlertCircle
} from 'lucide-react';
import Link from 'next/link';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

export default function AcademicStructurePage() {
  const { user, role, isSuperAdmin } = useSession();
  const activeRole = role || 'TEACHER';

  const isSuper = isSuperAdmin || activeRole === 'SUPER_ADMIN' || user?.role === 'SUPER_ADMIN';
  const isHod = activeRole === 'HOD' || user?.role === 'HOD';
  const isAuthorized = isSuper || isHod || user?.custom_permissions?.['can_manage_structure'] === true;

  const [faculties, setFaculties] = useState<Faculty[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  
  const [loading, setLoading] = useState(true);
  
  const [expandedFaculties, setExpandedFaculties] = useState<Record<string, boolean>>({});
  const [expandedDepts, setExpandedDepts] = useState<Record<string, boolean>>({});
  const [expandedStages, setExpandedStages] = useState<Record<string, boolean>>({});
  
  const [toastMessage, setToastMessage] = useState<{title: string, desc: string} | null>(null);

  // Modals
  const [addingTo, setAddingTo] = useState<{type: 'faculty' | 'department' | 'stage' | 'course', parentId?: string} | null>(null);
  const [editingItem, setEditingItem] = useState<{type: 'faculty' | 'department' | 'stage' | 'course', id: string, item: any} | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState<{isOpen: boolean, type: 'faculty' | 'department' | 'stage' | 'course' | null, id: string, name: string}>({ isOpen: false, type: null, id: '', name: '' });
  
  const [formData, setFormData] = useState({ name: '', code: '', level: 1, credits: 3 });

  // Extract all department identifiers (names, IDs) assigned to the HoD
  const userDeptJurisdictions = useMemo(() => {
    const list: string[] = [];
    if (!user) return list;

    const pushItem = (val: any) => {
      if (!val) return;
      if (typeof val === 'string') {
        const trimmed = val.trim();
        if (trimmed) list.push(trimmed);
      } else if (typeof val === 'object') {
        if (val.id) list.push(String(val.id).trim());
        if (val.name) list.push(String(val.name).trim());
      }
    };

    if (Array.isArray((user as any).department)) {
      (user as any).department.forEach(pushItem);
    } else if (typeof (user as any).department === 'string') {
      pushItem((user as any).department);
    } else if ((user as any).department && typeof (user as any).department === 'object') {
      pushItem((user as any).department);
    }

    if (Array.isArray(user.departments)) {
      user.departments.forEach(pushItem);
    }

    if (Array.isArray(user.department_ids)) {
      user.department_ids.forEach(pushItem);
    }

    if (user.departmentName) {
      pushItem(user.departmentName);
    }

    return Array.from(new Set(list.filter(Boolean).map(s => s.toLowerCase())));
  }, [user]);

  const isDeptInJurisdiction = (dept: Department) => {
    if (isSuper) return true;
    const idLower = (dept.id || '').toLowerCase();
    const nameLower = (dept.name || '').toLowerCase();
    const codeLower = (dept.code || '').toLowerCase();
    return (
      userDeptJurisdictions.includes(idLower) ||
      userDeptJurisdictions.includes(nameLower) ||
      (codeLower ? userDeptJurisdictions.includes(codeLower) : false)
    );
  };
  
  useEffect(() => {
    loadData();
  }, [user, activeRole, isSuperAdmin, userDeptJurisdictions]);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await getHierarchyData();

      if (isSuper) {
        setFaculties(data.faculties);
        setDepartments(data.departments);
        setStages(data.stages);
        setCourses(data.courses);
      } else if (isHod) {
        // Scoped tree for HoD: only include jurisdictions assigned to this HoD
        const filteredDepts = data.departments.filter(dept => isDeptInJurisdiction(dept));
        const allowedDeptIds = new Set(filteredDepts.map(d => d.id));

        // Only include faculties containing at least one department in the HoD's jurisdiction
        const filteredFacs = data.faculties.filter(fac =>
          filteredDepts.some(d => d.faculty_id === fac.id)
        );

        // Only include stages belonging to the allowed departments
        const filteredStages = data.stages.filter(s => allowedDeptIds.has(s.department_id));
        const allowedStageIds = new Set(filteredStages.map(s => s.id));

        // Only include courses belonging to the allowed stages
        const filteredCourses = data.courses.filter(c => allowedStageIds.has(c.stage_id));

        setFaculties(filteredFacs);
        setDepartments(filteredDepts);
        setStages(filteredStages);
        setCourses(filteredCourses);

        // Automatically expand the HoD's faculties and departments for fast access
        const autoExpFacs: Record<string, boolean> = {};
        filteredFacs.forEach(f => { autoExpFacs[f.id] = true; });
        setExpandedFaculties(autoExpFacs);

        const autoExpDepts: Record<string, boolean> = {};
        filteredDepts.forEach(d => { autoExpDepts[d.id] = true; });
        setExpandedDepts(autoExpDepts);
      } else {
        setFaculties([]);
        setDepartments([]);
        setStages([]);
        setCourses([]);
      }
    } catch (e) {
      console.error('[Academic Structure] Error loading data:', e);
    } finally {
      setLoading(false);
    }
  };

  const showToast = (title: string, desc: string) => {
    setToastMessage({ title, desc });
    setTimeout(() => setToastMessage(null), 3000);
  };

  const toggleFaculty = (id: string) => setExpandedFaculties(prev => ({ ...prev, [id]: !prev[id] }));
  const toggleDept = (id: string) => setExpandedDepts(prev => ({ ...prev, [id]: !prev[id] }));
  const toggleStage = (id: string) => setExpandedStages(prev => ({ ...prev, [id]: !prev[id] }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addingTo) return;

    if (!isSuper && (addingTo.type === 'faculty' || addingTo.type === 'department')) {
      alert('Only Super Administrators can create faculties or departments.');
      return;
    }

    try {
      if (addingTo.type === 'faculty') {
        const newFac = await createFaculty(formData.name, formData.code);
        setFaculties(prev => [...prev, newFac]);
        showToast('Success', 'Faculty created successfully');
      } else if (addingTo.type === 'department' && addingTo.parentId) {
        const newDept = await createDepartment(formData.name, addingTo.parentId, formData.code);
        setDepartments(prev => [...prev, newDept]);
        setExpandedFaculties(prev => ({ ...prev, [addingTo.parentId!]: true }));
        showToast('Success', 'Department created successfully');
      } else if (addingTo.type === 'stage' && addingTo.parentId) {
        const newStage = await createStage(formData.name, formData.level, addingTo.parentId);
        setStages(prev => [...prev, newStage]);
        setExpandedDepts(prev => ({ ...prev, [addingTo.parentId!]: true }));
        showToast('Success', 'Stage created successfully');
      } else if (addingTo.type === 'course' && addingTo.parentId) {
        const newCourse = await createCourse(formData.name, formData.code, addingTo.parentId, formData.credits);
        setCourses(prev => [...prev, newCourse]);
        setExpandedStages(prev => ({ ...prev, [addingTo.parentId!]: true }));
        showToast('Success', 'Course created successfully');
      }
      setAddingTo(null);
      setFormData({ name: '', code: '', level: 1, credits: 3 });
    } catch (err: any) {
      console.error(err);
      alert('Error saving data: ' + err.message);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;

    if (!isSuper && (editingItem.type === 'faculty' || editingItem.type === 'department')) {
      alert('Only Super Administrators can edit faculties or departments.');
      return;
    }

    try {
      if (editingItem.type === 'faculty') {
        const updated = await updateFaculty(editingItem.id, formData.name, formData.code);
        setFaculties(prev => prev.map(f => f.id === updated.id ? updated : f));
      } else if (editingItem.type === 'department') {
        const updated = await updateDepartment(editingItem.id, formData.name, formData.code);
        setDepartments(prev => prev.map(d => d.id === updated.id ? updated : d));
      } else if (editingItem.type === 'stage') {
        const updated = await updateStage(editingItem.id, formData.name, formData.level);
        setStages(prev => prev.map(s => s.id === updated.id ? updated : s));
      } else if (editingItem.type === 'course') {
        const updated = await updateCourse(editingItem.id, formData.name, formData.code, formData.credits);
        setCourses(prev => prev.map(c => c.id === updated.id ? updated : c));
      }
      showToast('Success', `${editingItem.type} updated successfully`);
      setEditingItem(null);
    } catch (err: any) {
      console.error(err);
      alert('Error updating data: ' + err.message);
    }
  };

  const confirmDelete = (type: 'faculty' | 'department' | 'stage' | 'course', id: string, name: string) => {
    if (!isSuper && (type === 'faculty' || type === 'department')) {
      alert('Only Super Administrators can delete faculties or departments.');
      return;
    }
    setDeleteConfirmation({ isOpen: true, type, id, name });
  };

  const executeDelete = async () => {
    const { type, id } = deleteConfirmation;
    if (!type || !id) return;

    if (!isSuper && (type === 'faculty' || type === 'department')) {
      alert('Only Super Administrators can delete faculties or departments.');
      return;
    }
    
    try {
      if (type === 'faculty') {
        await deleteFaculty(id);
        setFaculties(prev => prev.filter(f => f.id !== id));
      } else if (type === 'department') {
        await deleteDepartment(id);
        setDepartments(prev => prev.filter(d => d.id !== id));
      } else if (type === 'stage') {
        await deleteStage(id);
        setStages(prev => prev.filter(s => s.id !== id));
      } else if (type === 'course') {
        await deleteCourse(id);
        setCourses(prev => prev.filter(c => c.id !== id));
      }
      showToast('Success', `${type} deleted successfully`);
      setDeleteConfirmation({ isOpen: false, type: null, id: '', name: '' });
    } catch (err: any) {
      console.error(err);
      alert(`Error deleting ${type}: ` + err.message);
    }
  };

  if (role && !isAuthorized) {
    return (
      <div className="min-h-screen bg-[#f8f9ff] flex flex-col justify-between">
        <Sidebar activeRole={activeRole} />
        <div className="pl-72 flex-1 flex flex-col">
          <Header
            breadcrumbCategory="TIU Central Administration"
            breadcrumbPage="Access Denied"
            activeViewLabel={activeRole === 'COORDINATOR' ? 'Academic Coordinator' : activeRole}
          />
          <main className="flex-1 flex items-center justify-center p-8 pt-24">
            <div className="max-w-2xl w-full bg-white rounded-3xl shadow-xl border border-red-200 p-8 sm:p-10 text-center relative overflow-hidden">
              <div className="absolute -top-12 -right-12 w-48 h-48 bg-red-100/60 rounded-full blur-2xl pointer-events-none" />
              <div className="w-16 h-16 rounded-2xl bg-red-50 text-[#ba1a1a] flex items-center justify-center mx-auto mb-5 border border-red-200 shadow-sm">
                <ShieldAlert className="w-8 h-8" />
              </div>
              <h1 className="font-headline text-2xl sm:text-3xl font-extrabold text-[#0b1c30] tracking-tight mb-3">
                Access Denied
              </h1>
              <p className="text-sm text-slate-600 leading-relaxed mb-6 max-w-lg mx-auto">
                You do not have permission to access the Academic Structure governance tools.
              </p>
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8f9ff]">
      <Sidebar activeItem="structure" activeRole={activeRole} />

      <div className="pl-72">
        <Header
          breadcrumbCategory={isHod && !isSuper ? 'Department Administration' : 'TIU Central Administration'}
          breadcrumbPage="Academic Structure"
          activeViewLabel={isHod && !isSuper ? 'Head of Department' : 'Super Admin'}
        />

        <main className="w-full pt-20 pb-16 px-8">
          <div className="max-w-5xl mx-auto space-y-8">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div className="space-y-1">
                <h1 className="font-headline text-2xl sm:text-3xl font-bold text-[#0b1c30] tracking-tight">
                  Academic Structure
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 max-w-3xl">
                  {isHod && !isSuper
                    ? 'Manage courses and stages within your assigned departmental jurisdiction.'
                    : 'Manage the nested university hierarchy: Faculties > Departments > Stages > Courses.'}
                </p>
              </div>

              {/* Action restriction: Only SUPER_ADMIN can add faculties */}
              {isSuper && (
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => setAddingTo({ type: 'faculty' })}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#540225] hover:bg-[#721c3b] text-white text-xs font-bold transition-all shadow-md hover:shadow-lg cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Faculty</span>
                  </button>
                </div>
              )}
            </div>

            {loading ? (
              <div className="p-10 text-center text-slate-400">Loading structure...</div>
            ) : faculties.length === 0 ? (
              <div className="p-10 text-center bg-white border border-slate-200 rounded-2xl shadow-xs text-slate-500">
                <Building2 className="w-10 h-10 mx-auto mb-3 text-slate-300" />
                <h3 className="text-lg font-bold text-slate-700 mb-1">
                  {isHod && !isSuper ? 'No Departments Assigned' : 'No Faculties Found'}
                </h3>
                <p className="text-sm">
                  {isHod && !isSuper
                    ? 'You currently have no departmental jurisdiction assigned. Please contact the Super Admin.'
                    : 'Click "Add Faculty" to start building your academic structure.'}
                </p>
              </div>
            ) : (
              <div className="bg-white border border-slate-200 rounded-2xl shadow-xs">
                <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                  <h3 className="font-bold text-slate-700 text-sm flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-slate-400" />
                    {isHod && !isSuper ? 'Departmental Academic Hierarchy' : 'University Hierarchy'}
                  </h3>
                  {isHod && !isSuper && departments.length > 0 && (
                    <span className="text-xs font-medium text-slate-500">
                      Jurisdiction: <strong className="text-slate-800">{departments.map(d => d.name).join(' • ')}</strong>
                    </span>
                  )}
                </div>
                <div className="p-2 space-y-1">
                  {faculties.map(faculty => {
                    const facultyDepts = departments.filter(d => d.faculty_id === faculty.id);
                    const isFacExpanded = !!expandedFaculties[faculty.id];

                    return (
                      <div key={faculty.id} className="border border-slate-100 rounded-lg">
                        {/* Faculty Row */}
                        <div 
                          className="flex items-center justify-between p-3 bg-white hover:bg-slate-50 transition-colors cursor-pointer select-none"
                          onClick={() => toggleFaculty(faculty.id)}
                        >
                          <div className="flex items-center gap-3">
                            <button className="text-slate-400 hover:text-slate-600 focus:outline-none">
                              {isFacExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                            </button>
                            <Building2 className="w-5 h-5 text-indigo-600" />
                            <div>
                              <div className="font-bold text-slate-800">{faculty.name}</div>
                              {faculty.code && <div className="text-[10px] font-mono text-slate-400">{faculty.code}</div>}
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-xs font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                              {facultyDepts.length} {facultyDepts.length === 1 ? 'Dept' : 'Depts'}
                            </span>
                            
                            {/* Action restriction: Only SUPER_ADMIN can Add Dept, Edit or Delete Faculty */}
                            {isSuper && (
                              <div onClick={(e) => e.stopPropagation()}>
                                <DropdownMenu>
                                  <DropdownMenuTrigger className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500 transition-colors focus:outline-none">
                                    <MoreVertical className="w-4 h-4" />
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="w-44 font-semibold text-slate-700">
                                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setAddingTo({ type: 'department', parentId: faculty.id }); setFormData({ name: '', code: '', level: 1, credits: 3 }); }}>
                                      <Plus className="w-3.5 h-3.5 text-indigo-500 mr-2" /> Add Department
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setEditingItem({ type: 'faculty', id: faculty.id, item: faculty }); setFormData({ name: faculty.name, code: faculty.code || '', level: 1, credits: 3 }); }}>
                                      <Edit2 className="w-3.5 h-3.5 text-amber-500 mr-2" /> Edit Faculty
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); confirmDelete('faculty', faculty.id, faculty.name); }} className="text-red-600 focus:text-red-700 focus:bg-red-50">
                                      <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete Faculty
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Departments */}
                        {isFacExpanded && (
                          <div className="bg-slate-50 border-t border-slate-100 p-2 pl-8 space-y-1">
                            {facultyDepts.length === 0 ? (
                              <div className="p-3 text-xs text-slate-400 text-center italic">No departments under this faculty.</div>
                            ) : facultyDepts.map(dept => {
                              const deptStages = stages.filter(s => s.department_id === dept.id);
                              const isDeptExpanded = !!expandedDepts[dept.id];

                              return (
                                <div key={dept.id} className="border border-slate-100 rounded-lg bg-white">
                                  <div 
                                    className="flex items-center justify-between p-2.5 hover:bg-slate-50 transition-colors cursor-pointer select-none"
                                    onClick={() => toggleDept(dept.id)}
                                  >
                                    <div className="flex items-center gap-2.5">
                                      <button className="text-slate-400 hover:text-slate-600 focus:outline-none">
                                        {isDeptExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                      </button>
                                      {isDeptExpanded ? <FolderOpen className="w-4 h-4 text-blue-500" /> : <Folder className="w-4 h-4 text-blue-500" />}
                                      <div>
                                        <div className="font-semibold text-sm text-slate-700">{dept.name}</div>
                                        {dept.code && <div className="text-[10px] font-mono text-slate-400">{dept.code}</div>}
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-md">
                                        {deptStages.length} {deptStages.length === 1 ? 'Stage' : 'Stages'}
                                      </span>

                                      {/* Department Context Menu: HoDs can ONLY Add Stage. Edit/Delete Department hidden. */}
                                      <div onClick={(e) => e.stopPropagation()}>
                                        <DropdownMenu>
                                          <DropdownMenuTrigger className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500 transition-colors focus:outline-none">
                                            <MoreVertical className="w-4 h-4" />
                                          </DropdownMenuTrigger>
                                          <DropdownMenuContent align="end" className="w-44 font-semibold text-slate-700">
                                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setAddingTo({ type: 'stage', parentId: dept.id }); setFormData({ name: '', code: '', level: 1, credits: 3 }); }}>
                                              <Plus className="w-3.5 h-3.5 text-blue-500 mr-2" /> Add Stage
                                            </DropdownMenuItem>
                                            {isSuper && (
                                              <>
                                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setEditingItem({ type: 'department', id: dept.id, item: dept }); setFormData({ name: dept.name, code: dept.code || '', level: 1, credits: 3 }); }}>
                                                  <Edit2 className="w-3.5 h-3.5 text-amber-500 mr-2" /> Edit Department
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); confirmDelete('department', dept.id, dept.name); }} className="text-red-600 focus:text-red-700 focus:bg-red-50">
                                                  <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete Department
                                                </DropdownMenuItem>
                                              </>
                                            )}
                                          </DropdownMenuContent>
                                        </DropdownMenu>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Stages */}
                                  {isDeptExpanded && (
                                    <div className="bg-slate-50/50 border-t border-slate-100 p-2 pl-8 space-y-1">
                                      {deptStages.length === 0 ? (
                                        <div className="p-2 text-[11px] text-slate-400 italic">No stages in this department.</div>
                                      ) : deptStages.map(stage => {
                                        const stageCourses = courses.filter(c => c.stage_id === stage.id);
                                        const isStageExpanded = !!expandedStages[stage.id];

                                        return (
                                          <div key={stage.id} className="border border-slate-100 rounded-md bg-white shadow-xs">
                                            <div 
                                              className="flex items-center justify-between p-2 hover:bg-slate-50 transition-colors cursor-pointer select-none"
                                              onClick={() => toggleStage(stage.id)}
                                            >
                                              <div className="flex items-center gap-2">
                                                <button className="text-slate-400 focus:outline-none">
                                                  {isStageExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                                                </button>
                                                <Layers className="w-3.5 h-3.5 text-amber-500" />
                                                <div className="font-medium text-xs text-slate-700">{stage.name}</div>
                                              </div>
                                              <div className="flex items-center gap-1.5">
                                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider bg-slate-100 px-1.5 py-0.5 rounded">
                                                  Level {stage.level}
                                                </span>
                                                <span className="text-[9px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                                                  {stageCourses.length} {stageCourses.length === 1 ? 'Course' : 'Courses'}
                                                </span>
                                                
                                                {/* Stage Context Menu: Both Super Admin and HoDs can Add Course, Edit Stage, Delete Stage */}
                                                <div onClick={(e) => e.stopPropagation()}>
                                                  <DropdownMenu>
                                                    <DropdownMenuTrigger className="p-0.5 rounded-md hover:bg-slate-200 text-slate-500 transition-colors focus:outline-none">
                                                      <MoreVertical className="w-3.5 h-3.5" />
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end" className="w-40 font-semibold text-slate-700">
                                                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setAddingTo({ type: 'course', parentId: stage.id }); setFormData({ name: '', code: '', level: 1, credits: 3 }); }}>
                                                        <Plus className="w-3.5 h-3.5 text-amber-600 mr-2" /> Add Course
                                                      </DropdownMenuItem>
                                                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setEditingItem({ type: 'stage', id: stage.id, item: stage }); setFormData({ name: stage.name, code: '', level: stage.level, credits: 3 }); }}>
                                                        <Edit2 className="w-3.5 h-3.5 text-amber-500 mr-2" /> Edit Stage
                                                      </DropdownMenuItem>
                                                      <DropdownMenuSeparator />
                                                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); confirmDelete('stage', stage.id, stage.name); }} className="text-red-600 focus:text-red-700 focus:bg-red-50">
                                                        <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete Stage
                                                      </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                  </DropdownMenu>
                                                </div>
                                              </div>
                                            </div>

                                            {/* Courses */}
                                            {isStageExpanded && (
                                              <div className="bg-slate-50 border-t border-slate-100 p-1.5 pl-6">
                                                {stageCourses.length === 0 ? (
                                                  <div className="p-1 text-[10px] text-slate-400 italic">No courses in this stage.</div>
                                                ) : (
                                                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                                    {stageCourses.map(course => (
                                                      <div key={course.id} className="bg-white border border-slate-200 rounded p-2 flex items-center gap-2 shadow-xs hover:border-slate-300 transition-colors cursor-default">
                                                        <BookOpen className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                                                        <div className="min-w-0 flex-1">
                                                          <div className="font-semibold text-[11px] text-slate-800 truncate">{course.name}</div>
                                                          <div className="flex items-center gap-2 mt-0.5">
                                                            <span className="text-[9px] font-mono text-slate-500 truncate">{course.code}</span>
                                                            {course.credits && (
                                                              <span className="text-[9px] text-slate-400 bg-slate-100 px-1 py-px rounded">{course.credits} Cr</span>
                                                            )}
                                                          </div>
                                                        </div>

                                                        {/* Course Context Menu: Both Super Admin and HoDs can Edit and Delete Course */}
                                                        <div onClick={(e) => e.stopPropagation()}>
                                                          <DropdownMenu>
                                                            <DropdownMenuTrigger className="p-1 rounded-md hover:bg-slate-100 text-slate-500 transition-colors focus:outline-none">
                                                              <MoreVertical className="w-3.5 h-3.5" />
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent align="end" className="w-40 font-semibold text-slate-700">
                                                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setEditingItem({ type: 'course', id: course.id, item: course }); setFormData({ name: course.name, code: course.code, level: 1, credits: course.credits || 3 }); }}>
                                                                <Edit2 className="w-3.5 h-3.5 text-amber-500 mr-2" /> Edit Course
                                                              </DropdownMenuItem>
                                                              <DropdownMenuSeparator />
                                                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); confirmDelete('course', course.id, course.name); }} className="text-red-600 focus:text-red-700 focus:bg-red-50">
                                                                <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete Course
                                                              </DropdownMenuItem>
                                                            </DropdownMenuContent>
                                                          </DropdownMenu>
                                                        </div>
                                                      </div>
                                                    ))}
                                                  </div>
                                                )}
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Add Modal */}
      {addingTo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden text-left">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-headline font-bold text-lg text-slate-900 capitalize">
                  Add {addingTo.type}
                </h3>
              </div>
              <button
                onClick={() => setAddingTo(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Name
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:border-[#540225] focus:ring-1 focus:ring-[#540225] outline-none"
                  placeholder={`E.g. ${addingTo.type === 'stage' ? 'Year 1' : 'Computer Engineering'}`}
                />
              </div>

              {addingTo.type !== 'stage' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Code (Optional)
                  </label>
                  <input
                    type="text"
                    value={formData.code}
                    onChange={(e) => setFormData({...formData, code: e.target.value})}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:border-[#540225] focus:ring-1 focus:ring-[#540225] outline-none font-mono"
                    placeholder="E.g. CE-101"
                    required={addingTo.type === 'course'}
                  />
                </div>
              )}

              {addingTo.type === 'stage' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Level
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={formData.level}
                    onChange={(e) => setFormData({...formData, level: parseInt(e.target.value)})}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:border-[#540225] focus:ring-1 focus:ring-[#540225] outline-none"
                  />
                </div>
              )}

              {addingTo.type === 'course' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Credits
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={formData.credits}
                    onChange={(e) => setFormData({...formData, credits: parseFloat(e.target.value)})}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:border-[#540225] focus:ring-1 focus:ring-[#540225] outline-none"
                  />
                </div>
              )}

              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setAddingTo(null)}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-bold text-white bg-[#540225] hover:bg-[#721c3b] rounded-xl shadow-md transition-all"
                >
                  Create {addingTo.type}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden text-left">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-headline font-bold text-lg text-slate-900 capitalize">
                  Edit {editingItem.type}
                </h3>
              </div>
              <button
                onClick={() => setEditingItem(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleEditSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Name
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:border-[#540225] focus:ring-1 focus:ring-[#540225] outline-none"
                />
              </div>

              {editingItem.type !== 'stage' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Code (Optional)
                  </label>
                  <input
                    type="text"
                    value={formData.code}
                    onChange={(e) => setFormData({...formData, code: e.target.value})}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:border-[#540225] focus:ring-1 focus:ring-[#540225] outline-none font-mono"
                    required={editingItem.type === 'course'}
                  />
                </div>
              )}

              {editingItem.type === 'stage' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Level
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={formData.level}
                    onChange={(e) => setFormData({...formData, level: parseInt(e.target.value)})}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:border-[#540225] focus:ring-1 focus:ring-[#540225] outline-none"
                  />
                </div>
              )}

              {editingItem.type === 'course' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Credits
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={formData.credits}
                    onChange={(e) => setFormData({...formData, credits: parseFloat(e.target.value)})}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:border-[#540225] focus:ring-1 focus:ring-[#540225] outline-none"
                  />
                </div>
              )}

              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-bold text-white bg-[#540225] hover:bg-[#721c3b] rounded-xl shadow-md transition-all"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmation.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full border border-slate-200 overflow-hidden text-center p-6">
            <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-red-600" />
            </div>
            <h3 className="font-headline font-bold text-xl text-slate-900 mb-2">Delete {deleteConfirmation.type}?</h3>
            <p className="text-sm text-slate-600 mb-6">
              Are you sure you want to delete <span className="font-bold text-slate-800">"{deleteConfirmation.name}"</span>? 
              This action cannot be undone. It may fail if this {deleteConfirmation.type} has nested children attached to it.
            </p>
            <div className="flex justify-center gap-3">
              <button
                onClick={() => setDeleteConfirmation({ isOpen: false, type: null, id: '', name: '' })}
                className="px-5 py-2.5 text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors w-full cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={executeDelete}
                className="px-5 py-2.5 text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-md transition-all w-full cursor-pointer"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 max-w-md bg-slate-900 text-white p-4 rounded-2xl shadow-2xl flex items-start gap-3 border border-slate-800 animate-in slide-in-from-bottom-5 duration-300">
          <div className="mt-0.5">
            <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-white mb-0.5">{toastMessage.title}</h4>
            <p className="text-xs text-slate-300 leading-relaxed">
              {toastMessage.desc}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
