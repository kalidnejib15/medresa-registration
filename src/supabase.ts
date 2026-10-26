import { createClient } from '@supabase/supabase-js'
// Anon key is public by design; protect data with Row Level Security policies.
const url = import.meta.env.VITE_SUPABASE_URL ?? 'https://omokgdblmnnvrpwvotjv.supabase.co'
const key = import.meta.env.VITE_SUPABASE_ANON_KEY ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9tb2tnZGJsbW5udnJwd3ZvdGp2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIxODA1NTgsImV4cCI6MjA5Nzc1NjU1OH0.q6852hJu5UNadZ9dLzsAHRxpNFrfu8VaCNJ08yZJse0'
export const supabase = createClient(url, key)
