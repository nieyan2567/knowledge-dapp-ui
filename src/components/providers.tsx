"use client";

import { ReactNode, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { config } from "@/lib/wagmi";
import { knowledgeChain } from "@/lib/chains";
import "@rainbow-me/rainbowkit/styles.css";

export function Providers({ children }: { children: ReactNode }) {
    const [queryClient] = useState(() => new QueryClient());

    return (
        <WagmiProvider config={config}>
        <QueryClientProvider client={queryClient}>
            <RainbowKitProvider initialChain={knowledgeChain}>
            {children}
            </RainbowKitProvider>
        </QueryClientProvider>
        </WagmiProvider>
    );
}