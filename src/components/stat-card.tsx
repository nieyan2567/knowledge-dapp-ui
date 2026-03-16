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
    <div className="group rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="mb-4 flex items-start justify-between">
        <div className="text-sm font-medium text-slate-500">{title}</div>
        {icon ? (
          <div className="text-slate-400 transition group-hover:text-slate-600">
            {icon}
          </div>
        ) : null}
      </div>

      <div className="min-h-10 text-2xl font-semibold tracking-tight text-slate-950">
        {value}
      </div>

      {description ? (
        <div className="mt-3 text-sm leading-6 text-slate-500">{description}</div>
      ) : null}
    </div>
  );
}