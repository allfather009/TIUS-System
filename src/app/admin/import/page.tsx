'use client';

import React, { useState, useRef } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { useSession } from '@/lib/context/SessionContext';
import { BulkImportRow, bulkImportUsers } from '@/lib/services/userService';
import { UploadCloud, FileSpreadsheet, Download, AlertCircle, CheckCircle2, FileText, Lock, ShieldAlert } from 'lucide-react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import Link from 'next/link';

export default function BatchImportPage() {
  const { user, role, isSuperAdmin, hasPermission } = useSession();
  const activeRole = role || 'TEACHER';

  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<BulkImportRow[]>([]);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [successCount, setSuccessCount] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [toastMessage, setToastMessage] = useState<{ title: string; desc: string } | null>(null);

  const showToast = (title: string, desc: string) => {
    setToastMessage({ title, desc });
    setTimeout(() => {
      setToastMessage(null);
    }, 4500);
  };

  const handleDownloadTemplate = () => {
    const csvContent =
      'name,email,department_name,employment_type,academic_title,staff_id,role\n' +
      'Dr. Aram Mohammed,aram.mohammed@tiu.edu.iq,Computer Engineering & IT,FULL_TIME,Assistant Professor,TIU-4501,TEACHER\n' +
      'Dr. Rozhgar Qadir,rozhgar.qadir@tiu.edu.iq,Faculty of Dentistry,PART_TIME,Senior Clinical Lecturer,TIU-3320,TEACHER\n' +
      'Dr. Bnar Rostam,bnar.rostam@tiu.edu.iq,Civil Engineering,FULL_TIME,Associate Professor,TIU-1205,HOD\n' +
      'Sazan Anwar,sazan.anwar@tiu.edu.iq,University Finance & Treasury,FULL_TIME,Senior Accountant,TIU-0955,ACCOUNTANT';

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'tius_faculty_import_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const processFile = (uploadedFile: File) => {
    setFile(uploadedFile);
    setValidationErrors([]);
    setSuccessCount(null);
    setParsedRows([]);

    const fileName = uploadedFile.name.toLowerCase();

    if (fileName.endsWith('.csv')) {
      Papa.parse(uploadedFile, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          handleParsedData(results.data as Record<string, unknown>[]);
        },
        error: (error) => {
          setValidationErrors([`CSV Parsing Error: ${error.message}`]);
        },
      });
    } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
          if (json.length < 2) {
            setValidationErrors(['Excel sheet is empty or has no data rows.']);
            return;
          }
          // Convert array of arrays to array of objects
          const headers = (json[0] as unknown[]).map((h) => String(h || '').trim());
          const rows = (json.slice(1) as unknown[][]).map((row) => {
            const obj: Record<string, string> = {};
            headers.forEach((h, idx) => {
              obj[h] = row[idx] !== undefined ? String(row[idx]).trim() : '';
            });
            return obj;
          });
          handleParsedData(rows);
        } catch (err: unknown) {
          setValidationErrors([`Excel Parsing Error: ${err instanceof Error ? err.message : String(err)}`]);
        }
      };
      reader.readAsArrayBuffer(uploadedFile);
    } else {
      setValidationErrors(['Unsupported file format. Please upload a .csv or .xlsx file.']);
    }
  };

  const handleParsedData = (data: Record<string, unknown>[]) => {
    const standardized: BulkImportRow[] = data
      .map((row) => {
        // Robust value extractor with case-insensitive and whitespace-tolerant key matching
        const getVal = (aliases: string[]): string => {
          for (const alias of aliases) {
            if (row[alias] !== undefined && row[alias] !== null) {
              const str = String(row[alias]).trim();
              if (str) return str;
            }
          }
          const keys = Object.keys(row);
          for (const alias of aliases) {
            const matchedKey = keys.find((k) => k.trim().toLowerCase() === alias.toLowerCase());
            if (matchedKey && row[matchedKey] !== undefined && row[matchedKey] !== null) {
              const str = String(row[matchedKey]).trim();
              if (str) return str;
            }
          }
          return '';
        };

        const name = getVal(['Display name', 'Display Name', 'name', 'Full Name', 'Name', 'Full_Name']);
        const email = getVal(['User principal name', 'User Principal Name', 'user principal name', 'email', 'Email', 'Institutional Email']);
        const department_name = getVal(['Department', 'department_name', 'department', 'Department Name']);
        const faculty_name = getVal(['Company name', 'Company Name', 'company_name', 'faculty', 'Faculty']);
        const employment_type = getVal(['Employee Type', 'Employee type', 'employment_type', 'Employment Type']) || 'PART_TIME';
        const academic_title = getVal(['Job title', 'Job Title', 'academic_title', 'Academic Title', 'Title', 'title']) || 'Lecturer';
        const staff_id = getVal(['Employee ID', 'Employee id', 'Employee Id', 'staff_id', 'Staff ID', 'StaffID']);
        const role = getVal(['role', 'Role']) || 'TEACHER';
        const statusRaw = getVal(['Status', 'status']) || 'Active';
        const is_active = statusRaw.toLowerCase() !== 'not active' && statusRaw.toLowerCase() !== 'inactive';

        return {
          name,
          email,
          department_name,
          faculty_name,
          employment_type,
          academic_title,
          staff_id,
          role,
          is_active,
        };
      })
      .filter((r) => r.name || r.email); // Silently skip completely blank separator rows

    // Validate remaining non-empty rows
    const errors: string[] = [];
    const validRows = standardized.filter((r, idx) => {
      if (!r.name) {
        errors.push(`Row ${idx + 1}: Name is required`);
        return false;
      }
      if (!r.email || !r.email.includes('@')) {
        errors.push(`Row ${idx + 1} (${r.name}): Valid institutional email is required`);
        return false;
      }
      return true;
    });

    setParsedRows(validRows);
    setValidationErrors(errors);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleExecuteImport = async () => {
    if (parsedRows.length === 0) return;
    setImporting(true);
    try {
      const result = await bulkImportUsers(parsedRows);
      if (result.success) {
        setSuccessCount(result.importedCount);
        showToast(
          'Batch Import Complete',
          `Successfully registered ${result.importedCount} faculty members into the database.`
        );
        // Clear file to start fresh or let user see success state
      } else {
        setValidationErrors(result.errors || ['Could not complete bulk import.']);
      }
    } catch (err: unknown) {
      setValidationErrors([err instanceof Error ? err.message : 'Import failed']);
    } finally {
      setImporting(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setParsedRows([]);
    setValidationErrors([]);
    setSuccessCount(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const isAuthorized =
    isSuperAdmin ||
    activeRole === 'SUPER_ADMIN' ||
    hasPermission?.('can_batch_import') ||
    user?.custom_permissions?.['can_batch_import'] === true ||
    user?.custom_permissions?.['can_import_data'] === true;

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
                You do not have permission to perform bulk imports.
              </p>
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8f9ff]">
      <Sidebar activeItem="import" />

      <div className="pl-72">
        <Header
          breadcrumbCategory="TIU Central Administration"
          breadcrumbPage="Batch Import"
          activeViewLabel="Super Admin"
        />

        <main className="w-full pt-20 pb-16 px-8">
          <div className="max-w-4xl mx-auto space-y-8">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div className="space-y-1">
                <h1 className="font-headline text-2xl sm:text-3xl font-bold text-[#0b1c30] tracking-tight">
                  Batch Import Faculty &amp; Staff
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 max-w-3xl">
                  Upload an Excel or CSV file to register users in bulk and map their roles automatically.
                </p>
              </div>
            </div>

            <div className="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden">
              <div className="p-8 space-y-8">
                {/* Template Banner */}
                <div className="p-4 rounded-2xl bg-[#eff4ff] border border-blue-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div className="flex flex-col text-xs">
                      <span className="font-bold text-[#0b1c30]">
                        Official batch import template prepared
                      </span>
                      <span className="text-slate-500 text-[11px]">
                        Academic Year 2024–2025 • Standard TIU Staff Schema
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleDownloadTemplate}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white border border-blue-200 text-blue-900 text-xs font-bold hover:bg-blue-50 transition-colors shadow-2xs shrink-0 cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download Template (.csv)</span>
                  </button>
                </div>

                {/* Upload Section */}
                <div
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                  onClick={() => !file && fileInputRef.current?.click()}
                  className={`
                    border-2 border-dashed rounded-3xl p-10 text-center transition-all relative overflow-hidden
                    ${
                      dragActive
                        ? 'border-indigo-400 bg-indigo-50/50 scale-[0.99]'
                        : file
                        ? 'border-emerald-200 bg-emerald-50/30'
                        : 'border-slate-200 hover:border-indigo-300 hover:bg-slate-50 cursor-pointer'
                    }
                  `}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        processFile(e.target.files[0]);
                      }
                    }}
                  />

                  {successCount !== null ? (
                    <div className="flex flex-col items-center justify-center animate-in zoom-in duration-300">
                      <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mb-4">
                        <CheckCircle2 className="w-8 h-8" />
                      </div>
                      <h3 className="text-xl font-bold text-slate-800 mb-2">Import Successful</h3>
                      <p className="text-sm text-slate-500 max-w-md mx-auto mb-6">
                        Successfully imported {successCount} users into the system.
                      </p>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleReset();
                        }}
                        className="px-6 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold transition-colors"
                      >
                        Upload Another File
                      </button>
                    </div>
                  ) : file ? (
                    <div className="flex flex-col items-center justify-center">
                      <div className="w-16 h-16 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center mb-4 shadow-sm border border-indigo-200">
                        <FileSpreadsheet className="w-8 h-8" />
                      </div>
                      <h3 className="text-lg font-bold text-slate-800 mb-1">{file.name}</h3>
                      <p className="text-xs text-slate-500 mb-6 font-mono">
                        {(file.size / 1024).toFixed(1)} KB • {parsedRows.length} valid rows extracted
                      </p>
                      
                      <div className="flex items-center gap-3">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleReset();
                          }}
                          disabled={importing}
                          className="px-5 py-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm font-bold transition-colors disabled:opacity-50"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleExecuteImport();
                          }}
                          disabled={importing || parsedRows.length === 0}
                          className="inline-flex items-center gap-2 px-6 py-2 rounded-xl bg-[#540225] hover:bg-[#721c3b] text-white text-sm font-bold transition-all shadow-md disabled:opacity-50"
                        >
                          {importing ? (
                            <>
                              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                              <span>Importing...</span>
                            </>
                          ) : (
                            <>
                              <UploadCloud className="w-4 h-4" />
                              <span>Execute Import</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-6">
                      <div className="w-16 h-16 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mb-4 transition-transform group-hover:scale-110">
                        <UploadCloud className="w-8 h-8" />
                      </div>
                      <h3 className="text-lg font-bold text-slate-700 mb-2">Drag &amp; drop your file here</h3>
                      <p className="text-sm text-slate-500 max-w-sm mx-auto">
                        or click to browse from your computer. Supports .csv and .xlsx files.
                      </p>
                    </div>
                  )}
                </div>

                {/* Validation Errors */}
                {validationErrors.length > 0 && successCount === null && (
                  <div className="p-5 rounded-2xl bg-red-50 border border-red-100">
                    <div className="flex items-center gap-2 text-red-800 font-bold text-sm mb-3">
                      <AlertCircle className="w-5 h-5 text-red-600" />
                      Validation Errors Found
                    </div>
                    <ul className="list-disc list-inside text-xs text-red-700 space-y-1.5 font-mono bg-white/50 p-4 rounded-xl border border-red-100/50">
                      {validationErrors.map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {/* Preview Table */}
                {parsedRows.length > 0 && successCount === null && (
                  <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
                    <div className="p-4 border-b border-slate-100 bg-slate-50 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-slate-800 text-sm">Data Preview</h4>
                        <span className="text-xs text-slate-500 font-medium">({parsedRows.length} total rows)</span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] font-bold">
                        <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                          {parsedRows.filter((r) => r.is_active !== false).length} Active
                        </span>
                        {parsedRows.filter((r) => r.is_active === false).length > 0 && (
                          <span className="bg-slate-100 text-slate-600 border border-slate-200 px-2.5 py-0.5 rounded-full">
                            {parsedRows.filter((r) => r.is_active === false).length} Inactive
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="overflow-x-auto max-h-[420px]">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-white sticky top-0 border-b border-slate-200 z-10 shadow-[0_2px_4px_rgba(0,0,0,0.02)]">
                          <tr>
                            <th className="px-4 py-3 font-semibold text-slate-600">Name</th>
                            <th className="px-4 py-3 font-semibold text-slate-600">Email</th>
                            <th className="px-4 py-3 font-semibold text-slate-600">Department</th>
                            <th className="px-4 py-3 font-semibold text-slate-600">Academic Title</th>
                            <th className="px-4 py-3 font-semibold text-slate-600">Staff ID</th>
                            <th className="px-4 py-3 font-semibold text-slate-600">Type</th>
                            <th className="px-4 py-3 font-semibold text-slate-600">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {parsedRows.slice(0, 100).map((row, i) => (
                            <tr key={i} className={`hover:bg-slate-50 transition-colors ${row.is_active === false ? 'opacity-60 bg-slate-50/50' : ''}`}>
                              <td className="px-4 py-2.5 font-semibold text-slate-800 whitespace-nowrap">{row.name}</td>
                              <td className="px-4 py-2.5 text-slate-500 whitespace-nowrap font-mono text-[11px]">{row.email}</td>
                              <td className="px-4 py-2.5 text-slate-700">{row.department_name || 'General / Central'}</td>
                              <td className="px-4 py-2.5 text-slate-600 font-medium">{row.academic_title}</td>
                              <td className="px-4 py-2.5 font-mono text-[11px] text-slate-500">{row.staff_id || 'Auto-generated'}</td>
                              <td className="px-4 py-2.5 whitespace-nowrap">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                                  (row.employment_type || '').toUpperCase().includes('PART')
                                    ? 'bg-amber-50 text-amber-700 border border-amber-200/60'
                                    : 'bg-blue-50 text-blue-700 border border-blue-200/60'
                                }`}>
                                  {(row.employment_type || '').toUpperCase().includes('PART') ? 'Part-Time' : 'Full-Time'}
                                </span>
                              </td>
                              <td className="px-4 py-2.5 whitespace-nowrap">
                                {row.is_active === false ? (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200">
                                    Not Active
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    Active
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {parsedRows.length > 100 && (
                      <div className="p-3 bg-slate-50 border-t border-slate-100 text-center text-xs text-slate-500 font-medium">
                        Showing first 100 rows preview (all {parsedRows.length} will be imported on execute).
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 max-w-md bg-slate-900 text-white p-4 rounded-2xl shadow-2xl flex items-start gap-3 border border-slate-800 animate-in slide-in-from-bottom-5 duration-300">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          <div className="flex-1 text-xs">
            <h5 className="font-bold text-white">{toastMessage.title}</h5>
            <p className="text-slate-300 mt-0.5 leading-relaxed">{toastMessage.desc}</p>
          </div>
          <button
            onClick={() => setToastMessage(null)}
            className="text-slate-400 hover:text-white cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
