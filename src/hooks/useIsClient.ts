"use client";

/**
 * @notice 客户端运行环境检测 Hook。
 * @dev 基于 `useSyncExternalStore` 在服务端与客户端之间提供稳定一致的环境判断结果。
 */
import { useSyncExternalStore } from "react";

function subscribe() {
  return () => {};
}

function getClientSnapshot() {
  return true;
}

function getServerSnapshot() {
  return false;
}

/**
 * @notice 判断当前渲染是否已经运行在浏览器端。
 * @returns 若当前处于客户端环境则返回 `true`，否则返回 `false`。
 */
export function useIsClient() {
  return useSyncExternalStore(
    subscribe,
    getClientSnapshot,
    getServerSnapshot
  );
}
