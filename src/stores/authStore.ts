import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { supabase } from '../lib/supabase';
import type { User, Session } from '@supabase/supabase-js';
import type { Database } from '../types/supabase-generated';

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
        console.log('[AUTH STORE] Starting initialization');
        try {
          console.log('[AUTH STORE] Getting current session');
          const { data: { session } } = await supabase.auth.getSession();
          console.log('[AUTH STORE] Session retrieved:', !!session);
          
          if (session) {
            console.log('[AUTH STORE] Session found, setting user state');
            set({ 
              user: session.user, 
              session,
              loading: false 
            });
            console.log('[AUTH STORE] Fetching user profile');
            await get().fetchProfile();
          } else {
            console.log('[AUTH STORE] No session found, setting loading to false');
            set({ loading: false });
          }

          console.log('[AUTH STORE] Setting up auth state change listener');
          // Listen for auth changes
          const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            console.log('[AUTH STORE] Auth state change:', event, !!session);
            if (event === 'SIGNED_IN' && session) {
              console.log('[AUTH STORE] User signed in, updating state');
              set({ 
                user: session.user, 
                session,
                loading: false 
              });
              await get().fetchProfile();
            } else if (event === 'SIGNED_OUT') {
              console.log('[AUTH STORE] User signed out, clearing state');
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

          console.log('[AUTH STORE] Initialization completed successfully');
          // Optionally provide an unsubscribe function for callers that wish to clean up
          return () => {
            console.log('[AUTH STORE] Cleaning up auth subscription');
            subscription.unsubscribe();
          };
        } catch (error) {
          console.error('[AUTH STORE] Auth initialization error:', error);
          console.error('[AUTH STORE] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
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
          const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
              data: {
                username
              }
            }
          });

          if (error) throw error;

          // Create profile immediately after signup
          if (data.user) {
            try {
              const { data: profileData, error: profileError } = await supabase
                .from('profiles')
                .insert({
                  user_id: data.user.id,
                  username: username,
                  elo_rating: 1200,
                  matches_played: 0,
                  matches_won: 0,
                  skill_level: 'beginner',
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                })
                .select()
                .single();

              if (profileError) {
                console.error('Error creating profile during signup:', profileError);
              } else {
                set({ profile: profileData as Profile });
              }
            } catch (profileError) {
              console.error('Error creating profile during signup:', profileError);
            }
          }

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
        console.log('[AUTH STORE] fetchProfile called');
        const { user, profile } = get();
        if (!user) {
          console.log('[AUTH STORE] No user found, skipping profile fetch');
          return;
        }

        console.log('[AUTH STORE] Checking profile cache for user:', user.id);
        // Return cached profile if it's fresh
        const now = Date.now();
        if (profile && (now - lastProfileFetch) < PROFILE_CACHE_TIME) {
          console.log('[AUTH STORE] Using cached profile');
          return;
        }

        // Return existing promise if a fetch is already in progress
        if (profileFetchPromise) {
          console.log('[AUTH STORE] Profile fetch already in progress, returning existing promise');
          return profileFetchPromise;
        }

        console.log('[AUTH STORE] Starting new profile fetch');
        // Create new fetch promise
        profileFetchPromise = (async () => {
          try {
            console.log('[AUTH STORE] Querying profiles table for user:', user.id);
            const { data, error } = await supabase
              .from('profiles')
              .select('user_id, username, elo_rating, matches_played, matches_won, skill_level, bio, profile_picture_url, created_at, updated_at, player_style_analysis')
              .eq('user_id', user.id)
              .single();

            if (error) {
              console.error('[AUTH STORE] Profile fetch error:', error);
              throw error;
            }

            console.log('[AUTH STORE] Profile fetched successfully:', !!data);
            
            set({ profile: data as Profile });
            lastProfileFetch = Date.now();
          } catch (error: unknown) {
            console.error('Error fetching profile:', error);
            // If profile doesn't exist, try to create it
            if (error && typeof error === 'object' && 'code' in error && error.code === 'PGRST116') {
              try {
                const { data, error: insertError } = await supabase
                  .from('profiles')
                  .insert({
                    user_id: user.id,
                    username: user.user_metadata?.username || user.email?.split('@')[0] || 'Player',
                    elo_rating: 1200,
                    matches_played: 0,
                    matches_won: 0,
                    skill_level: 'beginner',
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                  })
                  .select()
                  .single();

                if (insertError) throw insertError;
                set({ profile: data as Profile });
              } catch (createError) {
                console.error('Error creating profile:', createError);
              }
            }
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