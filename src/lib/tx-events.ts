"use client";

/**
 * @notice 前端交易确认事件总线。
 * @dev 提供按业务域广播和订阅交易确认事件的轻量机制。
 */
/**
 * @notice 交易事件所属的业务域类型。
 * @dev 用于限制交易确认广播的影响范围，避免无关页面重复刷新。
 */
export type TxDomain =
  | "stake"
  | "rewards"
  | "content"
  | "governance"
  | "dashboard"
  | "system";

/**
 * @notice 交易确认事件的载荷结构。
 * @dev 包含交易哈希和该交易影响到的业务域列表。
 */
export type TxConfirmedDetail = {
  hash: `0x${string}`;
  domains: TxDomain[];
};

const txEvents = new EventTarget();

/**
 * @notice 广播一条交易确认事件。
 * @param detail 当前确认交易的事件详情。
 * @returns 当前函数不返回值，仅负责发出浏览器端自定义事件。
 */
export function emitTxConfirmed(detail: TxConfirmedDetail) {
  txEvents.dispatchEvent(new CustomEvent<TxConfirmedDetail>("tx-confirmed", { detail }));
}

/**
 * @notice 订阅交易确认事件。
 * @param listener 事件监听函数，接收交易确认详情作为参数。
 * @returns 取消订阅的清理函数。
 */
export function subscribeTxConfirmed(
  listener: (detail: TxConfirmedDetail) => void
) {
  const handler: EventListener = (event) => {
    listener((event as CustomEvent<TxConfirmedDetail>).detail);
  };

  txEvents.addEventListener("tx-confirmed", handler);

  return () => {
    txEvents.removeEventListener("tx-confirmed", handler);
  };
}
