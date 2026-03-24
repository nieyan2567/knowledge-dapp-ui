"use client";

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
import { knowledgeChain } from "@/lib/chains";
import { config } from "@/lib/wagmi";

function RainbowKitThemeBridge({ children }: { children: ReactNode }) {
  const { resolvedTheme } = useTheme();
  const isClient = useIsClient();

  const isDark = isClient && resolvedTheme === "dark";

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

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      enableSystem={false}
    >
      <WagmiProvider config={config}>
        <QueryClientProvider client={queryClient}>
          <ObservabilityProvider />
          <RainbowKitThemeBridge>{children}</RainbowKitThemeBridge>
        </QueryClientProvider>
      </WagmiProvider>
    </ThemeProvider>
  );
}
