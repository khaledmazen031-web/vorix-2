// Fill these in from Supabase Dashboard -> Project Settings -> API
// SUPABASE_URL   = "Project URL"
// SUPABASE_ANON_KEY = "anon public" key (safe to expose client-side)
const SUPABASE_URL = "https://sjlykfrwmwaexypnimsk.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_0SyuKMjE9nVVphpeolnlRg_Z8q3SXrv";

let supabaseClient = null;
try {
  if (window.supabase && SUPABASE_ANON_KEY && SUPABASE_ANON_KEY !== "PASTE_YOUR_ANON_PUBLIC_KEY_HERE") {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
} catch (e) {
  console.error("Supabase init failed:", e);
}
