import type { Session, User } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { supabase } from './supabase';
import type { Profile } from './types';

type AuthCtx = {
  /** First session check finished. */
  ready: boolean;
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  /** Invited beta tester (null while checking). */
  member: boolean | null;
  admin: boolean;
  /** Signed in, invited, but name or terms agreement still missing. */
  needsOnboarding: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthCtx>({
  ready: false,
  session: null,
  user: null,
  profile: null,
  member: null,
  admin: false,
  needsOnboarding: false,
  refresh: async () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(!supabase);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [member, setMember] = useState<boolean | null>(supabase ? null : false);
  const [admin, setAdmin] = useState(false);
  const loadSeq = useRef(0);

  const load = useCallback(async (s: Session | null) => {
    const seq = ++loadSeq.current;
    if (!supabase || !s?.user) {
      setProfile(null);
      setMember(false);
      setAdmin(false);
      return;
    }
    setMember(null);
    const uid = s.user.id;
    const [mem, adm, prof] = await Promise.all([
      supabase.rpc('is_beta_member'),
      supabase.rpc('is_app_admin'),
      supabase.from('profiles').select('id, display_name, terms_accepted_at, created_at').eq('id', uid).maybeSingle(),
    ]);
    if (seq !== loadSeq.current) return;
    let p = (prof.data as Profile | null) ?? null;
    if (!p && !prof.error) {
      // First sign-in: create the profile row (name and terms are asked next).
      const fallback = String(s.user.user_metadata?.display_name ?? s.user.user_metadata?.full_name ?? '').slice(0, 40);
      const ins = await supabase.from('profiles').insert({ id: uid, display_name: fallback }).select('id, display_name, terms_accepted_at, created_at').maybeSingle();
      p = (ins.data as Profile | null) ?? { id: uid, display_name: fallback, terms_accepted_at: null };
    }
    if (seq !== loadSeq.current) return;
    setProfile(p);
    setMember(mem.error ? false : mem.data === true);
    setAdmin(!adm.error && adm.data === true);
  }, []);

  useEffect(() => {
    if (!supabase) return;
    let alive = true;
    supabase.auth
      .getSession()
      .then(async ({ data }) => {
        if (!alive) return;
        setSession(data.session);
        await load(data.session).catch(() => setMember(false));
      })
      .finally(() => alive && setReady(true));
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      // Token refreshes keep the same user; only reload on real changes.
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') load(s).catch(() => setMember(false));
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, [load]);

  const refresh = useCallback(() => load(session), [load, session]);
  const signOut = useCallback(async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setSession(null);
    await load(null);
  }, [load]);

  const value = useMemo<AuthCtx>(() => {
    const user = session?.user ?? null;
    return {
      ready,
      session,
      user,
      profile,
      member,
      admin,
      needsOnboarding: !!user && member === true && (!profile?.terms_accepted_at || !profile.display_name.trim()),
      refresh,
      signOut,
    };
  }, [ready, session, profile, member, admin, refresh, signOut]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
