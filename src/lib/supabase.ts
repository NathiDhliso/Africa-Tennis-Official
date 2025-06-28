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

// Create the Supabase client with optimized settings
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  },
  realtime: {
    params: {
      eventsPerSecond: 5 // Reduced from 10 to minimize network traffic
    }
  },
  global: {
    headers: {
      'x-application-name': 'africa-tennis-platform'
    }
  },
  db: {
    schema: 'public'
  },
  // Add fetch options for better performance
  fetch: (url, options) => {
    const fetchOptions = {
      ...options,
      // Add cache control for better performance
      headers: {
        ...options?.headers,
        'Cache-Control': 'no-cache'
      }
    };
    return fetch(url, fetchOptions);
  }
})

// Create a singleton instance for storage operations
export const storage = supabase.storage;

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

// Utility function to check if a bucket exists
export const checkBucketExists = async (bucketName: string): Promise<boolean> => {
  try {
    const { data, error } = await supabase.storage.getBucket(bucketName);
    if (error) {
      console.error(`Bucket ${bucketName} does not exist:`, error);
      return false;
    }
    return !!data;
  } catch (err) {
    console.error(`Error checking bucket ${bucketName}:`, err);
    return false;
  }
};