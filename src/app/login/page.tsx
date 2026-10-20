'use client';

import React, { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useSession } from '@/lib/context/SessionContext';
import { UserRole } from '@/types/database';
import { ShieldAlert } from 'lucide-react';

function LoginContent() {
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [attemptedEmail, setAttemptedEmail] = useState<string | null>(null);

  const [inputEmail, setInputEmail] = useState('');
  const [inputPassword, setInputPassword] = useState('');
  const [showPasswordForm, setShowPasswordForm] = useState(false);

  const deniedParam = searchParams.get('denied');
  const errorParam = searchParams.get('error');
  const msgParam = searchParams.get('message');
  const emailParam = searchParams.get('email') || searchParams.get('attempted_email');

  const effectiveErrorMessage = errorMessage || (
    deniedParam === 'role_isolation'
      ? 'Access Denied: Your assigned role does not have authorization to access that portal.'
      : (errorParam === 'unauthorized' || errorParam === 'access_denied')
      ? (msgParam || 'Access Denied: Your account is not authorized. Contact the Academic Coordinator.')
      : (msgParam || null)
  );
  const effectiveAttemptedEmail = attemptedEmail || emailParam;

  const handleMicrosoftLogin = async () => {
    setLoading(true);
    setErrorMessage(null);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'azure',
        options: {
          scopes: 'email',
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        console.error('SSO Error:', error.message);
        setErrorMessage(`SSO Error: ${error.message}`);
        setLoading(false);
      }
    } catch (err: unknown) {
      console.error('SSO Error:', err);
      setErrorMessage(err instanceof Error ? err.message : 'An unexpected error occurred during sign-in.');
      setLoading(false);
    }
  };

  const session = useSession();

  const handleDemoSignIn = async (
    email: string,
    role: string,
    name: string,
    custom_permissions?: Record<string, boolean>,
    userId?: string,
    academicTitle?: string,
    departmentName?: string
  ) => {
    let resolvedPerms = custom_permissions;
    let resolvedId = userId;
    let resolvedTitle = academicTitle;
    let resolvedDept = departmentName;

    // If permissions or id not passed (e.g. from quick-test button), look up in DB to get real user data
    if (!resolvedPerms || !resolvedId) {
      try {
        const supabase = createClient();
        const { data: dbUser } = await supabase
          .from('users')
          .select('id, academic_title, custom_permissions, department:departments(name)')
          .ilike('email', email)
          .maybeSingle();

        if (dbUser) {
          if (!resolvedPerms && dbUser.custom_permissions) {
            resolvedPerms = dbUser.custom_permissions;
          }
          if (!resolvedId && dbUser.id) {
            resolvedId = dbUser.id;
          }
          if (!resolvedTitle && dbUser.academic_title) {
            resolvedTitle = dbUser.academic_title;
          }
          if (!resolvedDept && (dbUser.department as any)?.name) {
            resolvedDept = (dbUser.department as any)?.name;
          }
        }
      } catch {
        // fallback to defaults
      }
    }

    const sessionData = JSON.stringify({
      id: resolvedId || ('demo-' + role),
      name,
      email,
      role,
      roleTitle: resolvedTitle || role,
      avatarUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=e5eeff&color=0b1c30&bold=true`,
      staffId: '',
      departmentName: resolvedDept || '',
      custom_permissions: resolvedPerms || {},
      isSimulation: false,
    });

    document.cookie = `tius_session=${encodeURIComponent(sessionData)}; path=/; max-age=604800`;
    try {
      localStorage.setItem('tius_session_role', role);
      localStorage.setItem('tius_session_email', email);
      localStorage.setItem('tius_custom_permissions', JSON.stringify(resolvedPerms || {}));
    } catch {
      // ignore
    }

    // NOTE: Do NOT call session.setRole() here — it overwrites the cookie
    // with DEFAULT_USERS template data (wrong id/email). The cookie is already
    // correctly written above. window.location.href triggers a full reload
    // which hydrates SessionContext from the correct cookie.

    if (role === 'SUPER_ADMIN') {
      window.location.href = '/admin/roles';
    } else if (role === 'IT_ADMIN') {
      window.location.href = '/admin/structure';
    } else if (role === 'COORDINATOR') {
      window.location.href = '/coordinator';
    } else if (role === 'HOD') {
      window.location.href = '/hod';
    } else if (role === 'ACCOUNTANT') {
      window.location.href = '/finance';
    } else {
      window.location.href = '/teacher';
    }
  };

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage(null);

    try {
      const cleanEmail = inputEmail.trim().toLowerCase();
      const supabase = createClient();

      const { data: userRecord, error: userErr } = await supabase
        .from('users')
        .select('*, department:departments(name)')
        .ilike('email', cleanEmail)
        .maybeSingle();

      if (userErr || !userRecord) {
        setAttemptedEmail(cleanEmail);
        setErrorMessage('Access Denied: Account not provisioned in institutional directory. Contact Academic Coordinator.');
        setLoading(false);
        return;
      }

      if (userRecord.is_active === false) {
        setErrorMessage('Account Deactivated: Contact the Directorate of HR.');
        setLoading(false);
        return;
      }

      const userPerms = userRecord.custom_permissions || {};
      const sessionData = JSON.stringify({
        id: userRecord.id,
        name: userRecord.name,
        email: userRecord.email,
        role: userRecord.role,
        roleTitle: userRecord.academic_title || userRecord.role,
        avatarUrl: userRecord.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(userRecord.name)}&background=e5eeff&color=0b1c30&bold=true`,
        staffId: userRecord.staff_id || '',
        departmentName: (userRecord.department as any)?.name || '',
        custom_permissions: userPerms,
        isSimulation: false,
      });

      document.cookie = `tius_session=${encodeURIComponent(sessionData)}; path=/; max-age=604800`;
      try {
        localStorage.setItem('tius_session_role', userRecord.role);
        localStorage.setItem('tius_session_email', userRecord.email);
        localStorage.setItem('tius_custom_permissions', JSON.stringify(userPerms));
      } catch {
        // ignore
      }

      // NOTE: Do NOT call session.setRole() here — it overwrites the cookie
      // with DEFAULT_USERS template data (wrong id/email). The cookie is already
      // correctly written above with real user data from Supabase.

      if (userRecord.role === 'SUPER_ADMIN') {
        window.location.href = '/admin/roles';
      } else if (userRecord.role === 'IT_ADMIN') {
        window.location.href = '/admin/structure';
      } else if (userRecord.role === 'COORDINATOR') {
        window.location.href = '/coordinator';
      } else if (userRecord.role === 'HOD') {
        window.location.href = '/hod';
      } else if (userRecord.role === 'ACCOUNTANT') {
        window.location.href = '/finance';
      } else {
        window.location.href = '/teacher';
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Authentication failed.');
      setLoading(false);
    }
  };

  const handleSimulateUnauthorized = () => {
    setAttemptedEmail('unauthorized.lecturer@tiu.edu.iq');
    setErrorMessage(
      'Access Denied: Your account is not authorized. Contact the Academic Coordinator.'
    );
  };

  return (
    <div className="w-full min-h-screen flex items-center justify-center p-4 sm:p-6 lg:p-8 relative overflow-hidden bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(114,28,59,0.08),rgba(248,249,255,0))]">
      <div className="flex flex-col w-full items-center justify-center py-8 px-4 min-h-[calc(100vh-4rem)] max-w-xl">
        {/* Ambient backdrop glows */}
        <div className="relative w-full flex flex-col items-center">
          <div className="absolute -top-24 -left-20 w-72 h-72 rounded-full bg-[#721c3b]/10 blur-3xl pointer-events-none -z-10" />
          <div className="absolute -bottom-20 -right-16 w-80 h-80 rounded-full bg-[#ffbe3b]/15 blur-3xl pointer-events-none -z-10" />

          {/* Main Card Container */}
          <div className="w-full bg-white shadow-2xl rounded-3xl p-6 sm:p-10 flex flex-col items-center text-center relative border border-slate-100 transition-all duration-300">
            {/* Institutional Logo Header */}
            <div className="relative mb-6 group">
              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-[#eff4ff] flex items-center justify-center p-2 shadow-sm transition-transform duration-300 group-hover:scale-105 border border-blue-50">
                <img
                  alt="Tishk International University Sulaimani Logo"
                  className="w-full h-full object-contain rounded-xl"
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuDoDDRqJXEliwiAbQj3HE8fZbuJHyNLm4oXuQQ5QO7nQeR8qOdesMMJqIyGvqtkCY9Rjzbsq1raOKhc9i3B1hmX-CKY9ZP_pb0ev_safjontFAUkVZbtIPdFcN0LFfGLhBh695WC0f-958s-4dkfKqnb-dqpdihEqMy9cF7CHQFDpWItxiA4tI327j1Yut7rDKyJsZsz6UFPox71r5RXf4cWZ-uwLT2qmPnLstL1KjH8AKbnjNDjRdJpgmI0MtJb09N4w"
                />
              </div>
              <div className="absolute -bottom-1 -right-1 bg-[#540225] text-white rounded-full p-1 shadow-sm flex items-center justify-center ring-2 ring-white">
                <span className="material-symbols-outlined text-[15px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                  verified
                </span>
              </div>
            </div>

            {/* Portal Title & Subtitles */}
            <h1 className="font-headline text-2xl sm:text-3xl font-bold text-[#0b1c30] tracking-tight mb-2">
              TIUS Extra Hours &amp; Payroll Portal
            </h1>
            <p className="text-sm sm:text-base text-slate-600 max-w-md mb-8 leading-relaxed">
              Tishk International University <span className="text-[#540225] font-semibold">•</span> Sulaimani Campus <span className="text-[#540225] font-semibold">•</span> Single Sign-On Access
            </p>

            {/* ACCESS DENIED / UNAUTHORIZED ALERT BANNER */}
            {effectiveErrorMessage && (
              <div className="w-full mb-6 p-4 rounded-2xl bg-red-50 border border-red-200 text-left animate-in fade-in zoom-in-95 duration-200">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-red-100 text-red-600 flex items-center justify-center shrink-0 mt-0.5">
                    <ShieldAlert className="w-5 h-5 text-[#ba1a1a]" />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-bold text-[#ba1a1a] flex items-center gap-1.5">
                      Authentication Rejected
                    </h4>
                    <p className="text-xs sm:text-sm text-red-900 mt-1 font-medium leading-relaxed">
                      {effectiveErrorMessage}
                    </p>
                    {effectiveAttemptedEmail && (
                      <div className="mt-2 text-xs font-mono bg-white/80 px-2.5 py-1 rounded border border-red-200 text-red-800 inline-block">
                        Attempted Identity: {effectiveAttemptedEmail}
                      </div>
                    )}
                    <div className="mt-3 text-xs text-red-700 flex items-center gap-1">
                      <span>Inquiries:</span>
                      <a href="mailto:coordinator@tiu.edu.iq" className="underline font-semibold hover:text-red-900">
                        coordinator@tiu.edu.iq
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Primary Action: Microsoft Single Sign-On Button */}
            <div className="w-full max-w-md flex flex-col gap-3">
              <button
                id="sso-signin-btn"
                type="button"
                onClick={handleMicrosoftLogin}
                disabled={loading}
                className="w-full group relative overflow-hidden bg-[#721c3b] hover:bg-[#540225] text-white py-3.5 px-6 rounded-2xl shadow-md hover:shadow-xl active:scale-[0.99] transition-all duration-200 flex items-center justify-center gap-3 cursor-pointer disabled:opacity-80"
              >
                {/* Microsoft 4-Color Logo SVG */}
                <div className="bg-white p-1 rounded-lg flex items-center justify-center shadow-xs">
                  <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 21 21" xmlns="http://www.w3.org/2000/svg">
                    <rect fill="#F25022" height="9" width="9" x="1" y="1" />
                    <rect fill="#7FBA00" height="9" width="9" x="11" y="1" />
                    <rect fill="#00A4EF" height="9" width="9" x="11" y="1" />
                    <rect fill="#FFB900" height="9" width="9" x="11" y="1" />
                  </svg>
                </div>
                <span className="font-semibold text-sm sm:text-base tracking-normal">
                  {loading ? 'Connecting to Microsoft 365...' : 'Sign in with University Account (Microsoft 365)'}
                </span>
                <span className="material-symbols-outlined text-[20px] transition-transform duration-200 group-hover:translate-x-1">
                  arrow_forward
                </span>
              </button>

              {/* Toggle Manual Email / Password Form */}
              <div className="flex items-center my-1">
                <div className="flex-1 border-t border-slate-200" />
                <button
                  type="button"
                  onClick={() => setShowPasswordForm(!showPasswordForm)}
                  className="px-3 text-[11px] font-semibold text-slate-500 hover:text-[#540225] cursor-pointer"
                >
                  {showPasswordForm ? '▲ Hide Direct Login' : '▼ Or Sign In with Email & Password'}
                </button>
                <div className="flex-1 border-t border-slate-200" />
              </div>

              {/* Direct Institutional Credentials Form */}
              {showPasswordForm && (
                <form
                  onSubmit={handlePasswordLogin}
                  className="w-full bg-[#f8f9ff] p-4 rounded-2xl border border-slate-200 text-left space-y-3 animate-in fade-in zoom-in-95 duration-150"
                >
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">University Email</label>
                    <input
                      type="email"
                      required
                      value={inputEmail}
                      onChange={(e) => setInputEmail(e.target.value)}
                      placeholder="e.g. name@tiu.edu.iq"
                      className="w-full h-9 px-3 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#721c3b]/30"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">Password</label>
                    <input
                      type="password"
                      required
                      value={inputPassword}
                      onChange={(e) => setInputPassword(e.target.value)}
                      placeholder="Enter account password"
                      className="w-full h-9 px-3 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#721c3b]/30"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-2.5 px-4 rounded-xl bg-[#540225] hover:bg-[#721c3b] text-white text-xs font-bold shadow-xs transition-colors cursor-pointer disabled:opacity-70"
                  >
                    {loading ? 'Authenticating...' : 'Sign In with Institutional Password'}
                  </button>

                  <div className="pt-1 text-center">
                    <button
                      type="button"
                      onClick={() => handleDemoSignIn('barez.hassan@tiu.edu.iq', 'SUPER_ADMIN', 'Barez Hassan')}
                      className="text-[11px] font-semibold text-[#540225] hover:underline cursor-pointer"
                    >
                      ⚡ Quick Sign-In as Super Admin (Barez Hassan)
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>

          {/* Institutional Footer Outside Card */}
          <div className="mt-8 text-center text-slate-400 text-xs">
            <p>Tishk International University (TIU) • Sulaimani Campus</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#f8f9ff]">
          <div className="w-8 h-8 border-4 border-[#721c3b] border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
