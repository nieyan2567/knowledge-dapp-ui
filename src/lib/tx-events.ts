"use client";

export type TxDomain =
  | "stake"
  | "rewards"
  | "content"
  | "governance"
  | "dashboard"
  | "system";

export type TxConfirmedDetail = {
  hash: `0x${string}`;
  domains: TxDomain[];
};

const txEvents = new EventTarget();

export function emitTxConfirmed(detail: TxConfirmedDetail) {
  txEvents.dispatchEvent(new CustomEvent<TxConfirmedDetail>("tx-confirmed", { detail }));
}

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
