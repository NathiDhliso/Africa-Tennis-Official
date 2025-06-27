import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types/database'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Validate required environment variables
if (!supabaseUrl) {
  throw new Error('Missing VITE_SUPABASE_URL environment variable. Please check your .env file.')
}

if (!supabaseAnonKey) {
  throw new Error('Missing VITE_SUPABASE_ANON_KEY environment variable. Please check your .env file.')
}

// Create the Supabase client
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  },
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  },
  global: {
    headers: {
      'x-application-name': 'africa-tennis-platform'
    }
  }
})

// Helper function to handle Supabase errors consistently
export const handleSupabaseError = (error: unknown): string => {
  console.error('Supabase error:', error);
  
  // Type guard to check if error has expected properties
  const isSupabaseError = (err: unknown): err is { code?: string; message?: string } => {
    return typeof err === 'object' && err !== null;
  };
  
  if (isSupabaseError(error)) {
    if (error.code === 'PGRST116') {
      return 'No data found';
    }
    
    if (error.code === '23505') {
      return 'This record already exists';
    }
    
    if (error.code === '23503') {
      return 'Referenced record does not exist';
    }
    
    if (error.message) {
      return error.message;
    }
  }
  
  return 'An unexpected error occurred';
};