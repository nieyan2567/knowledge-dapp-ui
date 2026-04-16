/**
 * 模块说明：保留管理后台总览路由占位，但当前公开前端构建中主动屏蔽该页面。
 */
import { notFound } from "next/navigation";
// import { AdminOverviewPage } from "@/components/admin/admin-overview-page";

/**
 * 渲染管理后台总览页的占位实现。
 * @returns 不会真正返回页面，而是直接进入 Next.js 的 `notFound` 分支。
 */
export default function AdminPage() {
  // return <AdminOverviewPage />;
  notFound();
}
