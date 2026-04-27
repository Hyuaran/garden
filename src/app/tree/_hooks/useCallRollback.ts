"use client";

/**
 * Tree Phase D-02 Step 6: 巻き戻し hook（5s タイマー）
 * spec §7、判 0-3 確定: 5s 固定
 *
 * 使い方:
 *   const { armRollback, performRollback, canRollback } = useCallRollback();
 *
 *   // insertTreeCallRecord 成功後
 *   armRollback(call_id);
 *
 *   // 巻き戻しボタン or Ctrl+Z
 *   const { success, error } = await performRollback();
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { rollbackCallRecord } from "../_actions/rollbackCallRecord";
import { supabase } from "../_lib/supabase";

const ROLLBACK_WINDOW_MS = 5000;

export type RollbackState = {
  /** 巻き戻し可能かどうか（5s タイマー内） */
  canRollback: boolean;
  /** 巻き戻しを有効化する（INSERT 成功直後に呼ぶ） */
  armRollback: (callId: string) => void;
  /** 巻き戻し実行（Ctrl+Z またはボタン押下時） */
  performRollback: () => Promise<{ success: boolean; error?: string }>;
};

export function useCallRollback(): RollbackState {
  const [lastCallId, setLastCallId] = useState<string | null>(null);
  const [canRollback, setCanRollback] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const armRollback = useCallback((callId: string) => {
    setLastCallId(callId);
    setCanRollback(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setCanRollback(false);
      setLastCallId(null);
    }, ROLLBACK_WINDOW_MS);
  }, []);

  const performRollback = useCallback(async (): Promise<{
    success: boolean;
    error?: string;
  }> => {
    if (!canRollback || !lastCallId) {
      return { success: false, error: "5 秒経過したため巻き戻しできません" };
    }

    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token ?? "";

    const result = await rollbackCallRecord({
      call_id: lastCallId,
      accessToken,
    });

    if (result.success) {
      setCanRollback(false);
      setLastCallId(null);
      if (timerRef.current) clearTimeout(timerRef.current);
      return { success: true };
    }

    return { success: false, error: result.errorMessage };
  }, [canRollback, lastCallId]);

  // cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return { armRollback, performRollback, canRollback };
}
