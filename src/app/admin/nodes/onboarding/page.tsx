/**
 * 模块说明：保留节点接入向导路由占位，但当前公开前端构建中主动屏蔽该页面。
 */
import { notFound } from "next/navigation";
// import { NodeOnboardingPage } from "@/components/admin/node-onboarding-page";

/**
 * 渲染节点接入向导页的占位实现。
 * @returns 不会真正返回页面，而是直接进入 Next.js 的 `notFound` 分支。
 */
export default function AdminNodeOnboardingPage() {
  // return <NodeOnboardingPage />;
  notFound();
}
