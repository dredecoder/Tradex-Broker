// ============================================================
// TRADEX — SUPABASE CLIENT
// assets/js/supabase.js
// ============================================================

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

// ── YOUR SUPABASE CREDENTIALS ─────────────────────────────
// Supabase Dashboard → Settings → API
const SUPABASE_URL  = 'https://rsnogupwqakeofljedka.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJzbm9ndXB3cWFrZW9mbGplZGthIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc3MzUsImV4cCI6MjA4OTYwMzczNX0.EHGAIM0ylw74XWbJvTtkM5rXEyQSxc5fSlRiq5GOzaI';

// ── CLIENT INSTANCE ───────────────────────────────────────
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
  auth: {
    persistSession:     true,
    autoRefreshToken:   true,
    detectSessionInUrl: true,
  }
});

// ── GET SESSION ───────────────────────────────────────────
export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

// ── GET USER ──────────────────────────────────────────────
export async function getUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

// ── GET PROFILE ───────────────────────────────────────────
export async function getProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  if (error) throw error;
  return data;
}

// ── GET WALLET ────────────────────────────────────────────
export async function getWallet(userId) {
  const { data, error } = await supabase
    .from('wallets')
    .select('*')
    .eq('user_id', userId)
    .single();
  if (error) throw error;
  return data;
}

// ── REQUIRE AUTH ──────────────────────────────────────────
export async function requireAuth() {
  const session = await getSession();
  if (!session) {
    // Works on both localhost and Vercel
    const base = window.location.pathname.includes('/admin/') ||
                 window.location.pathname.includes('/dashboard/') ||
                 window.location.pathname.includes('/deposit/') ||
                 window.location.pathname.includes('/withdraw/') ||
                 window.location.pathname.includes('/plans/') ||
                 window.location.pathname.includes('/portfolio/') ||
                 window.location.pathname.includes('/transactions/') ||
                 window.location.pathname.includes('/profile/')
      ? '../login.html'
      : 'login.html';
    window.location.href = base;
    return null;
  }
  return session;
}

// ── REQUIRE ADMIN ─────────────────────────────────────────
export async function requireAdmin() {
  const session = await getSession();
  if (!session) {
    window.location.href = '../login.html';
    return null;
  }
  try {
    const profile = await getProfile(session.user.id);
    if (!profile || profile.role !== 'admin') {
      // Not admin — send to user dashboard
      window.location.href = '../dashboard/index.html';
      return null;
    }
    return { session, profile };
  } catch (err) {
    console.error('requireAdmin error:', err);
    window.location.href = '../login.html';
    return null;
  }
}

// ── REDIRECT IF LOGGED IN ─────────────────────────────────
export async function redirectIfLoggedIn() {
  const session = await getSession();
  if (!session) return;
  try {
    const profile = await getProfile(session.user.id);
    if (profile?.role === 'admin') {
      window.location.href = 'admin/index.html';
    } else {
      window.location.href = 'dashboard/index.html';
    }
  } catch {
    window.location.href = 'dashboard/index.html';
  }
}
