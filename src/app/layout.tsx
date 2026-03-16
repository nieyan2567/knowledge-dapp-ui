import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";
import { Toaster } from "sonner";
import { AppShell } from "@/components/app-shell";

export const metadata: Metadata = {
    title: "Knowledge DApp",
    description: "Decentralized knowledge collaboration and incentive platform",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="zh-CN" suppressHydrationWarning>
            <body>
                <Providers>
                    <AppShell>
                        {children}
                    </AppShell>
                </Providers>
                <Toaster richColors position="top-right" />
            </body>
        </html>
    );
}
