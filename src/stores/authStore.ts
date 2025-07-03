import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
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
  initialize: () => Promise<(() => void) | void>;
}

// Request deduplication
let profileFetchPromise: Promise<void> | null = null;
let lastProfileFetch = 0;
const PROFILE_CACHE_TIME = 60000; // 1 minute cache

// Create a more efficient store with optimized persistence
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
          const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
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
              // Clear cache on sign out
              profileFetchPromise = null;
              lastProfileFetch = 0;
            }
          });

          // Optionally provide an unsubscribe function for callers that wish to clean up
          return () => subscription.unsubscribe();
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
          
          // Clear cache
          profileFetchPromise = null;
          lastProfileFetch = 0;
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : 'Sign out failed';
          throw new Error(errorMessage);
        }
      },

      fetchProfile: async () => {
        const { user, profile } = get();
        if (!user) return;

        // Return cached profile if it's fresh
        const now = Date.now();
        if (profile && (now - lastProfileFetch) < PROFILE_CACHE_TIME) {
          return;
        }

        // Return existing promise if a fetch is already in progress
        if (profileFetchPromise) {
          return profileFetchPromise;
        }

        // Create new fetch promise
        profileFetchPromise = (async () => {
          try {
            const { data, error } = await supabase
              .from('profiles')
              .select('user_id, username, elo_rating, matches_played, matches_won, skill_level, bio, profile_picture_url, created_at, updated_at, player_style_analysis')
              .eq('user_id', user.id)
              .single();

            if (error) throw error;
            
            set({ profile: data as Profile });
            lastProfileFetch = Date.now();
          } catch (error: unknown) {
            console.error('Error fetching profile:', error);
          } finally {
            profileFetchPromise = null;
          }
        })();

        return profileFetchPromise;
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
          set({ profile: data as Profile });
          lastProfileFetch = Date.now(); // Update cache time
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : 'Profile update failed';
          throw new Error(errorMessage);
        }
      }
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ 
        user: state.user, 
        profile: state.profile,
        session: state.session 
      }),
      // Only rehydrate on page load, not on hot reloads during development
      skipHydration: true,
    }
  )
);