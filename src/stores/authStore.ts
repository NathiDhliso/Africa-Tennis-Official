import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '../lib/supabase';
import type { User, Session } from '@supabase/supabase-js';
import type { Database } from '../types/database';

type Profile = Database['public']['Tables']['profiles']['Row'];

interface AuthState {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, username: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<void>;
  fetchProfile: () => Promise<void>;
  initialize: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      profile: null,
      session: null,
      loading: true,

      initialize: async () => {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          
          if (session) {
            set({ 
              user: session.user, 
              session,
              loading: false 
            });
            await get().fetchProfile();
          } else {
            set({ loading: false });
          }

          // Listen for auth changes
          supabase.auth.onAuthStateChange(async (event, session) => {
            if (event === 'SIGNED_IN' && session) {
              set({ 
                user: session.user, 
                session,
                loading: false 
              });
              await get().fetchProfile();
            } else if (event === 'SIGNED_OUT') {
              set({ 
                user: null, 
                profile: null, 
                session: null,
                loading: false 
              });
            }
          });
        } catch (error) {
          console.error('Auth initialization error:', error);
          set({ loading: false });
        }
      },

      signIn: async (email: string, password: string) => {
        set({ loading: true });
        try {
          const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
          });

          if (error) throw error;

          set({ 
            user: data.user, 
            session: data.session,
            loading: false 
          });
          
          await get().fetchProfile();
        } catch (error: unknown) {
          set({ loading: false });
          const errorMessage = error instanceof Error ? error.message : 'Sign in failed';
          throw new Error(errorMessage);
        }
      },

      signUp: async (email: string, password: string, username: string) => {
        set({ loading: true });
        try {
          const { error } = await supabase.auth.signUp({
            email,
            password,
            options: {
              data: {
                username
              }
            }
          });

          if (error) throw error;

          set({ loading: false });
        } catch (error: unknown) {
          set({ loading: false });
          const errorMessage = error instanceof Error ? error.message : 'Sign up failed';
          throw new Error(errorMessage);
        }
      },

      signOut: async () => {
        try {
          const { error } = await supabase.auth.signOut();
          if (error) throw error;
          
          set({ 
            user: null, 
            profile: null, 
            session: null 
          });
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : 'Sign out failed';
          throw new Error(errorMessage);
        }
      },

      fetchProfile: async () => {
        const { user } = get();
        if (!user) return;

        try {
          const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('user_id', user.id)
            .single();

          if (error) throw error;
          set({ profile: data });
        } catch (error: unknown) {
          console.error('Error fetching profile:', error);
        }
      },

      updateProfile: async (updates: Partial<Profile>) => {
        const { user, profile } = get();
        if (!user || !profile) throw new Error('No user logged in');

        try {
          const { data, error } = await supabase
            .from('profiles')
            .update({ ...updates, updated_at: new Date().toISOString() })
            .eq('user_id', user.id)
            .select()
            .single();

          if (error) throw error;
          set({ profile: data });
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : 'Profile update failed';
          throw new Error(errorMessage);
        }
      }
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ 
        user: state.user, 
        profile: state.profile,
        session: state.session 
      })
    }
  )
);