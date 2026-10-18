'use client';

import React, { useState } from 'react';
import { X, Calendar, Clock, BookOpen, Check } from 'lucide-react';
import { Timesheet } from '@/types/database';
import { CustomSelect, CustomSelectOption } from '@/components/ui/CustomSelect';

const sessionTypeOptions: CustomSelectOption[] = [
  { value: 'Instructional Lab Session', label: 'Instructional Lab Session' },
  { value: 'Makeup Lecture', label: 'Makeup Lecture' },
  { value: 'Exam Supervision', label: 'Exam Supervision' },
  { value: 'Senior Capstone Review', label: 'Senior Capstone Review' },
];

interface EditTimesheetModalProps {
  timesheet: Timesheet | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (id: string, updates: Partial<Timesheet>) => Promise<void>;
}

export function EditTimesheetModal({
  timesheet,
  isOpen,
  onClose,
  onSave,
}: EditTimesheetModalProps) {
  const [date, setDate] = useState('');
  const [hours, setHours] = useState('');
  const [courseCode, setCourseCode] = useState('');
  const [sessionType, setSessionType] = useState('');
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const [prevTimesheetId, setPrevTimesheetId] = useState<string | null>(null);
  if (timesheet && timesheet.id !== prevTimesheetId) {
    setPrevTimesheetId(timesheet.id);
    setDate(timesheet.date || '');
    setHours(String(timesheet.hours || ''));
    setCourseCode(timesheet.course_code || '');
    setSessionType(timesheet.session_type || 'Instructional Lab Session');
    setNotes(timesheet.notes || '');
  }

  if (!isOpen || !timesheet) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numHours = parseFloat(hours);
    if (isNaN(numHours) || numHours <= 0) return;

    setIsSaving(true);
    try {
      await onSave(timesheet.id, {
        date,
        hours: numHours,
        course_code: courseCode.trim().toUpperCase(),
        session_type: sessionType,
        notes: notes.trim(),
      });
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden text-left flex flex-col max-h-[92vh]">
        <div className="p-6 pb-4 border-b border-slate-100 flex items-start justify-between bg-slate-50/50">
          <div>
            <h2 className="font-headline text-lg font-bold text-[#0b1c30]">
              Edit Timesheet Record
            </h2>
            <p className="text-xs text-slate-500">
              Editing log for <strong className="text-slate-800">{timesheet.teacher?.name || 'Faculty Member'}</strong>
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-500" />
                Date
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="w-full h-10 px-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-800"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-slate-500" />
                Duration (Hours)
              </label>
              <input
                type="number"
                step="0.5"
                min="0.5"
                max="12"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                required
                className="w-full h-10 px-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-800 font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                <BookOpen className="w-3.5 h-3.5 text-slate-500" />
                Course Code
              </label>
              <input
                type="text"
                value={courseCode}
                onChange={(e) => setCourseCode(e.target.value)}
                className="w-full h-10 px-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-800 uppercase"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Session Type</label>
              <CustomSelect
                value={sessionType}
                onChange={setSessionType}
                options={sessionTypeOptions}
                placeholder="Select Session Type..."
                searchable={false}
                triggerClassName="h-10"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700">Activity Description</label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              required
              className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 resize-none"
            />
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2 rounded-xl bg-[#540225] hover:bg-[#721c3b] text-white text-xs font-bold transition-all shadow-md flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>{isSaving ? 'Saving...' : 'Update Log'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
