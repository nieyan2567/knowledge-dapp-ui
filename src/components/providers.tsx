"use client";

/**
 * 模块说明：全局 Provider 组合组件，负责挂载主题、Wagmi、React Query、RainbowKit 和观测能力。
 */
import "@rainbow-me/rainbowkit/styles.css";

import { ReactNode, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  RainbowKitProvider,
  darkTheme,
  lightTheme,
} from "@rainbow-me/rainbowkit";
import { ThemeProvider, useTheme } from "next-themes";
import { WagmiProvider } from "wagmi";
import { useIsClient } from "@/hooks/useIsClient";
import { ObservabilityProvider } from "@/components/observability-provider";
import { getKnowledgeChain } from "@/lib/chains";
import { getWagmiConfig } from "@/lib/wagmi";

/**
 * 根据当前主题状态为 RainbowKit 提供明暗主题桥接。
 * @param children 需要被 RainbowKitProvider 包裹的子节点。
 * @returns 带动态主题配置的 RainbowKitProvider。
 */
function RainbowKitThemeBridge({ children }: { children: ReactNode }) {
  const { resolvedTheme } = useTheme();
  const isClient = useIsClient();
  const knowledgeChain = getKnowledgeChain();

  const isDark = isClient && resolvedTheme === "dark";

  /*
   * RainbowKit 自身不直接读取 next-themes 的状态，
   * 因此这里把站点当前明暗主题映射成钱包连接器所需的主题对象。
   */
  return (
    <RainbowKitProvider
      initialChain={knowledgeChain}
      theme={
        isDark
          ? darkTheme({
              accentColor: "#e2e8f0",
              accentColorForeground: "#020617",
              borderRadius: "medium",
              overlayBlur: "small",
            })
          : lightTheme({
              accentColor: "#0f172a",
              accentColorForeground: "#ffffff",
              borderRadius: "medium",
              overlayBlur: "small",
            })
      }
    >
      {children}
    </RainbowKitProvider>
  );
}

/**
 * 挂载应用运行所需的全局 Provider。
 * @param children 需要共享全局状态和上下文的子节点。
 * @returns 按既定顺序组合后的全局 Provider 树。
 */
export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  const wagmiConfig = getWagmiConfig();

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      enableSystem={false}
    >
      <WagmiProvider config={wagmiConfig}>
        <QueryClientProvider client={queryClient}>
          <ObservabilityProvider />
          <RainbowKitThemeBridge>{children}</RainbowKitThemeBridge>
        </QueryClientProvider>
      </WagmiProvider>
    </ThemeProvider>
  );
}
