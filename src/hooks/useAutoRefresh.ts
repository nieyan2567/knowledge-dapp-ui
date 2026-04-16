"use client";

/**
 * @notice 自动刷新 Hook。
 * @dev 负责在页面可见、窗口重新获得焦点或定时器触发时执行刷新回调。
 */
import { useEffect } from "react";

/**
 * @notice 在满足条件时自动执行页面刷新逻辑。
 * @param options 自动刷新配置对象。
 * @param options.enabled 是否启用自动刷新。
 * @param options.onRefresh 具体的刷新回调，可同步或异步执行。
 * @param options.intervalMs 定时刷新的时间间隔，单位为毫秒，默认值为 30000。
 * @param options.runImmediately 是否在 Hook 初始化后立刻执行一次刷新。
 * @returns 当前 Hook 不返回任何数据，仅负责注册和清理副作用。
 */
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

    /**
     * @notice 仅在页面可见时执行刷新。
     * @dev 该保护用于避免标签页处于后台时持续发起无意义请求。
     * @returns 当前刷新调用的结果；若页面不可见则直接返回。
     */
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
