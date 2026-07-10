/**
 * Supabase client for auth.
 *
 * Expects env vars:
 *   PUBLIC_SUPABASE_URL
 *   PUBLIC_SUPABASE_ANON_KEY
 *
 * These are safe to expose in the browser (anon key has RLS).
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('[cms-admin] Missing PUBLIC_SUPABASE_URL or PUBLIC_SUPABASE_ANON_KEY');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Sign in with GitHub OAuth.
 * Returns the session including provider_token (GitHub access token).
 */
export async function signInWithGitHub() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'github',
    options: {
      scopes: 'repo',
      redirectTo: `${window.location.origin}/admin`,
    },
  });
  if (error) throw error;
  return data;
}

/**
 * Sign out.
 */
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

/**
 * Get the current session.
 */
export async function getSession() {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) throw error;
  return session;
}

/**
 * Get the GitHub access token from the session.
 */
export async function getGitHubToken() {
  const session = await getSession();
  return session?.provider_token || null;
}

/**
 * Get the current user info.
 */
export async function getUser() {
  const session = await getSession();
  if (!session) return null;
  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.user_metadata?.full_name || session.user.user_metadata?.user_name || session.user.email,
    avatar: session.user.user_metadata?.avatar_url,
    username: session.user.user_metadata?.user_name,
  };
}

/**
 * Listen for auth state changes.
 */
export function onAuthStateChange(callback) {
  return supabase.auth.onAuthStateChange((event, session) => {
    callback(event, session);
  });
}
