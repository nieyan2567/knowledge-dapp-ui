/**
 * 模块说明：定义应用根布局，负责挂载全局样式、Provider、应用外壳和全局提示组件。
 */
import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";
import { Toaster } from "sonner";
import { AppShell } from "@/components/app-shell";

/**
 * 定义整个应用共享的页面元信息。
 * @returns 提供给 Next.js App Router 的静态元数据对象。
 */
export const metadata: Metadata = {
  title: "Knowledge DApp",
  description: "Decentralized knowledge collaboration and incentive platform",
};

/**
 * 渲染应用的根文档骨架。
 * @param children 当前路由段实际渲染出的页面内容。
 * @returns 包含全局 Provider、应用外壳和消息提示容器的根布局。
 */
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
