"use client";

/**
 * 模块说明：地址徽章组件，负责以紧凑样式展示钱包或合约地址，并处理未连接状态。
 */
type AddressBadgeProps = {
  address?: string | null;
  className?: string;
};

/**
 * 缩写地址文本。
 * @param address 需要展示的钱包或合约地址。
 * @returns 截断后的地址文本；若地址为空则返回未连接文案。
 */
function shortenAddress(address?: string | null) {
  if (!address) return "未连接";
  if (address.length < 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/**
 * 渲染地址徽章。
 * @param address 需要展示的地址。
 * @param className 根节点附加样式。
 * @returns 一个可复用的地址显示徽章。
 */
export function AddressBadge({ address, className = "" }: AddressBadgeProps) {
  if (!address) {
    return (
      <span
        className={`inline-flex max-w-full items-center rounded-xl bg-slate-100 px-3 py-2 text-sm text-slate-500 dark:bg-slate-800 dark:text-slate-300 ${className}`}
      >
        未连接
      </span>
    );
  }

  return (
    <span
      title={address}
      className={`inline-flex max-w-full cursor-default items-center rounded-xl bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200 ${className}`}
    >
      {shortenAddress(address)}
    </span>
  );
}
