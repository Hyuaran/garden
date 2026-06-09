/**
 * Garden-Bud auth helpers.
 *
 * Bud keeps its own two-hour gate, but the unlock timestamp is shared with
 * unified auth under the common `bud:unlockedAt` session key.
 */

import {
  clearAuthSession,
  isAuthSessionUnlocked,
  touchAuthSession,
  unlockAuthSession,
} from "../../_lib/auth-unified";
import { supabase } from "./supabase";

/**
 * Convert an employee number to the synthetic auth email used by Garden.
 * Example: "8" or "0008" -> "emp0008@garden.internal".
 */
export function toSyntheticEmail(empId: string): string {
  const digits = empId.replace(/\D/g, "").padStart(4, "0");
  return `emp${digits}@garden.internal`;
}

/**
 * Sign in to Supabase Auth only. Bud permission checks happen in
 * BudStateContext.refreshAuth after the auth token is established.
 */
export async function signInBud(
  empId: string,
  password: string,
): Promise<{ success: boolean; error?: string; userId?: string }> {
  if (!empId || !password) {
    return { success: false, error: "社員番号とパスワードを入力してください" };
  }

  const email = toSyntheticEmail(empId);
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.user) {
    return {
      success: false,
      error: "社員番号またはパスワードが正しくありません",
    };
  }

  unlockAuthSession("bud");
  return { success: true, userId: data.user.id };
}

/** End the Bud session and the Supabase Auth session. */
export async function signOutBud(): Promise<void> {
  clearBudUnlock();
  await supabase.auth.signOut();
}

/** Whether the Bud two-hour gate is currently unlocked. */
export function isBudUnlocked(): boolean {
  return isAuthSessionUnlocked("bud");
}

/** Refresh the Bud unlock timestamp after activity. */
export function touchBudSession(): void {
  touchAuthSession("bud");
}

/** Clear only the Bud unlock key. */
export function clearBudUnlock(): void {
  clearAuthSession("bud");
}

/** Return the current Supabase Auth session after forcing user resolution. */
export async function getSession() {
  await supabase.auth.getUser();
  const { data } = await supabase.auth.getSession();
  return data.session;
}

/** Return the current Supabase Auth user. */
export async function getUser() {
  const { data } = await supabase.auth.getUser();
  return data.user;
}
