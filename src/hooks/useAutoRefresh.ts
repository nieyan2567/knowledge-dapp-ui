"use client";

import { useEffect } from "react";

export function useAutoRefresh({
  enabled,
  onRefresh,
  intervalMs = 30000,
  runImmediately = false,
}: {
  enabled: boolean;
  onRefresh: () => void | Promise<void>;
  intervalMs?: number;
  runImmediately?: boolean;
}) {
  useEffect(() => {
    if (!enabled) {
      return;
    }

    function refreshIfVisible() {
      if (document.visibilityState === "visible") {
        void onRefresh();
      }
    }

    if (runImmediately) {
      void onRefresh();
    }

    const intervalId = window.setInterval(refreshIfVisible, intervalMs);
    window.addEventListener("focus", refreshIfVisible);
    document.addEventListener("visibilitychange", refreshIfVisible);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", refreshIfVisible);
      document.removeEventListener("visibilitychange", refreshIfVisible);
    };
  }, [enabled, intervalMs, onRefresh, runImmediately]);
}
