import { ReactNode } from "react";

export function StatCard({
  title,
  value,
  description,
  icon,
}: {
  title: string;
  value: ReactNode;
  description?: string;
  icon?: ReactNode;
}) {
  return (
    <div className="group rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-4 flex items-start justify-between">
        <div className="text-sm font-medium text-slate-500 dark:text-slate-400">
          {title}
        </div>
        {icon ? (
          <div className="text-slate-400 transition group-hover:text-slate-600 dark:text-slate-500 dark:group-hover:text-slate-300">
            {icon}
          </div>
        ) : null}
      </div>

      <div className="min-h-10 text-2xl font-semibold tracking-tight text-slate-950 dark:text-slate-100">
        {value}
      </div>

      {description ? (
        <div className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-400">
          {description}
        </div>
      ) : null}
    </div>
  );
}