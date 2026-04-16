/**
 * 模块说明：保留验证者审批页路由占位，但当前公开前端构建中主动屏蔽该页面。
 */
import { notFound } from "next/navigation";
// import { ValidatorRequestsAdminPage } from "@/components/admin/validator-requests-admin";

/**
 * 渲染验证者审批页的占位实现。
 * @returns 不会真正返回页面，而是直接进入 Next.js 的 `notFound` 分支。
 */
export default function AdminValidatorsPage() {
  // return <ValidatorRequestsAdminPage />;
  notFound();
}
