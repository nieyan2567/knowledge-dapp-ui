import { ReactNode } from "react";
import clsx from "clsx";

export function StatCard({
  title,
  value,
  description,
  icon,
  className,
  headerClassName,
  titleClassName,
  valueClassName,
  descriptionClassName,
}: {
  title: string;
  value: ReactNode;
  description?: string;
  icon?: ReactNode;
  className?: string;
  headerClassName?: string;
  titleClassName?: string;
  valueClassName?: string;
  descriptionClassName?: string;
}) {
  return (
    <div
      className={clsx(
        "group rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-900",
        className
      )}
    >
      <div
        className={clsx("mb-4 flex items-start justify-between", headerClassName)}
      >
        <div
          className={clsx(
            "text-sm font-medium text-slate-500 dark:text-slate-400",
            titleClassName
          )}
        >
          {title}
        </div>
        {icon ? (
          <div className="text-slate-400 transition group-hover:text-slate-600 dark:text-slate-500 dark:group-hover:text-slate-300">
            {icon}
          </div>
        ) : null}
      </div>

      <div
        className={clsx(
          "min-h-10 text-2xl font-semibold tracking-tight text-slate-950 dark:text-slate-100",
          valueClassName
        )}
      >
        {value}
      </div>

      {description ? (
        <div
          className={clsx(
            "mt-3 text-sm leading-6 text-slate-500 dark:text-slate-400",
            descriptionClassName
          )}
        >
          {description}
        </div>
      ) : null}
    </div>
  );
}
