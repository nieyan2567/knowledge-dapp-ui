"use client";

type AddressBadgeProps = {
  address?: string | null;
  className?: string;
};

function shortenAddress(address?: string | null) {
  if (!address) return "未连接";
  if (address.length < 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function AddressBadge({ address, className = "" }: AddressBadgeProps) {
  if (!address) {
    return (
      <span
        className={`inline-flex max-w-full items-center rounded-xl bg-slate-100 px-3 py-2 text-sm text-slate-500 ${className}`}
      >
        未连接
      </span>
    );
  }

  return (
    <span
      title={address}
      className={`inline-flex max-w-full cursor-default items-center rounded-xl bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700 ${className}`}
    >
      {shortenAddress(address)}
    </span>
  );
}