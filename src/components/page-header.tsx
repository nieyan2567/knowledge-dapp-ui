import { ReactNode } from "react";

export function PageHeader({
  eyebrow,
  title,
  description,
  right,
  testId,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  right?: ReactNode;
  testId?: string;
}) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div className="max-w-3xl">
        {eyebrow ? (
          <div className="mb-3 inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            {eyebrow}
          </div>
        ) : null}
        <h1
          data-testid={testId}
          className="text-3xl font-bold tracking-tight text-slate-950 md:text-4xl dark:text-slate-100"
        >
          {title}
        </h1>
        {description ? (
          <p className="mt-3 text-sm leading-7 text-slate-600 md:text-base dark:text-slate-400">
            {description}
          </p>
        ) : null}
      </div>

      {right ? <div className="shrink-0">{right}</div> : null}
    </div>
  );
}
