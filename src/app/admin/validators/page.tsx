import Link from "next/link";

import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";

export default function AdminValidatorsPage() {
  return (
    <main className="mx-auto max-w-5xl space-y-8 px-6 py-10">
      <PageHeader
        eyebrow="Admin / Validators"
        title="Validator Reviews"
        description="当前仓库已经完成普通节点接入流程。Validator 接入会在下一阶段补齐，因此先保留稳定路由。"
      />

      <SectionCard
        title="Next Phase"
        description="这个页面先保留下来，后续 validator 模块可以直接挂到这个固定路由上。"
        bodyClassName="space-y-4"
      >
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm leading-7 text-slate-600 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-300">
          下一步会补上 validator 申请持久化、限制只有已批准普通节点才能提交，
          并在服务端封装 `qbft_proposeValidatorVote`。
        </div>

        <Link
          href="/admin/nodes"
          className="inline-flex items-center rounded-xl bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
        >
          继续查看节点审批
        </Link>
      </SectionCard>
    </main>
  );
}
