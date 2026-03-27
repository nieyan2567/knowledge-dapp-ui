import { ReactNode } from "react";

export function SectionCard({
  title,
  description,
  children,
  className,
  bodyClassName,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section
      className={`flex flex-col rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 ${className ?? ""}`}
    >
      <div className="mb-5 shrink-0">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          {title}
        </h2>
        {description ? (
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {description}
          </p>
        ) : null}
      </div>
      <div className={`min-h-0 flex-1 ${bodyClassName ?? ""}`}>{children}</div>
    </section>
  );
}
