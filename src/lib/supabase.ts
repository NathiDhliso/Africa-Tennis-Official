import { createClient } from '@supabase/supabase-js'
import { Database } from '../types/supabase' // <-- Import the Database type

// Make sure to replace these with your actual environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Create and export the Supabase client
// By passing the Database type, the client becomes fully type-safe
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)