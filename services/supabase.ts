import { createClient } from '@supabase/supabase-js';

// Supabase configuration
// URL provided by the user
const SUPABASE_URL = "https://ctzzajzfvmydldspivuw.supabase.co";
// The anon key is required to authenticate requests. 
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN0enphanpmdm15ZGxkc3BpdnV3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM2NTQwNzksImV4cCI6MjA3OTIzMDA3OX0.0NwKAOptgUUzPJapQHNvjGW5AQk3Nfj8yuFJ2cZ7jBE";

export const supabase = (SUPABASE_URL && SUPABASE_ANON_KEY) 
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) 
  : null;