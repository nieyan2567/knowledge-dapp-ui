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
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-sm font-medium text-slate-500">{title}</div>
        {icon ? <div className="text-slate-400">{icon}</div> : null}
      </div>
      <div className="text-2xl font-semibold text-slate-900">{value}</div>
      {description ? <div className="mt-2 text-sm text-slate-500">{description}</div> : null}
    </div>
  );
}