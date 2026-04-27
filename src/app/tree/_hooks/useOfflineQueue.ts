"use client";

import { useState, useEffect, useCallback } from "react";
import {
  enqueue,
  flush,
  getQueueSize,
  getManualRecoveryQueue,
  type QueuedItem,
} from "../_lib/offlineQueue";
import { insertTreeCallRecord } from "../_actions/insertTreeCallRecord";

export type NetworkStatus = "online" | "queued" | "offline";

export function useOfflineQueue() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );
  const [queueSize, setQueueSize] = useState<number>(() =>
    typeof window !== "undefined" ? getQueueSize() : 0,
  );
  const [manualRecoveryItems, setManualRecoveryItems] = useState<QueuedItem[]>(
    () => (typeof window !== "undefined" ? getManualRecoveryQueue() : []),
  );

  // online/offline イベント監視
  useEffect(() => {
    const updateOnline = () => {
      setIsOnline(true);
      flush(async (payload) => insertTreeCallRecord(payload)).then(
        ({ succeeded, failed }) => {
          console.log(
            `[offlineQueue] auto-flush: ${succeeded} succeeded, ${failed} failed`,
          );
          setQueueSize(getQueueSize());
          setManualRecoveryItems(getManualRecoveryQueue());
        },
      );
    };
    const updateOffline = () => setIsOnline(false);

    window.addEventListener("online", updateOnline);
    window.addEventListener("offline", updateOffline);
    return () => {
      window.removeEventListener("online", updateOnline);
      window.removeEventListener("offline", updateOffline);
    };
  }, []);

  const enqueueItem = useCallback(
    (payload: Parameters<typeof enqueue>[0]) => {
      const result = enqueue(payload);
      setQueueSize(result.size);
      return result;
    },
    [],
  );

  const manualFlush = useCallback(async () => {
    const result = await flush(async (payload) => insertTreeCallRecord(payload));
    setQueueSize(getQueueSize());
    setManualRecoveryItems(getManualRecoveryQueue());
    return result;
  }, []);

  const status: NetworkStatus = !isOnline
    ? "offline"
    : queueSize > 0
      ? "queued"
      : "online";

  return {
    isOnline,
    queueSize,
    status,
    manualRecoveryItems,
    enqueueItem,
    manualFlush,
  };
}
