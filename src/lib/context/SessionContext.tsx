'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { UserRole } from '@/types/database';
import { createClient } from '@/lib/supabase/client';
import { DEFAULT_ROLE_PERMISSIONS, resolveEffectivePermission } from '@/lib/services/systemSettingsService';

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  roleTitle: string;
  avatarUrl: string;
  staffId: string;
  departmentName?: string;
  department_ids?: string[];
  departments?: string[];
  custom_permissions?: Record<string, boolean>;
  isSimulation?: boolean;
  academic_title?: string;
  avatar_url?: string | null;
}

interface SessionContextType {
  role: UserRole | null;
  user: SessionUser | null;
  activeUser: SessionUser | null;
  realUser: SessionUser | null;
  simulatedUser: SessionUser | null;
  isSimulating: boolean;
  isSimulation: boolean;
  activeViewLabel: string;
  isSuperAdmin: boolean;
  rolePermissions: Record<string, Record<string, boolean>>;
  hasPermission: (key: string) => boolean;
  refreshPermissions: () => Promise<void>;
  setRole: (newRole: UserRole, customPerms?: Record<string, boolean>) => void;
  simulateUser: (user: any) => Promise<void> | void;
  exitSimulation: () => void;
  logout: () => void;
}

export const DEFAULT_USERS: Record<UserRole, SessionUser> = {
  SUPER_ADMIN: {
    id: '3173be76-e43d-499e-869c-fefc30cac0e5',
    name: 'Barez Hassan',
    email: 'barez.hassan@tiu.edu.iq',
    role: 'SUPER_ADMIN',
    roleTitle: 'Super Admin',
    academic_title: 'Super Admin',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
    staffId: 'TIU-SUPER-001',
    departmentName: 'Central University Administration',
  },
  COORDINATOR: {
    id: 'u1111111-1111-1111-1111-111111111111',
    name: 'Dr. Sarah Al-Bayati',
    email: 'sarah.bayati@tiu.edu.iq',
    role: 'COORDINATOR',
    roleTitle: 'Academic Coordinator',
    academic_title: 'Academic Coordinator',
    avatarUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDi_rhOoAnU0dCCIZzwWJzlPTStvQ0i2xVlLfrpvE-UM02VNwSEJEqpAzEu1UxsrVZFvFziGMcZYPbuEHCEFu-owfquciCIKADZEL5yCfpqjqt-AW7UciRILindl61y0tBj5fdk_q5wFjMWeOAAHFlW1gj1EQeNc178N9kiJHG_nHkPIvo3UDQA82Cmv15L4e_0ce_i96NHEIT5gmiN_HHg8eINlrCyGTN2uKGseLd8oXuNKnxK1npo',
    staffId: 'TIU-4119',
    departmentName: 'Academic Coordination Office',
  },
  HOD: {
    id: 'u2222222-2222-2222-2222-222222222222',
    name: 'Prof. Dr. Kawa Rashid',
    email: 'kawa.rashid@tiu.edu.iq',
    role: 'HOD',
    roleTitle: 'Head of Department (HoD)',
    academic_title: 'Head of Department',
    avatarUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCX2p6NwcVU0pCAxARYDeyTLZutJFLjcth9uydwQh63jB3qJH5ALx7OwVMb8vPHGe6pDab5oik_gI9YuypAnWxgp5i5EfTnxdVCPIifX8ust1tuNXFgQljoI51HHI17tXYtwK5jztSqKV4_L7JkW6ROjhPQRkXiN4zcvEDrncOJ7svg7YReLxujgnUW2fsOci80adG1iPGsqtxgj0ABlPu3vFoMpBHtFGHC7wRnTlYOoySnEhPSUsRN',
    staffId: 'TIU-1002',
    departmentName: 'Computer Engineering',
    department_ids: ['b7dcb16f-034b-41f3-9dc6-cb43118116f2'],
    departments: ['Computer Engineering'],
  },
  ACCOUNTANT: {
    id: 'u4444444-4444-4444-4444-444444444444',
    name: 'Rezan K. Faraj',
    email: 'rezan.faraj@tiu.edu.iq',
    role: 'ACCOUNTANT',
    roleTitle: 'Chief Payroll Officer',
    academic_title: 'Chief Payroll Officer',
    avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=150&q=80',
    staffId: 'TIU-0941',
    departmentName: 'University Finance & Treasury',
  },
  IT_ADMIN: {
    id: 'u3333333-3333-3333-3333-333333333333',
    name: 'Sarkawt Ahmed',
    email: 'sarkawt.ahmed@tiu.edu.iq',
    role: 'IT_ADMIN',
    roleTitle: 'IT Support Admin',
    academic_title: 'IT Support Admin',
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80',
    staffId: 'TIU-IT-004',
    departmentName: 'IT & Technical Services',
  },
  DEAN: {
    id: 'u5555555-5555-5555-5555-555555555555',
    name: 'Prof. Dr. Halmat Jaza',
    email: 'halmat.jaza@tiu.edu.iq',
    role: 'DEAN',
    roleTitle: 'Dean',
    academic_title: 'Professor & Dean',
    avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=150&q=80',
    staffId: 'TIU-DEAN-001',
    departmentName: 'Faculty of Engineering',
  },
  VICE_DEAN: {
    id: 'u6666666-6666-6666-6666-666666666666',
    name: 'Assoc. Prof. Dr. Dilshad Ameen',
    email: 'dilshad.ameen@tiu.edu.iq',
    role: 'VICE_DEAN',
    roleTitle: 'Vice Dean',
    academic_title: 'Associate Professor & Vice Dean',
    avatarUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=150&q=80',
    staffId: 'TIU-VDEAN-002',
    departmentName: 'Faculty of Engineering',
  },
  TEACHER: {
    id: 'u8888888-8888-8888-8888-888888888888',
    name: 'Dr. Ali Rashid',
    email: 'ali.rashid@tiu.edu.iq',
    role: 'TEACHER',
    roleTitle: 'Assistant Professor',
    academic_title: 'Lecturer',
    avatarUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCX2p6NwcVU0pCAxARYDeyTLZutJFLjcth9uydwQh63jB3qJH5ALx7OwVMb8vPHGe6pDab5oik_gI9YuypAnWxgp5i5EfTnxdVCPIifX8ust1tuNXFgQljoI51HHI17tXYtwK5jztSqKV4_L7JkW6ROjhPQRkXiN4zcvEDrncOJ7svg7YReLxujgnUW2fsOci80adG1iPGsqtxgj0ABlPu3vFoMpBHtFGHC7wRnTlYOoySnEhPSUsRN',
    staffId: 'TIU-2490',
    departmentName: 'Computer Engineering',
    departments: ['Computer Engineering', 'Information Technology'],
  },
};

const VIEW_LABELS: Record<UserRole, string> = {
  SUPER_ADMIN: 'Super Admin',
  IT_ADMIN: 'IT Support Admin',
  COORDINATOR: 'Academic Coordinator',
  HOD: 'Head of Department',
  DEAN: 'Dean',
  VICE_DEAN: 'Vice Dean',
  ACCOUNTANT: 'Finance & Payroll',
  TEACHER: 'Teacher',
};

const SessionContext = createContext<SessionContextType | undefined>(undefined);

interface SessionProviderProps {
  children: ReactNode;
  initialRole?: UserRole;
  initialSession?: any;
  initialRealUser?: any;
  initialSimulatedUser?: any;
  initialIsSimulating?: boolean;
}

export function SessionProvider({
  children,
  initialRole,
  initialSession,
  initialRealUser,
  initialSimulatedUser,
  initialIsSimulating,
}: SessionProviderProps) {
  const pathname = usePathname();

  // Pure deterministic role based on pathname
  const getDeterministicRole = (path: string): UserRole => {
    if (path.startsWith('/admin')) return 'SUPER_ADMIN';
    if (path.startsWith('/coordinator')) return 'COORDINATOR';
    if (path.startsWith('/hod')) return 'HOD';
    if (path.startsWith('/payroll') || path.startsWith('/finance')) return 'ACCOUNTANT';
    if (path.startsWith('/teacher')) return 'TEACHER';
    return 'SUPER_ADMIN';
  };

  // 1. Real Authenticated User State (Must never be overwritten by simulation; strictly null for unauthenticated guests)
  const [realUser, setRealUser] = useState<SessionUser | null>(() => {
    if (initialRealUser) return initialRealUser;
    if (initialSession && !initialSession.isSimulation) return initialSession;
    return null;
  });

  // 2. Simulation States
  const [isSimulating, setIsSimulating] = useState<boolean>(() => {
    if (typeof initialIsSimulating === 'boolean') return initialIsSimulating;
    if (initialSimulatedUser) return true;
    if (initialSession?.isSimulation) return true;
    return false;
  });

  const [simulatedUser, setSimulatedUser] = useState<SessionUser | null>(() => {
    if (initialSimulatedUser) return initialSimulatedUser;
    if (initialSession?.isSimulation) return initialSession;
    return null;
  });

  const [customPermissions, setCustomPermissions] = useState<Record<string, boolean>>(() => {
    if (initialSimulatedUser?.custom_permissions) return initialSimulatedUser.custom_permissions;
    if (initialSession?.isSimulation && initialSession?.custom_permissions) return initialSession.custom_permissions;
    if (initialRealUser?.custom_permissions) return initialRealUser.custom_permissions;
    if (initialSession?.custom_permissions) return initialSession.custom_permissions;
    return {};
  });

  const [rolePermissions, setRolePermissions] = useState<Record<string, Record<string, boolean>>>(DEFAULT_ROLE_PERMISSIONS);

  const mergeWithDefaultRolePermissions = (incoming?: Record<string, Record<string, boolean>> | null) => {
    const merged: Record<string, Record<string, boolean>> = {};
    for (const [r, perms] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
      merged[r] = { ...perms };
    }
    if (incoming && typeof incoming === 'object') {
      for (const [r, perms] of Object.entries(incoming)) {
        merged[r] = {
          ...(merged[r] || (DEFAULT_ROLE_PERMISSIONS as any)[r] || {}),
          ...(perms as Record<string, boolean>),
        };
      }
    }
    return merged;
  };

  useEffect(() => {
    async function loadRolePerms() {
      try {
        const res = await fetch('/api/system-settings', { cache: 'no-store' });
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.data?.role_permissions) {
            setRolePermissions(mergeWithDefaultRolePermissions(json.data.role_permissions));
          }
        }
      } catch (err) {
        console.error('Failed to load role permissions in session:', err);
      }
    }
    loadRolePerms();
  }, []);

  const refreshPermissions = async () => {
    try {
      const res = await fetch('/api/system-settings', { cache: 'no-store' });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data?.role_permissions) {
          setRolePermissions(mergeWithDefaultRolePermissions(json.data.role_permissions));
        }
      }

      // Re-sync active user custom_permissions from Supabase
      const targetUserId = isSimulating ? simulatedUser?.id : realUser?.id;
      if (targetUserId && !targetUserId.startsWith('demo-') && !targetUserId.startsWith('u1111') && !targetUserId.startsWith('u8888')) {
        const supabase = createClient();
        const { data: dbUser } = await supabase
          .from('users')
          .select('custom_permissions')
          .eq('id', targetUserId)
          .maybeSingle();

        if (dbUser) {
          const freshPerms: Record<string, boolean> =
            dbUser.custom_permissions && typeof dbUser.custom_permissions === 'object'
              ? dbUser.custom_permissions
              : {};
          setCustomPermissions(freshPerms);
          if (isSimulating && simulatedUser) {
            setSimulatedUser((prev) => (prev ? { ...prev, custom_permissions: freshPerms } : null));
          } else {
            setRealUser((prev) => (prev ? { ...prev, custom_permissions: freshPerms } : null));
          }
        }
      }
    } catch (err) {
      console.error('Failed to refresh permissions:', err);
    }
  };

  const [role, setRoleState] = useState<UserRole | null>(() => {
    if (initialRole && initialRole in DEFAULT_USERS) return initialRole;
    if (initialSimulatedUser?.role && initialSimulatedUser.role in DEFAULT_USERS) return initialSimulatedUser.role;
    if (initialRealUser?.role && initialRealUser.role in DEFAULT_USERS) return initialRealUser.role;
    return null;
  });

  const [prevPathname, setPrevPathname] = useState(pathname);

  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    // If navigating back to /admin/roles, make sure role is SUPER_ADMIN if real user is Super Admin
    if (pathname.startsWith('/admin/roles') && !isSimulating && realUser?.role === 'SUPER_ADMIN') {
      setRoleState('SUPER_ADMIN');
    }
  }

  // Synchronize client session, cookies, and database state on mount & route changes
  useEffect(() => {
    // 1. URL search params override (dev/preview testing)
    const params = new URLSearchParams(window.location.search);
    const queryRole = params.get('role');

    // 2. Parse primary session cookie (real user)
    const cookieMatch = document.cookie.match(/tius_session=([^;]+)/);
    let parsedRealUser: any = null;
    if (cookieMatch) {
      try {
        const raw = cookieMatch[1];
        const decoded = raw.includes('%') ? decodeURIComponent(raw) : raw;
        const session = JSON.parse(decoded);
        if (session && typeof session === 'object' && !session.isSimulation && session.id && session.role) {
          parsedRealUser = session;
          setRealUser((prev) => ({
            ...(prev || {}),
            ...session,
            isSimulation: false,
          }));
        }
      } catch {
        // ignore parse error
      }
    }

    // Unauthenticated guest check: if no real user in cookie, state, or initial props, remain strictly null
    if (!parsedRealUser && !initialRealUser && !realUser) {
      setRealUser(null);
      setRoleState(null);
      setIsSimulating(false);
      setSimulatedUser(null);
      return;
    }

    const effectiveRealRole = parsedRealUser?.role || realUser?.role;
    const isSuperAdminReal = effectiveRealRole === 'SUPER_ADMIN';

    if (queryRole && queryRole in DEFAULT_USERS && isSuperAdminReal) {
      setRoleState(queryRole as UserRole);
      return;
    }

    // 3. Parse simulation cookies (ONLY valid if real user is Super Admin)
    const simCookieMatch = document.cookie.match(/tius_simulated_user=([^;]+)/);
    const simRoleMatch = document.cookie.match(/simulated_role=([^;]+)/);
    let parsedSimUser: SessionUser | null = null;
    if (simCookieMatch) {
      try {
        const raw = simCookieMatch[1];
        const decoded = raw.includes('%') ? decodeURIComponent(raw) : raw;
        const sim = JSON.parse(decoded);
        if (sim && typeof sim === 'object' && sim.id && sim.role) {
          parsedSimUser = sim;
        }
      } catch {
        // ignore parse error
      }
    }

    if (isSuperAdminReal && (parsedSimUser || simRoleMatch)) {
      setIsSimulating(true);
      if (parsedSimUser) {
        setSimulatedUser(parsedSimUser);
        if (parsedSimUser.role && parsedSimUser.role in DEFAULT_USERS) {
          setRoleState(parsedSimUser.role as UserRole);
        }
        if (parsedSimUser.custom_permissions) {
          setCustomPermissions(parsedSimUser.custom_permissions);
        }
      } else if (simRoleMatch) {
        const r = simRoleMatch[1] as UserRole;
        if (r in DEFAULT_USERS) {
          setRoleState(r);
        }
      }
    } else {
      setIsSimulating(false);
      setSimulatedUser(null);
      if (parsedRealUser?.role && parsedRealUser.role in DEFAULT_USERS) {
        setRoleState(parsedRealUser.role as UserRole);
      }
      if (parsedRealUser?.custom_permissions) {
        setCustomPermissions(parsedRealUser.custom_permissions);
      }
    }

    // 4. Fetch fresh custom_permissions directly from Supabase users table
    async function syncPermissionsFromSupabase() {
      try {
        const supabase = createClient();

        // If currently simulating, fetch fresh permissions for simulated target user
        if (isSuperAdminReal && (parsedSimUser || simCookieMatch)) {
          let targetSimId = parsedSimUser?.id || simulatedUser?.id;
          let targetSimEmail = parsedSimUser?.email || simulatedUser?.email;

          if (targetSimId || targetSimEmail) {
            let query = supabase
              .from('users')
              .select('id, name, role, email, academic_title, staff_id, hourly_rate, avatar_url, custom_permissions, department_ids, departments, department:departments(name)');

            if (targetSimId && !targetSimId.startsWith('demo-') && !targetSimId.startsWith('u1111') && !targetSimId.startsWith('u8888')) {
              query = query.eq('id', targetSimId);
            } else if (targetSimEmail) {
              query = query.ilike('email', targetSimEmail);
            }

            const { data: dbUser } = await query.maybeSingle();
            if (dbUser) {
              const fetchedPerms: Record<string, boolean> =
                dbUser.custom_permissions && typeof dbUser.custom_permissions === 'object'
                  ? dbUser.custom_permissions
                  : {};

              setCustomPermissions(fetchedPerms);

              const updatedSim: SessionUser = {
                id: dbUser.id,
                name: dbUser.name,
                email: dbUser.email,
                role: dbUser.role as UserRole,
                roleTitle: dbUser.academic_title || dbUser.role,
                academic_title: dbUser.academic_title || undefined,
                avatarUrl: dbUser.avatar_url || '',
                avatar_url: dbUser.avatar_url || null,
                staffId: dbUser.staff_id || '',
                departmentName: (dbUser.department as any)?.name || '',
                department_ids: dbUser.department_ids || [],
                departments: dbUser.departments || [],
                custom_permissions: fetchedPerms,
                isSimulation: true,
              };

              setSimulatedUser(updatedSim);
              setRoleState(dbUser.role as UserRole);

              // Update temporary simulation cookie ONLY (leave tius_session untouched!)
              document.cookie = `tius_simulated_user=${encodeURIComponent(JSON.stringify(updatedSim))}; path=/; max-age=86400; SameSite=Lax`;
              document.cookie = `simulated_role=${encodeURIComponent(dbUser.role)}; path=/; max-age=86400; SameSite=Lax`;
            }
          }
          return;
        }

        // If not simulating: Sync real user's permissions and session ONLY if verified user exists
        let targetId: string | null = parsedRealUser?.id || realUser?.id || null;
        let targetEmail: string | null = parsedRealUser?.email || realUser?.email || null;

        const { data: authData } = await supabase.auth.getUser();
        if (authData?.user?.email) targetEmail = authData.user.email;
        if (authData?.user?.id && !targetId) targetId = authData.user.id;

        // If not authenticated, DO NOT query or persist any session
        if (!targetId && !targetEmail) {
          return;
        }

        if (targetId || targetEmail) {
          let query = supabase
            .from('users')
            .select('id, name, role, email, academic_title, staff_id, hourly_rate, avatar_url, custom_permissions, department_ids, departments, department:departments(name)');

          if (targetId && !targetId.startsWith('demo-') && !targetId.startsWith('u1111') && !targetId.startsWith('u8888')) {
            query = query.eq('id', targetId);
          } else if (targetEmail) {
            query = query.ilike('email', targetEmail);
          }

          const { data: dbUser } = await query.maybeSingle();
          if (dbUser) {
            const fetchedPerms: Record<string, boolean> =
              dbUser.custom_permissions && typeof dbUser.custom_permissions === 'object'
                ? dbUser.custom_permissions
                : {};

            setCustomPermissions(fetchedPerms);

            const updatedReal: SessionUser = {
              id: dbUser.id,
              name: dbUser.name,
              email: dbUser.email,
              role: dbUser.role as UserRole,
              roleTitle: dbUser.academic_title || dbUser.role,
              academic_title: dbUser.academic_title || undefined,
              avatarUrl: dbUser.avatar_url || '',
              avatar_url: dbUser.avatar_url || null,
              staffId: dbUser.staff_id || '',
              departmentName: (dbUser.department as any)?.name || '',
              department_ids: dbUser.department_ids || [],
              departments: dbUser.departments || [],
              custom_permissions: fetchedPerms,
              isSimulation: false,
            };

            setRealUser(updatedReal);
            if (!isSimulating && dbUser.role in DEFAULT_USERS) {
              setRoleState(dbUser.role as UserRole);
            }

            // Sync updated real session to tius_session cookie
            document.cookie = `tius_session=${encodeURIComponent(JSON.stringify(updatedReal))}; path=/; max-age=604800; SameSite=Lax`;
            try {
              localStorage.setItem('tius_session_role', dbUser.role);
              localStorage.setItem('tius_session_email', dbUser.email);
              localStorage.setItem('tius_custom_permissions', JSON.stringify(fetchedPerms));
            } catch {}
          }
        }
      } catch (err) {
        // ignore network error
      }
    }

    syncPermissionsFromSupabase();
  }, [pathname]);

  const setRole = (newRole: UserRole, customPerms?: Record<string, boolean>) => {
    // setRole is only called for real role switches (or dev switcher)
    setIsSimulating(false);
    setSimulatedUser(null);
    setRoleState(newRole);

    const effectivePerms = customPerms || customPermissions || {};
    if (customPerms) {
      setCustomPermissions(customPerms);
    }

    if (typeof document !== 'undefined') {
      // Clear simulation cookies
      document.cookie = 'tius_simulated_user=; path=/; max-age=0; SameSite=Lax';
      document.cookie = 'simulated_role=; path=/; max-age=0; SameSite=Lax';
      document.cookie = 'simulated_user_id=; path=/; max-age=0; SameSite=Lax';

      const template = DEFAULT_USERS[newRole];
      const sessionData: SessionUser = {
        email: template.email,
        role: newRole,
        name: template.name,
        id: template.id,
        roleTitle: template.roleTitle,
        avatarUrl: template.avatarUrl,
        staffId: template.staffId,
        departmentName: template.departmentName,
        custom_permissions: effectivePerms,
        isSimulation: false,
      };

      setRealUser(sessionData);
      document.cookie = `tius_session=${encodeURIComponent(JSON.stringify(sessionData))}; path=/; max-age=604800; SameSite=Lax`;
      try {
        localStorage.setItem('tius_session_role', newRole);
        localStorage.setItem('tius_session_email', template.email);
        localStorage.setItem('tius_custom_permissions', JSON.stringify(effectivePerms));
      } catch {}
    }
  };

  /**
   * Safe Simulate User handler:
   * 1. Fetches target user record (with custom_permissions) from database
   * 2. Sets target user as activeUser while leaving realUser (Super Admin) intact
   * 3. Sets temporary simulation cookies (tius_simulated_user, simulated_role, simulated_user_id)
   * 4. NEVER overwrites or touches tius_session or real JWT
   * 5. Sets isSimulating = true to render orange banner
   */
  const simulateUser = async (targetUser: any) => {
    // Strictly gate this feature so it ONLY functions when the logged-in user's real base role is SUPER_ADMIN
    if (realUser?.role !== 'SUPER_ADMIN') {
      console.warn('Simulation feature is exclusively restricted to Super Admin only.');
      return;
    }

    try {
      const supabase = createClient();
      let targetRecord = targetUser;

      if (targetUser?.id && !targetUser.id.startsWith('demo-')) {
        const { data: dbUser } = await supabase
          .from('users')
          .select('id, name, role, email, academic_title, staff_id, hourly_rate, avatar_url, custom_permissions, department_ids, departments, department:departments(name)')
          .eq('id', targetUser.id)
          .maybeSingle();

        if (dbUser) {
          targetRecord = { ...targetUser, ...dbUser };
        }
      }

      const userPerms =
        targetRecord.custom_permissions && typeof targetRecord.custom_permissions === 'object'
          ? targetRecord.custom_permissions
          : {};

      const simData: SessionUser = {
        id: targetRecord.id,
        name: targetRecord.name,
        email: targetRecord.email,
        role: targetRecord.role as UserRole,
        roleTitle: targetRecord.academic_title || targetRecord.role,
        avatarUrl: targetRecord.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(targetRecord.name)}&background=e5eeff&color=0b1c30&bold=true`,
        staffId: targetRecord.staff_id || '',
        departmentName: (targetRecord.department as any)?.name || targetRecord.departmentName || '',
        department_ids: targetRecord.department_ids || [],
        departments: targetRecord.departments || [],
        custom_permissions: userPerms,
        isSimulation: true,
      };

      // Set simulation state in context
      setSimulatedUser(simData);
      setIsSimulating(true);
      setRoleState(simData.role);
      setCustomPermissions(userPerms);

      // Set dedicated simulation cookies WITHOUT touching primary tius_session!
      if (typeof document !== 'undefined') {
        document.cookie = `tius_simulated_user=${encodeURIComponent(JSON.stringify(simData))}; path=/; max-age=86400; SameSite=Lax`;
        document.cookie = `simulated_role=${encodeURIComponent(simData.role)}; path=/; max-age=86400; SameSite=Lax`;
        document.cookie = `simulated_user_id=${encodeURIComponent(simData.id)}; path=/; max-age=86400; SameSite=Lax`;

        try {
          localStorage.setItem('tius_simulated_user', JSON.stringify(simData));
          localStorage.setItem('simulated_role', simData.role);
          localStorage.setItem('simulated_user_id', simData.id);
        } catch {}

        // Navigate to simulated user's corresponding portal
        let dest = '/teacher';
        if (simData.role === 'SUPER_ADMIN') dest = '/admin/roles';
        else if (simData.role === 'IT_ADMIN') dest = '/admin/roles';
        else if (simData.role === 'COORDINATOR') dest = '/coordinator';
        else if (simData.role === 'TEACHER' || simData.role === 'DEAN' || simData.role === 'VICE_DEAN') dest = '/teacher';
        else if (simData.role === 'HOD') dest = '/hod';
        else if (simData.role === 'ACCOUNTANT') dest = '/finance';

        window.location.href = dest;
      }
    } catch (err) {
      console.error('Failed to simulate user:', err);
    }
  };

  /**
   * Safe Exit Simulation handler:
   * 1. Clears temporary simulatedUser cookies and storage
   * 2. Reverts activeUser back to realUser (Super Admin)
   * 3. Sets isSimulating = false
   * 4. Forcefully pushes back to /admin/roles
   */
  const exitSimulation = () => {
    // 1. Clear simulation cookies
    if (typeof document !== 'undefined') {
      document.cookie = 'tius_simulated_user=; path=/; max-age=0; SameSite=Lax';
      document.cookie = 'simulated_role=; path=/; max-age=0; SameSite=Lax';
      document.cookie = 'simulated_user_id=; path=/; max-age=0; SameSite=Lax';
      try {
        localStorage.removeItem('tius_simulated_user');
        localStorage.removeItem('simulated_role');
        localStorage.removeItem('simulated_user_id');
      } catch {}
    }

    // 2. Revert state back to real authenticated Super Admin
    setIsSimulating(false);
    setSimulatedUser(null);
    if (realUser) {
      setRoleState(realUser.role);
      setCustomPermissions(realUser.custom_permissions || {});
    }

    // 3. Forcefully push back to /admin/roles
    if (typeof window !== 'undefined') {
      window.location.href = '/admin/roles';
    }
  };

  const logout = () => {
    if (typeof document !== 'undefined') {
      document.cookie = 'tius_session=; path=/; max-age=0; SameSite=Lax';
      document.cookie = 'tius_simulated_user=; path=/; max-age=0; SameSite=Lax';
      document.cookie = 'simulated_role=; path=/; max-age=0; SameSite=Lax';
      document.cookie = 'simulated_user_id=; path=/; max-age=0; SameSite=Lax';
      try {
        localStorage.removeItem('tius_session_role');
        localStorage.removeItem('tius_session_email');
        localStorage.removeItem('tius_custom_permissions');
        localStorage.removeItem('tius_simulated_user');
        localStorage.removeItem('simulated_role');
        localStorage.removeItem('simulated_user_id');
      } catch {}
      try {
        const supabase = createClient();
        supabase.auth.signOut();
      } catch {}
      window.location.replace('/login');
    }
  };

  // Active user being displayed in the UI:
  // If simulating: target user; otherwise: real authenticated user (or null for guests)
  const activeUser: SessionUser | null = isSimulating && simulatedUser
    ? {
        ...simulatedUser,
        role: simulatedUser.role,
        custom_permissions: {
          ...(customPermissions || {}),
          ...(simulatedUser.custom_permissions || {}),
        },
        isSimulation: true,
      }
    : realUser
    ? {
        ...realUser,
        role: realUser.role,
        custom_permissions: {
          ...(customPermissions || {}),
          ...(realUser.custom_permissions || {}),
        },
        isSimulation: false,
      }
    : null;

  // Alias user to activeUser for backward compatibility across all existing components
  const user = activeUser;
  const activeViewLabel = role ? (VIEW_LABELS[role] || role) : '';
  const isSuperAdmin = !isSimulating && realUser?.role === 'SUPER_ADMIN';

  const hasPermission = (permissionKey: string): boolean => {
    if (!user && !realUser) return false;
    // 1. SUPER_ADMIN is always true for everything (including simulator)
    if (!isSimulating && (realUser?.role === 'SUPER_ADMIN' || user?.role === 'SUPER_ADMIN')) {
      return true;
    }
    // HARD RULE: The Portal/Role Simulator must NEVER be toggleable or accessible to IT_ADMIN or any other role
    if (
      permissionKey === 'can_simulate_roles' ||
      permissionKey === 'simulator' ||
      permissionKey === 'role_simulator'
    ) {
      return false;
    }
    const currentRole = user?.role || role;
    if (!currentRole) return false;
    return resolveEffectivePermission(
      permissionKey,
      currentRole,
      user?.custom_permissions || customPermissions,
      rolePermissions
    );
  };

  return (
    <SessionContext.Provider
      value={{
        role,
        user,
        activeUser,
        realUser,
        simulatedUser,
        isSimulating,
        isSimulation: isSimulating,
        activeViewLabel,
        isSuperAdmin,
        rolePermissions,
        hasPermission,
        refreshPermissions,
        setRole,
        simulateUser,
        exitSimulation,
        logout,
      }}
    >
      {isSimulating && realUser?.role === 'SUPER_ADMIN' && activeUser && (
        <div className="fixed top-0 left-0 right-0 h-10 bg-amber-500 text-white flex items-center justify-center font-semibold text-sm shadow-md z-[99999] px-4">
          <span className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
            You are currently simulating <strong className="font-extrabold underline decoration-white/60">{activeUser.name}</strong>'s portal ({activeUser.role}).
          </span>
          <button
            onClick={exitSimulation}
            className="ml-4 px-3.5 py-1 bg-white text-amber-700 rounded-full text-xs font-bold hover:bg-amber-50 shadow-sm transition-all cursor-pointer flex items-center gap-1 active:scale-95"
          >
            Exit Simulation
          </button>
        </div>
      )}
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): SessionContextType {
  const context = useContext(SessionContext);
  if (!context) {
    // Graceful fallback for components used outside provider or for unauthenticated guests
    return {
      role: null,
      user: null,
      activeUser: null,
      realUser: null,
      simulatedUser: null,
      isSimulating: false,
      isSimulation: false,
      activeViewLabel: '',
      isSuperAdmin: false,
      rolePermissions: DEFAULT_ROLE_PERMISSIONS,
      hasPermission: () => false,
      refreshPermissions: async () => {},
      setRole: () => {},
      simulateUser: () => {},
      exitSimulation: () => {},
      logout: () => {},
    };
  }
  return context;
}
