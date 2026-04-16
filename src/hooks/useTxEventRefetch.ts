"use client";

/**
 * @notice 基于交易确认事件触发数据重取的 Hook。
 * @dev 该 Hook 监听应用内统一的交易确认事件总线，并在域命中时执行传入的刷新函数列表。
 */
import { useEffect } from "react";

import { subscribeTxConfirmed, type TxDomain } from "@/lib/tx-events";

/**
 * @notice 页面数据重取函数类型。
 * @dev 允许刷新函数以同步或异步方式执行。
 */
type Refetcher = () => unknown | Promise<unknown>;

/**
 * @notice 订阅指定交易域的确认事件并执行刷新。
 * @param domains 当前页面关注的交易域列表。
 * @param refetchers 命中事件后需要执行的刷新函数列表。
 * @returns 当前 Hook 不返回任何数据，仅负责事件订阅与清理。
 */
export function useTxEventRefetch(
  domains: readonly TxDomain[],
  refetchers: readonly Refetcher[]
) {
  useEffect(() => {
    /**
     * @notice 仅对当前页面关注的域执行刷新。
     * @dev 通过域过滤避免一次交易确认事件触发整个应用的无关重取。
     */
    return subscribeTxConfirmed(({ domains: changedDomains }) => {
      if (!changedDomains.some((domain) => domains.includes(domain))) {
        return;
      }

      void Promise.all(refetchers.map((refetch) => refetch()));
    });
  }, [domains, refetchers]);
}
