import Link from "next/link";

import { PageHeader } from "@/components/page-header";
import { ADMIN_COPY } from "@/lib/admin/copy";

export default function AdminPage() {
  return (
    <main className="mx-auto max-w-7xl space-y-8 px-6 py-10">
      <PageHeader
        eyebrow={ADMIN_COPY.dashboard.eyebrow}
        title={ADMIN_COPY.dashboard.title}
        description={ADMIN_COPY.dashboard.description}
      />

      <div className="grid gap-6 md:grid-cols-2">
        <Link
          href="/admin/nodes"
          className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-slate-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700"
        >
          <h2 className="text-xl font-semibold text-slate-950 dark:text-slate-100">
            {ADMIN_COPY.dashboard.nodeTitle}
          </h2>
          <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-400">
            {ADMIN_COPY.dashboard.nodeDescription}
          </p>
        </Link>

        <Link
          href="/admin/validators"
          className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-slate-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700"
        >
          <h2 className="text-xl font-semibold text-slate-950 dark:text-slate-100">
            {ADMIN_COPY.dashboard.validatorTitle}
          </h2>
          <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-400">
            {ADMIN_COPY.dashboard.validatorDescription}
          </p>
        </Link>
      </div>
    </main>
  );
}
